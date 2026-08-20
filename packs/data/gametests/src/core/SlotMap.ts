import { EquipmentSlot } from '@minecraft/server';

import {
	EQUIPMENT_COUNT,
	HOTBAR_SIZE,
	MIRROR_SIZE,
	PLAYER_CONTAINER_SIZE,
	PROJECTOR_CONTAINER_SIZE
} from '../Constants';

const MAIN_SIZE = PLAYER_CONTAINER_SIZE - HOTBAR_SIZE;
const EQUIPMENT_BASE = 45;

/**
 * Translates between the target's slot space (container 0-35 plus equipment) and the projector
 * container layout that `inventory.r4ui` renders.
 */
export class SlotMap {
	/** Mirror indices 36-40, in the order the nameTag armor flags are read. */
	static readonly EQUIPMENT_ORDER: readonly EquipmentSlot[] = [
		EquipmentSlot.Head,
		EquipmentSlot.Chest,
		EquipmentSlot.Legs,
		EquipmentSlot.Feet,
		EquipmentSlot.Offhand
	];

	/** Slots the UI never renders, where a quick-moved item would silently vanish. */
	static readonly UNMAPPED_PROJECTOR_SLOTS: readonly number[] = SlotMap.buildUnmapped();

	static toProjector(mirrorIndex: number): number {
		if (mirrorIndex < HOTBAR_SIZE) return MAIN_SIZE + mirrorIndex;
		if (mirrorIndex < PLAYER_CONTAINER_SIZE) return mirrorIndex - HOTBAR_SIZE;
		return EQUIPMENT_BASE + (mirrorIndex - PLAYER_CONTAINER_SIZE);
	}

	static toMirror(projectorSlot: number): number | undefined {
		if (projectorSlot < MAIN_SIZE) return projectorSlot + HOTBAR_SIZE;
		if (projectorSlot < PLAYER_CONTAINER_SIZE) return projectorSlot - MAIN_SIZE;
		if (projectorSlot >= EQUIPMENT_BASE && projectorSlot < EQUIPMENT_BASE + EQUIPMENT_COUNT) {
			return PLAYER_CONTAINER_SIZE + (projectorSlot - EQUIPMENT_BASE);
		}
		return undefined;
	}

	static isEquipment(mirrorIndex: number): boolean {
		return mirrorIndex >= PLAYER_CONTAINER_SIZE && mirrorIndex < MIRROR_SIZE;
	}

	static equipmentSlotFor(mirrorIndex: number): EquipmentSlot | undefined {
		return SlotMap.EQUIPMENT_ORDER[mirrorIndex - PLAYER_CONTAINER_SIZE];
	}

	private static buildUnmapped(): number[] {
		const slots: number[] = [];
		for (let slot = 0; slot < PROJECTOR_CONTAINER_SIZE; slot++) {
			if (SlotMap.toMirror(slot) === undefined) slots.push(slot);
		}
		return slots;
	}
}
