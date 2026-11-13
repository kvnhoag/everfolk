import type { LifeState, WorldPack } from "../src/types.ts";
import type { FigurePathDefinition, FigurePathProgress } from "../src/figures/types.ts";
import { getFigurePathProgress } from "../src/figures/progress.ts";

/**
 * The v14 collection cards a finished life earned (design/figure-paths.md). Nothing is rolled:
 * - a historical figure's card needs that figure's contribution ladder and its separately assessed capstone.
 *   The card's rank is the figure's principal rank: the base rank, or Legendary after a successful one-shot
 *   promotion (Demetrius, Ptolemy, Zeno).
 * - a contributor card is the player's own association rank on that figure's path, never Legendary. It is
 *   Epic at most below a Legendary figure and Rare at most below an Epic one. Its male or female version
 *   follows the played character's recorded sex, which is never guessed.
 * A life that followed no figure earns no card. The verifier signs this list; the contract mints only from it.
 */

export type EarnedCardKind = "principal" | "contribution";
export interface EarnedCard {
  card_id: string;
  /** Roster figure id; one of the eleven figures with a historical path. */
  figure_id: string;
  kind: EarnedCardKind;
  /** 0 Common … 4 Legendary. */
  rarity: number;
}

const RANKS = ["common", "uncommon", "rare", "epic", "legendary"] as const;
const RANK_INDEX: Readonly<Record<string, number>> = { Common: 0, Uncommon: 1, Rare: 2, Epic: 3, Legendary: 4 };
const EPIC = 3, RARE = 2, LEGENDARY = 4;
const isSex = (value: unknown): value is "male" | "female" => value === "male" || value === "female";

function principalCardId(path: FigurePathDefinition, rarity: number): string {
  return RANK_INDEX[path.baseRank] === rarity ? `${path.id}-parent` : `${path.id}-parent-${RANKS[rarity]}`;
}

/** Highest contributor rank under this principal: Epic below a Legendary figure, Rare below an Epic one. */
function contributorCap(progress: FigurePathProgress): number {
  return progress.principalRank === "Legendary" ? EPIC : RARE;
}

function cardsFor(path: FigurePathDefinition, progress: FigurePathProgress, sex: unknown): EarnedCard[] {
  const cards: EarnedCard[] = [];
  if (progress.specialTitle) {
    const rarity = RANK_INDEX[progress.specialTitle.rank];
    cards.push({ card_id: principalCardId(path, rarity), figure_id: path.id, kind: "principal", rarity });
  }
  if (progress.associationRank && isSex(sex)) {
    const rarity = Math.min(RANK_INDEX[progress.associationRank], contributorCap(progress));
    cards.push({ card_id: `${path.id}-${RANKS[rarity]}-${sex}`, figure_id: path.id, kind: "contribution", rarity });
  }
  return cards;
}

/** Every earned card of this life, highest rank first, figure cards before contributor cards of the same rank. */
export function earnedCards(world: WorldPack, life: LifeState): EarnedCard[] {
  const cards = (world.figurePaths ?? []).flatMap(path => cardsFor(path, getFigurePathProgress(world, path, life), life.character?.sex));
  return cards.sort((a, b) => b.rarity - a.rarity || (a.kind === b.kind ? 0 : a.kind === "principal" ? -1 : 1));
}

/** Every card id a life could earn in this world, for the contract's card table and art checks. */
export function reachableEarnedCardIds(world: WorldPack): string[] {
  const ids: string[] = [];
  for (const path of world.figurePaths ?? []) {
    const base = RANK_INDEX[path.baseRank], maximum = RANK_INDEX[path.maximumRank];
    ids.push(principalCardId(path, base));
    if (maximum > base) ids.push(principalCardId(path, maximum));
    const cap = maximum === LEGENDARY ? EPIC : RARE;
    for (let rarity = 0; rarity <= cap; rarity++) for (const sex of ["male", "female"]) ids.push(`${path.id}-${RANKS[rarity]}-${sex}`);
  }
  return [...new Set(ids)];
}
