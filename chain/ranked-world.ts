import { figureMediaUrl } from "./figure-media.ts";
import type { WorldPack } from "../src/types.ts";
import { FIGURES, INFLUENCES } from "./catalog/index.ts";
import { FIGURE_ACTIONS, FIGURE_IDS, NPC_ACTIONS, RANKED_WORLD_VERSION } from "./ids.ts";

/** `${RANKED_WORLD_ID}-${RANKED_WORLD_PACK_VERSION}` is the version string the contract records for ranked lives. */
export const RANKED_WORLD_ID = "alexandria";
export const RANKED_WORLD_PACK_VERSION = "ranked-1";

if (`${RANKED_WORLD_ID}-${RANKED_WORLD_PACK_VERSION}` !== RANKED_WORLD_VERSION) {
  throw new Error("The ranked world id and version must spell RANKED_WORLD_VERSION.");
}

/** Contract CatalogConfig (contract/src/types.rs), uploaded with `set_catalog`. */
export interface ContractCatalog {
  figures: { figure_id: string; title: string; media: string; supply_cap: number; action_ids: string[] }[];
  npc_actions: { action_id: string; career_group: string; category: string }[];
}

/** The base pack with the influence catalog added under the ranked id and version; nothing else changes. */
export function buildRankedWorld(base: WorldPack): WorldPack {
  return { ...structuredClone(base), id: RANKED_WORLD_ID, version: RANKED_WORLD_PACK_VERSION, influences: structuredClone([...INFLUENCES]) };
}

export function buildContractCatalog(mediaBaseUrl?: string): ContractCatalog {
  return {
    figures: FIGURE_IDS.map(id => {
      const figure = FIGURES.find(item => item.figure === id);
      if (!figure) throw new Error(`Figure ${id} has no requirement in the catalog.`);
      return { figure_id: id, title: figure.title, media: figureMediaUrl(id, mediaBaseUrl), supply_cap: figure.supplyCap, action_ids: [...FIGURE_ACTIONS[id]] };
    }),
    npc_actions: Object.entries(NPC_ACTIONS).flatMap(([group, { category, actions }]) =>
      actions.map(action_id => ({ action_id, career_group: group, category }))),
  };
}
