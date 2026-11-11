import type { LifeState, WorldPack } from "../../src/types.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";
import { householdView } from "../../src/demo/household.ts";
import { isDemoWorld } from "./screen.ts";
import { RESOURCE_IDS, RESOURCES } from "./resources.ts";
import type { ResourceId } from "./resources.ts";

export interface StorehouseFlow { text: string; delta: number }
export interface StorehouseRow {
  id: ResourceId; label: string; icon: string; amount: number;
  capacity: number | null; coming: StorehouseFlow[]; lastYear: string[];
}

const GRAIN_AND_FLAX: readonly ResourceId[] = ["grain", "flax"];
const TRADE_IDS = ["market-trade", "market-household-buy", "army-sale", "offer-settled"];

/** Journal id prefix -> resources it touches. Prefix match, so `army-wages` matches `army-wage`. */
const JOURNAL_RESOURCES: readonly { prefix: string; resources: readonly ResourceId[] }[] = [
  { prefix: "household-harvest", resources: GRAIN_AND_FLAX },
  ...["household-rent", "household-eat", "household-hunger", "household-bought-grain", "household-spoilage", "convoy-loss"]
    .map(prefix => ({ prefix, resources: ["grain"] as const })),
  { prefix: "household-spinning", resources: ["flax", "linen"] },
  ...["household-feed-ox", "household-ox-died"].map(prefix => ({ prefix, resources: ["ox"] as const })),
  ...["household-feed-donkey", "household-donkey-died"].map(prefix => ({ prefix, resources: ["donkey"] as const })),
  ...["army-wage", "convoy-paid", "convoy-pay-shortfall"].map(prefix => ({ prefix, resources: ["drachmas"] as const })),
];

function mentioned(text: string): ResourceId[] {
  const lower = text.toLowerCase();
  return RESOURCE_IDS.filter(id => lower.includes(RESOURCES[id].label.toLowerCase()));
}

function touches(entry: { id: string; text: string }): ResourceId[] {
  if (TRADE_IDS.some(prefix => entry.id.startsWith(prefix))) return ["drachmas", ...mentioned(entry.text)];
  return JOURNAL_RESOURCES.filter(rule => entry.id.startsWith(rule.prefix)).flatMap(rule => rule.resources);
}

function lastYearLines(life: LifeState): Record<ResourceId, string[]> {
  const lines = Object.fromEntries(RESOURCE_IDS.map(id => [id, [] as string[]])) as Record<ResourceId, string[]>;
  for (const entry of life.journal) {
    if (entry.age !== life.age) continue;
    for (const id of new Set(touches(entry))) lines[id] = [...lines[id], entry.text];
  }
  return lines;
}

function flows(entries: readonly [string, number][]): StorehouseFlow[] {
  return entries.filter(([, delta]) => delta !== 0).map(([label, delta]) => ({ text: label, delta }));
}

/** Read-only household view of every resource; null when the world has no demo economy. */
export function storehouseRows(world: WorldPack, life: LifeState): StorehouseRow[] | null {
  if (!isDemoWorld(world) || !world.demo || !life.demo) return null;
  const typed = life as LifeStateWithDemo;
  const view = householdView(world.demo, typed);
  const { household, goods } = typed.demo;
  const amounts: Record<ResourceId, number> = {
    grain: household.grain, flax: household.flax, linen: goods.linen, drachmas: life.economy?.cash ?? 0,
    ox: household.animals.ox, donkey: household.animals.donkey, silver: goods.silver, gold: goods.gold, silk: goods.silk,
    labour: view.labour, reputation: typed.demo.reputation,
  };
  const coming: Partial<Record<ResourceId, StorehouseFlow[]>> = {
    grain: flows([["Harvest", view.expectedHarvest], ["Rent", -view.expectedRent], ["Eating", -view.expectedEating], ["Spoilage", -view.expectedSpoilage]]),
    flax: flows([["Flax harvest", view.expectedFlax]]),
  };
  const last = lastYearLines(life);
  return RESOURCE_IDS.map(id => ({
    id, label: RESOURCES[id].label, icon: RESOURCES[id].icon, amount: amounts[id],
    capacity: id === "grain" ? view.capacity : null, coming: coming[id] ?? [], lastYear: last[id],
  }));
}
