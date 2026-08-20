import { EQUIPMENT_COUNT, NameTagProtocol } from '../Constants';

/** Builds the projector nameTag that the resource pack decodes to drive the custom chest screen. */
export class NameTag {
	/** `chest_screen.json` strips exactly this many leading characters to recover the target name. */
	static readonly HEADER_LENGTH =
		NameTagProtocol.Prefix.length + EQUIPMENT_COUNT + NameTagProtocol.Separator.length;

	static readonly EXPECTED_HEADER_LENGTH = 22;

	static flagsFor(occupied: readonly boolean[]): string {
		let flags = '';
		for (let i = 0; i < EQUIPMENT_COUNT; i++) {
			flags += occupied[i] ? NameTagProtocol.Present : NameTagProtocol.Absent;
		}
		return flags;
	}

	static build(flags: string, targetName: string): string {
		return `${NameTagProtocol.Prefix}${flags}${NameTagProtocol.Separator}${targetName}`;
	}
}
