import { Logger } from '@bedrock-oss/bedrock-boost';
import { Player, system, world } from '@minecraft/server';

import { Identifiers, InvseeTag, LOG_NAMESPACE } from '../Constants';
import { CursorGuard } from './CursorGuard';
import { ProjectorSession } from './ProjectorSession';
import { TargetWatch } from './TargetWatch';

/** Owns every live projection and the lifecycle rules that tear them down. */
export class SessionManager {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'SessionManager');

	private static readonly watches = new Map<string, TargetWatch>();
	private static readonly byViewer = new Map<string, ProjectorSession>();
	private static readonly byProjector = new Map<string, ProjectorSession>();

	static open(viewer: Player, target: Player): boolean {
		SessionManager.closeForViewer(viewer.id);

		const session = ProjectorSession.create(viewer, target);
		if (!session) return false;

		let watch = SessionManager.watches.get(target.id);
		if (!watch) {
			watch = new TargetWatch(target);
			SessionManager.watches.set(target.id, watch);
		}

		watch.addSession(session);
		SessionManager.byViewer.set(viewer.id, session);
		SessionManager.byProjector.set(session.entity.id, session);
		return true;
	}

	static getWatches(): TargetWatch[] {
		return Array.from(SessionManager.watches.values());
	}

	static getByProjector(entityId: string): ProjectorSession | undefined {
		return SessionManager.byProjector.get(entityId);
	}

	static markDirty(playerId: string): void {
		SessionManager.watches.get(playerId)?.markDirty();
	}

	/**
	 * The screen closing does not end the projection, but it is the moment a half-finished drag has
	 * to be resolved, so the settle pass runs here too.
	 */
	static onContainerClosed(session: ProjectorSession): void {
		session.isOpen = false;
		system.run(() => SessionManager.settle(session));
	}

	static closeForViewer(viewerId: string): void {
		const session = SessionManager.byViewer.get(viewerId);
		if (session) SessionManager.close(session);
	}

	static closeForTarget(targetId: string): void {
		const watch = SessionManager.watches.get(targetId);
		if (!watch) return;

		SessionManager.log.info(`Target left, closing sessions for target: ${targetId}`);
		for (const session of [...watch.getSessions()]) SessionManager.close(session);
	}

	static closeByProjector(entityId: string): void {
		const session = SessionManager.byProjector.get(entityId);
		if (session) SessionManager.close(session);
	}

	/** Removes projectors left behind by a crash, reload, or unclean shutdown. */
	static sweepOrphans(): void {
		let removed = 0;
		for (const dimensionId of [
			'minecraft:overworld',
			'minecraft:nether',
			'minecraft:the_end'
		]) {
			const entities = world.getDimension(dimensionId).getEntities({
				type: Identifiers.ProjectorEntity,
				tags: [InvseeTag.Projector]
			});

			for (const entity of entities) {
				if (SessionManager.byProjector.has(entity.id)) continue;
				entity.remove();
				removed++;
			}
		}

		if (removed > 0) SessionManager.log.info(`Swept orphaned projectors, count: ${removed}`);
	}

	private static close(session: ProjectorSession): void {
		session.isOpen = false;
		SessionManager.byViewer.delete(session.viewer.id);
		SessionManager.byProjector.delete(session.entity.id);

		SessionManager.settle(session);

		const watch = SessionManager.watches.get(session.targetId);
		watch?.removeSession(session);
		if (watch?.isEmpty) SessionManager.watches.delete(session.targetId);

		session.dispose();
	}

	/**
	 * Commits whatever the viewer left behind: pending slot edits first, then any stack still stuck
	 * on their cursor, routed by which side it was lifted from.
	 */
	private static settle(session: ProjectorSession): void {
		if (!session.isValid) return;

		const watch = SessionManager.watches.get(session.targetId);
		if (!watch) return;

		const held = CursorGuard.peek(session.viewer);
		const belongsToTarget = held ? watch.claimsFromTarget(session, held) : false;

		watch.push(session);
		session.reclaimUnmappedSlots();

		if (!held) return;

		const targetContainer = watch.targetContainer;
		if (belongsToTarget && targetContainer && watch.target.isValid) {
			CursorGuard.reclaim(
				session.viewer,
				targetContainer,
				watch.target.dimension,
				watch.target.location
			);
			watch.markDirty();
			return;
		}

		session.reclaimCursor();
	}
}
