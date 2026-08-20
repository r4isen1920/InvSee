import { Logger, LogLevel } from '@bedrock-oss/bedrock-boost';
import { system, world } from '@minecraft/server';

import { LOG_NAMESPACE } from './Constants';
import { NameTag } from './core/NameTag';
import { InvseeEvents } from './events/InvseeEvents';
import { SessionManager } from './session/SessionManager';
import { SyncSchedulers } from './sync/SyncSchedulers';

export class Bootstrap {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'Bootstrap');

	static start(): void {
		Logger.setLevel(LogLevel.Info);
		Logger.setBasicTimestampFormatter();

		if (NameTag.HEADER_LENGTH !== NameTag.EXPECTED_HEADER_LENGTH) {
			Bootstrap.log.error(
				`NameTag header length: ${NameTag.HEADER_LENGTH} does not match what chest_screen.json strips: ${NameTag.EXPECTED_HEADER_LENGTH}`
			);
		}

		InvseeEvents.install();

		// Dimension lookups are illegal during early execution, so anything that queries the world
		// waits for the load event.
		world.afterEvents.worldLoad.subscribe(() => {
			system.run(() => {
				SyncSchedulers.start();
				SessionManager.sweepOrphans();
			});
		});

		Bootstrap.log.info('InvSee initialized');
	}
}
