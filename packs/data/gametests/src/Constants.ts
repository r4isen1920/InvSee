export const LOG_NAMESPACE = 'InvSee';

/** Add-On identifiers shared between the behavior pack and the scripts. */
export enum Identifiers {
	ProjectorEntity = 'r4isen1920_invsee:inventory',
	ViewerItem = 'r4isen1920_invsee:inventory'
}

export enum InvseeTag {
	Projector = 'invsee'
}

export enum DynamicProp {
	TargetId = 'r4isen1920_invsee:target',
	ViewerId = 'r4isen1920_invsee:viewer'
}

/** Wire format that `chest_screen.json` and `inventory.r4ui` decode from the projector nameTag. */
export enum NameTagProtocol {
	Prefix = '_r4ui:inventory:',
	Separator = ':',
	Present = 'a',
	Absent = 'b'
}

export enum FormTexture {
	Multiplayer = 'textures/ui/icon_multiplayer'
}

/** Translation keys defined in the behavior and resource pack lang files. */
export enum TranslationKey {
	Title = 'gui.invsee.title',
	Body = 'gui.invsee.body',
	Search = 'gui.invsee.search',
	TextField = 'gui.invsee.textField',
	NotFound = 'gui.invsee.notFound',
	MatchFoundSingular = 'gui.invsee.matchFound.singular',
	MatchFoundPlural = 'gui.invsee.matchFound.plural',
	SearchAgain = 'gui.invsee.searchAgain',
	OwnInventory = 'gui.invsee.ownInventory',
	Back = 'gui.invsee.back'
}

/** Must match `inventory_size` on the projector entity. */
export const PROJECTOR_CONTAINER_SIZE = 54;

export const PLAYER_CONTAINER_SIZE = 36;
export const HOTBAR_SIZE = 9;
export const EQUIPMENT_COUNT = 5;

/** Player container slots plus equipment slots, the coordinate space the mirror is stored in. */
export const MIRROR_SIZE = PLAYER_CONTAINER_SIZE + EQUIPMENT_COUNT;
