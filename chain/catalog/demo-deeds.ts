import type { InfluenceEntry } from "./influence-entry.ts";
import type { WorldPack } from "../../src/types.ts";
import { DEMO_WORLD_VERSION, NPC_ACTIONS, type CareerGroup, type Category } from "../ids.ts";

/** Deeds that do not fit the one-category-per-group table. Existing action ids are untouched. */
export const DEMO_EXTRA_ACTIONS = [
  { action_id: "military.guard-road", career_group: "military", category: "road" },
] as const satisfies readonly { action_id: string; career_group: CareerGroup; category: Category }[];

export const DEMO_DEED_IDS = [
  "farming.stock-granary",
  "farming.share-seed",
  "military.guard-road",
] as const;

/** Grain a granary deed puts in the store at Common (1×). Two adult rations; rarity scaling is an engine request. */
export const GRANARY_GRAIN = 480;
/** Next-harvest bonus from shared seed, in basis points, at Common. */
export const SEED_BONUS_BPS = 1500;
/** Road-risk cut from a patrol deed, in basis points, at Common. */
export const PATROL_RISK_CUT_BPS = 2000;

const grain = (delta: number, cause: string): InfluenceEntry["effects"] => [
  { type: "demo", effect: { kind: "grain", delta, cause } },
];

export const DEMO_DEED_INFLUENCES: readonly InfluenceEntry[] = [
  {
    id: "farming.stock-granary",
    label: "A granary kept from an earlier life opens, and grain reaches your store.",
    baseWeight: 3,
    effects: grain(GRANARY_GRAIN, "granary"),
  },
  {
    id: "farming.share-seed",
    label: "Seed from an earlier life arrives on easy terms, and the next harvest is fuller.",
    baseWeight: 1,
    effects: [{ type: "demo", effect: { kind: "harvest-bonus", bps: SEED_BONUS_BPS } }],
  },
  {
    id: "military.guard-road",
    label: "A patrol from an earlier life watches the road, and the convoy runs a safer course.",
    baseWeight: 3,
    effects: [{ type: "demo", effect: { kind: "convoy", action: "depart", riskCutBps: PATROL_RISK_CUT_BPS } }],
  },
];

export interface NpcActionRecord { action_id: string; career_group: CareerGroup; category: Category }

/** Ranked actions plus the demo deeds. Ranked action ids and categories are unchanged. */
export function npcActionRecords(): NpcActionRecord[] {
  const ranked = Object.entries(NPC_ACTIONS).flatMap(([group, { category, actions }]) =>
    actions.map(action_id => ({ action_id, career_group: group as CareerGroup, category })));
  return [...ranked, ...DEMO_EXTRA_ACTIONS];
}

const byAction = new Map(npcActionRecords().map(record => [record.action_id, record]));

export function groupOfNpcAction(actionId: string): CareerGroup | null {
  return byAction.get(actionId)?.career_group ?? null;
}

export function categoryOfNpcAction(actionId: string): Category | null {
  return byAction.get(actionId)?.category ?? null;
}

/** Deeds a newly minted person of this career can take, including a military road patrol. */
export function actionsForGroup(group: CareerGroup): readonly string[] {
  return npcActionRecords().filter(record => record.career_group === group).map(record => record.action_id);
}

/** Appends demo deeds to a demo world that does not yet carry them. Ranked worlds are returned unchanged. */
export function ensureDemoDeeds(world: WorldPack): WorldPack {
  if (world.version !== DEMO_WORLD_VERSION) return world;
  const have = new Set((world.influences ?? []).map(entry => entry.id));
  const missing = DEMO_DEED_INFLUENCES.filter(entry => !have.has(entry.id));
  if (missing.length === 0) return world;
  return { ...world, influences: [...(world.influences ?? []), ...structuredClone(missing)] };
}
