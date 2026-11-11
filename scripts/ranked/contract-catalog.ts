// Prints the contract's CatalogConfig JSON. Uses chain/catalog/contract-catalog.json (lane C2) when present,
// otherwise a placeholder catalog built from chain/ids.ts.
import { existsSync, readFileSync } from "node:fs";
import { FIGURE_ACTIONS, FIGURE_IDS, NPC_ACTIONS } from "../../chain/ids.ts";

const AUTHORED = new URL("../../chain/catalog/contract-catalog.json", import.meta.url);
const TITLES: Record<string, string> = { alexander: "Alexander", aristotle: "Aristotle", euclid: "Euclid", cleomenes: "Cleomenes" };
const SUPPLY_CAP = 5;

function placeholderCatalog() {
  return {
    figures: FIGURE_IDS.map(id => ({ figure_id: id, title: TITLES[id], media: "", supply_cap: SUPPLY_CAP, action_ids: [...FIGURE_ACTIONS[id]] })),
    npc_actions: Object.entries(NPC_ACTIONS).flatMap(([group, { category, actions }]) =>
      actions.map(action_id => ({ action_id, career_group: group, category }))),
  };
}

process.stdout.write(JSON.stringify(existsSync(AUTHORED) ? JSON.parse(readFileSync(AUTHORED, "utf8")) : placeholderCatalog()));
