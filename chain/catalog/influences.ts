import type { InfluenceEntry } from "./influence-entry.ts";
import { deepFreeze } from "./content.ts";
import { FIGURE_INFLUENCES } from "./figure-influences.ts";
import { NPC_INFLUENCES } from "./npc-influences.ts";

/** One entry per action id in chain/ids.ts; deep-frozen so callers cannot change the catalog. */
export const INFLUENCES: readonly InfluenceEntry[] = deepFreeze([...FIGURE_INFLUENCES, ...NPC_INFLUENCES]);

const influenceById = new Map(INFLUENCES.map(entry => [entry.id, entry]));

export function influenceFor(actionId: string): InfluenceEntry {
  const entry = influenceById.get(actionId);
  if (!entry) throw new Error(`Unknown influence entry: ${actionId}`);
  return entry;
}
