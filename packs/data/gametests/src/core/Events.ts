import { Logger } from '@bedrock-oss/bedrock-boost';
import { world } from '@minecraft/server';

import SessionManager from '../session/SessionManager';
import { Identifiers, LOG_NAMESPACE } from '../Constants';
import { InvseeMenu } from './Menu';

/** All world event subscriptions, kept in one place so the wiring is inspectable. */
export class InvseeEvents {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'InvseeEvents');

	static install(): void {
		world.afterEvents.itemStartUse.subscribe((event) => {
			if (event.itemStack.typeId !== Identifiers.ViewerItem) return;
			void InvseeMenu.open(event.source);
		});

		// The reported slot index is not trusted; a flag is enough to trigger a full diff next tick.
		world.afterEvents.playerInventoryItemChange.subscribe((event) => {
			SessionManager.markDirty(event.player.id);
		});

		world.afterEvents.entityContainerClosed.subscribe((event) => {
			const session = SessionManager.getByProjector(event.entity.id);
			if (!session) return;

			SessionManager.onContainerClosed(session);
		});

		world.afterEvents.entityRemove.subscribe((event) => {
			SessionManager.closeByProjector(event.removedEntityId);
		});

		world.afterEvents.playerLeave.subscribe((event) => {
			SessionManager.closeForViewer(event.playerId);
			SessionManager.closeForTarget(event.playerId);
		});

		world.afterEvents.playerDimensionChange.subscribe((event) => {
			SessionManager.closeForViewer(event.player.id);
		});

		InvseeEvents.log.info('Subscribed to world events');
	}
}
