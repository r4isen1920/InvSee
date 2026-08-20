import { EntityPulseScheduler, Logger } from '@bedrock-oss/bedrock-boost';
import { system } from '@minecraft/server';

import { Identifiers, InvseeTag, LOG_NAMESPACE } from '../Constants';
import SessionManager from './SessionManager';
import { OnWorldLoad } from '@bedrock-oss/stylish';



export default class SyncSchedulers {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'SyncSchedulers');

	/** Ticks after which unwatchable state (equipment, which has no change event) is re-checked. */
	private static readonly EQUIPMENT_POLL_PERIOD = 4;
	/** Ticks between validity checks on live projectors. */
	private static readonly HEARTBEAT_PERIOD = 20;


	private static heartbeat?: EntityPulseScheduler;



	@OnWorldLoad
	static start(): void {
		// Iterating the watch map directly; it holds one entry per watched player, so a scheduler
		// would only add churn at this period.
		system.runInterval(() => {
			for (const watch of SessionManager.getWatches()) watch.tick();
		}, 1);

		system.runInterval(() => {
			for (const watch of SessionManager.getWatches()) watch.markDirty();
		}, SyncSchedulers.EQUIPMENT_POLL_PERIOD);

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
			SyncSchedulers.HEARTBEAT_PERIOD,
			{ type: Identifiers.ProjectorEntity, tags: [InvseeTag.Projector] }
		);
		SyncSchedulers.heartbeat.start();

		SyncSchedulers.log.info(
			`Started sync loops, equipment period: ${SyncSchedulers.EQUIPMENT_POLL_PERIOD}, heartbeat period: ${SyncSchedulers.HEARTBEAT_PERIOD}`
		);
	}
}
