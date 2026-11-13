import type { LifeState, WorldPack } from "../src/types.ts";
import { figuresForWorld } from "./catalog/demo-figures.ts";
import { matchFigures } from "./match.ts";
import { rankedWorldVersion } from "./validate-ranked.ts";

/** Minimum death age required to receive booster cards. Lives ending earlier yield 0 cards. */
export const MIN_PACK_AGE = 18;
export const MIN_PACK_CARDS = 1;
export const MAX_PACK_CARDS = 5;

export interface PackCountInput {
  death_age: number;
  accomplishments: readonly unknown[];
  matched_figures: readonly unknown[];
}

/**
 * Compute how many booster cards (0, or 1–5) a finished life opens.
 * Must match Rust `contract::mint_pack::pack_card_count` byte-for-byte.
 *
 * - Death before age 18 (`death_age < 18`): 0 cards (too early).
 * - Duration base for adults (`death_age >= 18`):
 *   - 18–39: 1 card
 *   - 40–59: 2 cards
 *   - 60+:   3 cards
 * - Earned titles (`accomplishments.length + matched_figures.length`): +1 card each, capped at 5 total.
 */
export function packCardCount(evidence: PackCountInput): number {
  if (!Number.isFinite(evidence.death_age) || evidence.death_age < MIN_PACK_AGE) return 0;
  const age = Math.floor(evidence.death_age);
  const durationBase = age >= 60 ? 3 : age >= 40 ? 2 : 1;
  const titleCount = (evidence.accomplishments?.length ?? 0) + (evidence.matched_figures?.length ?? 0);
  return Math.min(MAX_PACK_CARDS, durationBase + titleCount);
}

/** Compute booster card count directly from an ended `LifeState` (for UI previews before signing). */
export function lifePackCardCount(life: LifeState, world?: Pick<WorldPack, "id" | "version">): number {
  const worldVersion = rankedWorldVersion({
    worldId: world?.id ?? life.worldId,
    worldVersion: world?.version ?? life.worldVersion,
  });
  const matched = matchFigures(life, figuresForWorld(worldVersion));
  return packCardCount({
    death_age: life.age,
    accomplishments: life.accomplishments ?? [],
    matched_figures: matched,
  });
}
