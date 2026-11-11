import type { Category } from "../ids.ts";
import table from "./key-decisions.json" with { type: "json" };

/**
 * Pack decision event id → the NPC category drawn on chain when that decision is pending.
 * Authored in key-decisions.json; every id is a choice event of the ranked world.
 * If one event in an exclusive group is listed, every alternative is listed in the same category,
 * so the draw does not depend on which sibling the seed offers.
 */
export const KEY_DECISIONS: Readonly<Record<string, Category>> = Object.freeze({ ...table as Record<string, Category> });

export function keyDecisionCategory(eventId: string): Category | null {
  return Object.hasOwn(KEY_DECISIONS, eventId) ? KEY_DECISIONS[eventId] : null;
}
