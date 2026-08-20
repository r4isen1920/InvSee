import { Logger, Vec3 } from '@bedrock-oss/bedrock-boost';
import { Container, Entity, EntityComponentTypes, ItemStack, Player, system } from '@minecraft/server';

import { DynamicProp, Identifiers, InvseeTag, LOG_NAMESPACE } from '../Constants';
import { NameTag } from '../core/NameTag';
import { SlotMap } from '../core/SlotMap';
import { CursorGuard } from './CursorGuard';

/** One viewer seated on one projector entity, mirroring a single target. */
export class ProjectorSession {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'ProjectorSession');

	private nameTagFlags = '';

	private constructor(
		readonly viewer: Player,
		readonly targetId: string,
		readonly entity: Entity
	) {}

	/**
	 * Creates an instance of ProjectorSession,
	 * spawning a projector entity and seating the viewer on it.
	 * 
	 * @param viewer The player who will be seated on the projector and viewing the target's inventory.
	 * @param target The player whose inventory will be mirrored to the viewer.
	 * @returns This instance.
	 */
	static create(viewer: Player, target: Player): ProjectorSession | undefined {
		try {
			const entity = viewer.dimension.spawnEntity(
				Identifiers.ProjectorEntity,
				Vec3.from(viewer.location)
			);

			entity.addTag(InvseeTag.Projector);
			entity.setDynamicProperty(DynamicProp.TargetId, target.id);
			entity.setDynamicProperty(DynamicProp.ViewerId, viewer.id);

			const rideable = entity.getComponent(EntityComponentTypes.Rideable);
			if (!rideable?.addRider(viewer)) {
				ProjectorSession.log.warn(
					`Could not seat viewer: ${viewer.name} on projector, aborting session`
				);
				entity.remove();
				return undefined;
			}

			system.runTimeout(() => {
				viewer.playAnimation('animation.r4isen1920_invsee.player.riding.cancel', {
					stopExpression: 'q.is_sneaking || !q.is_riding',
				});
			}, 2);

			ProjectorSession.log.info(
				`Opened projector for viewer: ${viewer.name}, target: ${target.name}`
			);
			return new ProjectorSession(viewer, target.id, entity);
		} catch (e) {
			ProjectorSession.log.error(
				`Failed to spawn projector for viewer: ${viewer.name}, error: ${e}`
			);
			return undefined;
		}
	}

	get isValid(): boolean {
		return this.entity.isValid && this.viewer.isValid;
	}

	get container(): Container | undefined {
		if (!this.entity.isValid) return undefined;
		return this.entity.getComponent(EntityComponentTypes.Inventory)?.container;
	}

	/** True once the viewer has walked away from or been removed from the seat. */
	get isAbandoned(): boolean {
		if (!this.isValid) return true;

		try {
			const riding = this.viewer.getComponent(EntityComponentTypes.Riding);
			return riding?.entityRidingOn.id !== this.entity.id;
		} catch (e) {
			ProjectorSession.log.warn(
				`Could not read riding state for viewer: ${this.viewer.name}, error: ${e}`
			);
			return true;
		}
	}

	readSlot(mirrorIndex: number): ItemStack | undefined {
		return this.container?.getItem(SlotMap.toProjector(mirrorIndex));
	}

	writeSlot(mirrorIndex: number, item?: ItemStack): void {
		this.container?.setItem(SlotMap.toProjector(mirrorIndex), item);
	}

	/** Only reassigns the nameTag when the armor flags actually change, to avoid UI churn. */
	refreshNameTag(flags: string, targetName: string): void {
		if (flags === this.nameTagFlags) return;
		this.nameTagFlags = flags;
		this.entity.nameTag = NameTag.build(flags, targetName);
	}

	/**
	 * Returns anything quick-moved into a slot the UI does not render, which would otherwise be
	 * invisible and unrecoverable.
	 */
	reclaimUnmappedSlots(): void {
		const container = this.container;
		const viewerContainer = this.viewer.getComponent(EntityComponentTypes.Inventory)?.container;
		if (!container || !viewerContainer) return;

		for (const slot of SlotMap.UNMAPPED_PROJECTOR_SLOTS) {
			const stray = container.getItem(slot);
			if (!stray) continue;

			const leftover = viewerContainer.addItem(stray);
			if (leftover) this.viewer.dimension.spawnItem(leftover, this.viewer.location);
			container.setItem(slot, undefined);

			ProjectorSession.log.warn(
				`Returned stray item to viewer: ${this.viewer.name}, item: ${stray.typeId}, slot: ${slot}`
			);
		}
	}

	/** Hands a stack still stuck on the viewer's cursor back to the viewer. */
	reclaimCursor(): boolean {
		const viewerContainer = this.viewer.getComponent(EntityComponentTypes.Inventory)?.container;
		if (!viewerContainer) return false;
		return CursorGuard.reclaim(
			this.viewer,
			viewerContainer,
			this.viewer.dimension,
			this.viewer.location
		);
	}

	/** Returns a stack the target refused to the world rather than letting it vanish. */
	dropAtViewer(item: ItemStack): void {
		try {
			this.viewer.dimension.spawnItem(item, this.viewer.location);
		} catch (e) {
			ProjectorSession.log.error(
				`Failed to drop refused item for viewer: ${this.viewer.name}, error: ${e}`
			);
		}
	}

	dispose(): void {
		try {
			if (this.entity.isValid) {
				this.entity.getComponent(EntityComponentTypes.Rideable)?.ejectRiders();
				this.entity.remove();
			}
			ProjectorSession.log.info(`Closed projector for viewer: ${this.viewer.name}`);
		} catch (e) {
			ProjectorSession.log.error(
				`Failed to dispose projector for viewer: ${this.viewer.name}, error: ${e}`
			);
		}
	}
}
