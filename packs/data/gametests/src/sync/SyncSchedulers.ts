import { EntityPulseScheduler, Logger } from '@bedrock-oss/bedrock-boost';
import { system } from '@minecraft/server';

import { Identifiers, InvseeTag, LOG_NAMESPACE } from '../Constants';
import { SessionManager } from '../session/SessionManager';

/** Ticks after which unwatchable state (equipment, which has no change event) is re-checked. */
const EQUIPMENT_POLL_PERIOD = 4;

/** Ticks between validity checks on live projectors. */
const HEARTBEAT_PERIOD = 20;

export class SyncSchedulers {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'SyncSchedulers');

	private static heartbeat?: EntityPulseScheduler;

	static start(): void {
		// Iterating the watch map directly; it holds one entry per watched player, so a scheduler
		// would only add churn at this period.
		system.runInterval(() => {
			for (const watch of SessionManager.getWatches()) watch.tick();
		}, 1);

		system.runInterval(() => {
			for (const watch of SessionManager.getWatches()) watch.markDirty();
		}, EQUIPMENT_POLL_PERIOD);

		SyncSchedulers.heartbeat = new EntityPulseScheduler(
			(entity) => {
				const session = SessionManager.getByProjector(entity.id);
				if (!session) {
					entity.remove();
					SyncSchedulers.log.warn(`Removed orphaned projector, id: ${entity.id}`);
					return;
				}

				if (session.isAbandoned) SessionManager.closeByProjector(entity.id);
			},
			HEARTBEAT_PERIOD,
			{ type: Identifiers.ProjectorEntity, tags: [InvseeTag.Projector] }
		);
		SyncSchedulers.heartbeat.start();

		SyncSchedulers.log.info(
			`Started sync loops, equipment period: ${EQUIPMENT_POLL_PERIOD}, heartbeat period: ${HEARTBEAT_PERIOD}`
		);
	}
}
