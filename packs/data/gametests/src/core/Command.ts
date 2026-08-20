import { CustomCmd } from '@bedrock-oss/stylish';
import {
	CommandPermissionLevel,
	CustomCommand,
	CustomCommandOrigin,
	CustomCommandParameter,
	CustomCommandParamType,
	CustomCommandResult,
	CustomCommandStatus,
	Player,
	system
} from '@minecraft/server';
import SessionManager from '../session/SessionManager';

/**
 * Custom cmd to open the InvSee menu for a player.
 */
@CustomCmd
export default class InvSeeCommand implements CustomCommand {
	readonly name = 'r4isen1920_invsee:invsee';
	readonly description = 'Opens the InvSee menu for the player';
	readonly permissionLevel = CommandPermissionLevel.Admin;

	readonly optionalParameters: CustomCommandParameter[] = [
		{
			name: 'player',
			type: CustomCommandParamType.PlayerSelector
		}
	];

	run(origin: CustomCommandOrigin, player?: Player[]): CustomCommandResult {
		const { sourceEntity } = origin;
		if (!sourceEntity || !sourceEntity.isValid || !(sourceEntity instanceof Player)) {
			return {
				status: CustomCommandStatus.Failure,
				message: 'This command can only be run on a player'
			};
		}

		if (player && player.length === 0) {
			return {
				status: CustomCommandStatus.Failure,
				message: 'No targets matched the selector.'
			};
		}

		if (player && player.length > 1) {
			return {
				status: CustomCommandStatus.Failure,
				message: 'Please select only one player to view their inventory.'
			};
		}

		if (player && player[0].id === sourceEntity.id) {
			return {
				status: CustomCommandStatus.Failure,
				message: 'You cannot view your own inventory.'
			};
		}

		system.run(() => {
			SessionManager.open(sourceEntity, player![0]);
		});

		return {
			status: CustomCommandStatus.Success,
			message: `Opening inventory for player ${player![0].name}.`
		};
	}
}
