import { Logger } from '@bedrock-oss/bedrock-boost';
import { Container, EntityComponentTypes, ItemStack, Player } from '@minecraft/server';

import { EQUIPMENT_COUNT, LOG_NAMESPACE, MIRROR_SIZE, PLAYER_CONTAINER_SIZE } from '../Constants';
import { ItemFingerprint } from '../core/ItemFingerprint';
import { NameTag } from '../core/NameTag';
import { SlotMap } from '../core/SlotMap';
import { CursorGuard } from './CursorGuard';
import { ProjectorSession } from './ProjectorSession';

/**
 * One watched player and every projector mirroring them.
 *
 * Holds the authoritative fingerprint mirror of the target's 36 container slots plus 5 equipment
 * slots, which is what lets an incoming change be attributed to a side instead of guessed at.
 */
export class TargetWatch {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'TargetWatch');

	private readonly sessions: ProjectorSession[] = [];
	private readonly mirror: string[] = new Array<string>(MIRROR_SIZE).fill(ItemFingerprint.EMPTY);
	private dirty = true;

	constructor(readonly target: Player) {}

	get targetId(): string {
		return this.target.id;
	}

	get isEmpty(): boolean {
		return this.sessions.length === 0;
	}

	getSessions(): readonly ProjectorSession[] {
		return this.sessions;
	}

	addSession(session: ProjectorSession): void {
		this.sessions.push(session);
		this.prime(session);
	}

	removeSession(session: ProjectorSession): void {
		const index = this.sessions.indexOf(session);
		if (index >= 0) this.sessions.splice(index, 1);
	}

	/** Flags that the target changed, without trusting the reported slot index. */
	markDirty(): void {
		this.dirty = true;
	}

	/**
	 * A stack on either cursor lives in no container, so its origin slot reads as empty. Committing
	 * during that window is what turns a drag into a deletion, so all writes wait it out.
	 */
	isTransactionPending(): boolean {
		if (CursorGuard.isHolding(this.target)) return true;
		return this.sessions.some((session) => CursorGuard.isHolding(session.viewer));
	}

	tick(): void {
		if (!this.target.isValid || this.isTransactionPending()) return;

		if (this.dirty) {
			this.dirty = false;
			this.pull();
		}

		for (const session of this.sessions) {
			if (!session.isValid) continue;
			this.push(session);
			session.reclaimUnmappedSlots();
		}
	}

	/** Target is authoritative: fan every changed slot out to all projectors. */
	pull(): void {
		let equipmentChanged = false;

		for (let index = 0; index < MIRROR_SIZE; index++) {
			const item = this.readTarget(index);
			const fingerprint = ItemFingerprint.of(item);
			if (fingerprint === this.mirror[index]) continue;

			this.mirror[index] = fingerprint;
			equipmentChanged ||= SlotMap.isEquipment(index);
			for (const session of this.sessions) session.writeSlot(index, item);

			TargetWatch.log.debug(
				`Pulled from target: ${this.target.name}, slot: ${index}, item: ${item?.typeId ?? 'empty'}`
			);
			
		}

		if (equipmentChanged) this.refreshNameTags();
	}

	/** Viewer is authoritative for slots they changed: write through and fan out to other viewers. */
	push(session: ProjectorSession): void {
		let equipmentChanged = false;

		for (let index = 0; index < MIRROR_SIZE; index++) {
			const item = session.readSlot(index);
			const fingerprint = ItemFingerprint.of(item);
			if (fingerprint === this.mirror[index]) continue;

			if (!this.writeTarget(index, item)) {
				this.reject(session, index, item);
				equipmentChanged = true;
				continue;
			}

			this.mirror[index] = fingerprint;
			equipmentChanged ||= SlotMap.isEquipment(index);

			for (const other of this.sessions) {
				if (other !== session) other.writeSlot(index, item);
			}

			TargetWatch.log.info(
				`Viewer: ${session.viewer.name} changed target: ${this.target.name}, slot: ${index}, item: ${item?.typeId ?? 'empty'}`
			);
		}

		if (equipmentChanged) this.refreshNameTags();
	}

	/** Restores a slot the target would not accept and hands the refused stack back to the world. */
	private reject(session: ProjectorSession, index: number, item?: ItemStack): void {
		const current = this.readTarget(index);
		this.mirror[index] = ItemFingerprint.of(current);
		for (const other of this.sessions) other.writeSlot(index, current);

		if (item) session.dropAtViewer(item);

		TargetWatch.log.warn(
			`Target: ${this.target.name} refused item: ${item?.typeId ?? 'empty'} in slot: ${index}, dropped at viewer: ${session.viewer.name}`
		);
	}

	/**
	 * True when the held stack matches a mirror entry the projector no longer holds, meaning it was
	 * lifted out of the target's inventory rather than the viewer's own.
	 */
	claimsFromTarget(session: ProjectorSession, held: ItemStack): boolean {
		const fingerprint = ItemFingerprint.of(held);
		for (let index = 0; index < MIRROR_SIZE; index++) {
			if (this.mirror[index] !== fingerprint) continue;
			if (session.readSlot(index) === undefined) return true;
		}
		return false;
	}

	get targetContainer(): Container | undefined {
		if (!this.target.isValid) return undefined;
		return this.target.getComponent(EntityComponentTypes.Inventory)?.container;
	}

	private prime(session: ProjectorSession): void {
		for (let index = 0; index < MIRROR_SIZE; index++) {
			const item = this.readTarget(index);
			this.mirror[index] = ItemFingerprint.of(item);
			session.writeSlot(index, item);
		}
		this.refreshNameTags();
	}

	private readTarget(index: number): ItemStack | undefined {
		if (!this.target.isValid) return undefined;

		if (index < PLAYER_CONTAINER_SIZE) return this.targetContainer?.getItem(index);

		const slot = SlotMap.equipmentSlotFor(index);
		if (!slot) return undefined;
		return this.target.getComponent(EntityComponentTypes.Equippable)?.getEquipment(slot);
	}

	/** False when the target refuses the stack, for example a chestplate dropped on the legs slot. */
	private writeTarget(index: number, item?: ItemStack): boolean {
		if (!this.target.isValid) return false;

		if (index < PLAYER_CONTAINER_SIZE) {
			const container = this.targetContainer;
			if (!container) return false;
			container.setItem(index, item);
			return true;
		}

		const slot = SlotMap.equipmentSlotFor(index);
		if (!slot) return false;

		try {
			return (
				this.target
					.getComponent(EntityComponentTypes.Equippable)
					?.setEquipment(slot, item) ?? false
			);
		} catch (e) {
			TargetWatch.log.error(
				`Failed to equip target: ${this.target.name}, slot: ${slot}, error: ${e}`
			);
			return false;
		}
	}

	private refreshNameTags(): void {
		const occupied: boolean[] = [];
		for (let i = 0; i < EQUIPMENT_COUNT; i++) {
			occupied.push(this.mirror[PLAYER_CONTAINER_SIZE + i] !== ItemFingerprint.EMPTY);
		}

		const flags = NameTag.flagsFor(occupied);
		for (const session of this.sessions) session.refreshNameTag(flags, this.target.name);
	}
}
