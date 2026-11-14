/**
 * Per-design rarity supply, as the lives contract enforces it (contract/src/rarity_caps.rs): each card design
 * (a historical figure, or a city person's deed) has at most 10 Legendary, 25 Epic and 100 Rare copies;
 * Common and Uncommon are unlimited.
 */
export const RARITY_CAPS: readonly (number | null)[] = Object.freeze([null, null, 100, 25, 10]);

/** The design a card is counted under: its historical figure, or else the deed of a person of the city. */
export function designKey(figureId: string | null | undefined, npcActionId: string): string {
  return figureId ? `figure:${figureId}` : `npc:${npcActionId}`;
}

/** Rarity odds with sold-out tiers removed; `taken(rarity)` counts minted copies plus copies held in opened packs. */
export function openRarityWeights(weights: readonly number[], taken: (rarity: number) => number): number[] {
  return weights.map((weight, rarity) => {
    const cap = RARITY_CAPS[rarity];
    return cap === null || cap === undefined || taken(rarity) < cap ? weight : 0;
  });
}

export function raritySupplyText(rarity: number, taken: number): string {
  const cap = RARITY_CAPS[rarity];
  if (cap === null || cap === undefined) return "Unlimited";
  const left = Math.max(0, cap - taken);
  return left === 0 ? "Sold out" : `${left} of ${cap} left`;
}
