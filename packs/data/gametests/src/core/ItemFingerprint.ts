import { ItemComponentTypes, ItemStack } from '@minecraft/server';

/**
 * Cheap change-detection key for a stack. Used only to decide whether a slot changed; the real
 * `ItemStack` is always transferred whole, so item fidelity never depends on this being exhaustive.
 */
export class ItemFingerprint {
	static readonly EMPTY = '';

	static of(item?: ItemStack): string {
		if (!item) return ItemFingerprint.EMPTY;

		const damage = item.getComponent(ItemComponentTypes.Durability)?.damage ?? 0;
		const enchantable = item.getComponent(ItemComponentTypes.Enchantable);
		const enchantments = enchantable
			? enchantable
					.getEnchantments()
					.map((enchantment) => `${enchantment.type.id}${enchantment.level}`)
					.sort()
					.join('+')
			: '';

		return [
			item.typeId,
			item.amount,
			damage,
			item.nameTag ?? '',
			item.getLore().join('\n'),
			enchantments
		].join('|');
	}
}
