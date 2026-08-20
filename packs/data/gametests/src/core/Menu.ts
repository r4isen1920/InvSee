import { Logger } from '@bedrock-oss/bedrock-boost';
import { Player, world } from '@minecraft/server';
import { ActionFormData, ModalFormData } from '@minecraft/server-ui';

import { FormTexture, LOG_NAMESPACE, TranslationKey } from '../Constants';
import SessionManager from '../session/SessionManager';

const RESET = '§r';
const BOLD = '§l';

/** Player picker and search flow for choosing whose inventory to project. */
export class InvseeMenu {
	private static readonly log = Logger.getLogger(LOG_NAMESPACE, 'InvseeMenu');

	private static readonly busy = new Set<string>();

	static async open(viewer: Player): Promise<void> {
		if (InvseeMenu.busy.has(viewer.id)) {
			InvseeMenu.log.debug(`Menu already open for viewer: ${viewer.name}, ignoring`);
			return;
		}

		InvseeMenu.busy.add(viewer.id);
		try {
			await InvseeMenu.showPicker(viewer);
		} catch (e) {
			InvseeMenu.log.error(`Menu failed for viewer: ${viewer.name}, error: ${e}`);
		} finally {
			InvseeMenu.busy.delete(viewer.id);
		}
	}

	private static async showPicker(viewer: Player): Promise<void> {
		const players = world.getAllPlayers();

		const form = new ActionFormData()
			.title({ translate: TranslationKey.Title })
			.body({ translate: TranslationKey.Body })
			.button({ translate: TranslationKey.Search }, FormTexture.Multiplayer);
		for (const player of players) form.button(player.name);

		const result = await form.show(viewer);
		if (result.canceled || result.selection === undefined) return;

		if (result.selection === 0) {
			await InvseeMenu.showSearch(viewer);
			return;
		}

		const selected = players[result.selection - 1];
		if (!selected) return;

		if (selected.id === viewer.id) {
			await InvseeMenu.showOwnInventoryNotice(viewer);
			return;
		}

		SessionManager.open(viewer, selected);
	}

	private static async showSearch(viewer: Player): Promise<void> {
		const modal = new ModalFormData()
			.title({ translate: TranslationKey.Search })
			.textField({ translate: TranslationKey.TextField }, viewer.name);

		const query = await modal.show(viewer);
		if (query.canceled || !query.formValues) {
			await InvseeMenu.showPicker(viewer);
			return;
		}

		const search = String(query.formValues[0] ?? '');
		const matches = world
			.getAllPlayers()
			.filter((player) => player.name.toLowerCase().includes(search.toLowerCase()));

		const form = new ActionFormData().title({ translate: TranslationKey.Search });
		if (matches.length === 0) {
			form.body({ translate: TranslationKey.NotFound, with: [search] }).button(
				{ translate: TranslationKey.SearchAgain },
				FormTexture.Multiplayer
			);
		} else {
			form.body({
				translate:
					matches.length > 1
						? TranslationKey.MatchFoundPlural
						: TranslationKey.MatchFoundSingular
			});
			for (const player of matches) form.button(InvseeMenu.highlight(player.name, search));
		}

		const result = await form.show(viewer);
		if (result.canceled || result.selection === undefined) {
			await InvseeMenu.showPicker(viewer);
			return;
		}

		const selected = matches[result.selection];
		if (!selected) {
			await InvseeMenu.showSearch(viewer);
			return;
		}

		if (selected.id === viewer.id) {
			await InvseeMenu.showOwnInventoryNotice(viewer);
			return;
		}

		SessionManager.open(viewer, selected);
	}

	private static async showOwnInventoryNotice(viewer: Player): Promise<void> {
		const result = await new ActionFormData()
			.title({ translate: TranslationKey.Title })
			.body({ translate: TranslationKey.OwnInventory })
			.button({ translate: TranslationKey.Back })
			.show(viewer);

		if (result.canceled) return;
		await InvseeMenu.showPicker(viewer);
	}

	private static highlight(name: string, search: string): string {
		if (!search) return name;

		const index = name.toLowerCase().indexOf(search.toLowerCase());
		if (index < 0) return name;

		const end = index + search.length;
		return `${RESET}${name.slice(0, index)}${BOLD}${name.slice(index, end)}${RESET}${name.slice(end)}${RESET}`;
	}
}
