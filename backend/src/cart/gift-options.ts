export type GiftSelection = { giftWrapSelected: boolean; giftMessage: string | null };

export function giftSelection(value: unknown): GiftSelection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { giftWrapSelected: false, giftMessage: null };
  const row = value as Record<string, unknown>;
  const selected = row.giftWrapSelected === true;
  return { giftWrapSelected: selected, giftMessage: selected && typeof row.giftMessage === 'string' ? row.giftMessage.trim().slice(0, 250) || null : null };
}
