import { Logger } from '@bedrock-oss/bedrock-boost';
import {
	Container,
	Dimension,
	EntityComponentTypes,
	ItemStack,
	Player,
	PlayerCursorInventoryComponent,
	Vector3
} from '@minecraft/server';

import { LOG_NAMESPACE } from '../Constants';

/**
 * Single access point for the player cursor, which holds a stack that belongs to no container and
 * would otherwise read as a deletion from the slot it was picked up from.
 */
export class CursorGuard {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'CursorGuard');

	static component(player: Player): PlayerCursorInventoryComponent | undefined {
		if (!player.isValid) return undefined;
		return player.getComponent(EntityComponentTypes.CursorInventory);
	}

	/** Always undefined on touch controls, which have no cursor. */
	static peek(player: Player): ItemStack | undefined {
		try {
			return CursorGuard.component(player)?.item;
		} catch (e) {
			CursorGuard.log.debug(`Cursor unreadable for player: ${player.name}, error: ${e}`);
			return undefined;
		}
	}

	static isHolding(player: Player): boolean {
		return CursorGuard.peek(player) !== undefined;
	}

	/** Places the held stack before clearing it, so a partial failure duplicates rather than deletes. */
	static reclaim(
		player: Player,
		destination: Container,
		dimension: Dimension,
		location: Vector3
	): boolean {
		const cursor = CursorGuard.component(player);
		const held = CursorGuard.peek(player);
		if (!cursor || !held) return false;

		try {
			const leftover = destination.addItem(held);
			if (leftover) dimension.spawnItem(leftover, location);
			cursor.clear();
			CursorGuard.log.info(
				`Reclaimed cursor stack from player: ${player.name}, item: ${held.typeId}, amount: ${held.amount}`
			);
			return true;
		} catch (e) {
			CursorGuard.log.error(
				`Failed to reclaim cursor stack from player: ${player.name}, error: ${e}`
			);
			return false;
		}
	}
}
