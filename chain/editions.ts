/** Per-card edition caps by rarity index: Common through Legendary. */
export const RARITY_EDITION_LIMITS = [null, null, 100, 25, 10] as const;

export function editionLimit(rarity: number): number | null {
  if (!Number.isInteger(rarity) || rarity < 0 || rarity >= RARITY_EDITION_LIMITS.length) throw new Error("Unknown card rarity.");
  return RARITY_EDITION_LIMITS[rarity];
}

/**
 * Stable card-design identity. An owner, token id, name or life id never splits an edition.
 * An earned v14 collection card is its own design (`card:<card_id>`), as the contract counts it
 * (contract/src/card_art.rs); rolled cards from worlds without figure paths keep the earlier designs.
 */
export function editionKey(input: {
  figure_id: string | null;
  career_group: string;
  rarity: number;
  card_id?: string | null;
  stage_id?: string;
  stage_record?: { district: string; field: string | null; tier: string | number };
}): string {
  editionLimit(input.rarity);
  const card = input.card_id ? `card:${input.card_id}` : input.figure_id ? `figure:${input.figure_id}` : input.stage_id && input.stage_record
    ? `stage:${JSON.stringify([input.stage_id, input.stage_record.district, input.stage_record.field ?? null, input.stage_record.tier])}`
    : `npc:${input.career_group}`;
  return `${card}:rarity:${input.rarity}`;
}
