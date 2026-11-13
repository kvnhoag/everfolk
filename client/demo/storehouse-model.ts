import type { LifeState, WorldPack } from "../../src/types.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";
import { householdView } from "../../src/demo/household.ts";
import { RESOURCE_IDS, RESOURCES } from "./resources.ts";
import type { ResourceId } from "./resources.ts";
import { ledgerFlows, type LedgerFlow } from "./ledger-flows.ts";
import { grainStoreAlert, spoilageNote, type GrainStoreAlert } from "./grain-store-alert.ts";
import { tuning } from "../../src/demo/market-rules.ts";
import { PLANTING_HINT_AGE } from "../models/tutorial-triggers.ts";

export interface StorehouseFlow { text: string; delta: number; icon: string; /** Why it happens, for the chip's tooltip. */ hint?: string }
export interface StorehouseRow {
  id: ResourceId; label: string; icon: string; amount: number;
  capacity: number | null; coming: StorehouseFlow[];
  /** Last year's settled journal lines that touched this resource, as written. */
  lastYear: string[];
  /** The same lines read as signed movements, for icon chips. */
  lastYearFlows: LedgerFlow[];
  /** Grain only: the store is, or will be by harvest, over its limit. */
  alert?: GrainStoreAlert | null;
}

const GRAIN_AND_FLAX: readonly ResourceId[] = ["grain", "flax"];
const TRADE_IDS = ["market-trade", "market-household-buy", "army-sale", "offer-settled"];

/** Journal id prefix -> resources it touches. Prefix match, so `army-wages` matches `army-wage`. */
const JOURNAL_RESOURCES: readonly { prefix: string; resources: readonly ResourceId[] }[] = [
  { prefix: "household-harvest", resources: GRAIN_AND_FLAX },
  ...["household-rent", "household-eat", "household-hunger", "household-bought-grain", "household-spoilage", "convoy-loss"]
    .map(prefix => ({ prefix, resources: ["grain"] as const })),
  { prefix: "household-rent-flax", resources: ["flax"] },
  { prefix: "household-spinning", resources: ["flax", "linen"] },
  { prefix: "household-feed-ox", resources: ["ox", "grain"] },
  { prefix: "household-feed-donkey", resources: ["donkey", "grain"] },
  { prefix: "household-ox-died", resources: ["ox"] },
  { prefix: "household-donkey-died", resources: ["donkey"] },
  ...["army-wage", "convoy-paid", "convoy-pay-shortfall"].map(prefix => ({ prefix, resources: ["drachmas"] as const })),
];

/** Whole-word, case-insensitive label match; tolerates a plural "s" and the irregular "oxen". */
export function mentionedResources(text: string): ResourceId[] {
  return RESOURCE_IDS.filter(id => new RegExp(`\\b${RESOURCES[id].label}(?:s|(?<=ox)en)?\\b`, "i").test(text));
}

function touches(entry: { id: string; text: string }): ResourceId[] {
  if (TRADE_IDS.some(prefix => entry.id.startsWith(prefix))) return ["drachmas", ...mentionedResources(entry.text)];
  // The most specific rule wins, so "household-rent-flax" is flax rent, not grain rent.
  const rules = JOURNAL_RESOURCES.filter(rule => entry.id.startsWith(rule.prefix));
  const longest = Math.max(0, ...rules.map(rule => rule.prefix.length));
  return rules.filter(rule => rule.prefix.length === longest).flatMap(rule => rule.resources);
}

interface LastYear { lines: string[]; flows: LedgerFlow[] }

function lastYearLines(life: LifeState): Record<ResourceId, LastYear> {
  const record = Object.fromEntries(RESOURCE_IDS.map(id => [id, { lines: [], flows: [] } as LastYear])) as Record<ResourceId, LastYear>;
  // In-year trades have the same age as the harvest, but follow the settlement block.
  let end = life.journal.length - 1;
  while (end >= 0 && !(life.journal[end].age === life.age && JOURNAL_RESOURCES.some(rule => life.journal[end].id.startsWith(rule.prefix)))) end--;
  for (const entry of life.journal.slice(0, end + 1)) {
    if (entry.age !== life.age) continue;
    const touched = [...new Set(touches(entry))];
    const read = ledgerFlows(entry, touched, mentionedResources);
    for (const id of touched) record[id] = { lines: [...record[id].lines, entry.text], flows: [...record[id].flows, read[id]!] };
  }
  return record;
}

function flows(entries: readonly [string, number, string][]): StorehouseFlow[] {
  return entries.filter(([, delta]) => delta !== 0).map(([label, delta, icon]) => ({ text: label, delta, icon }));
}

/** Read-only household view of every resource; null when the world has no demo economy. */
export function storehouseRows(world: WorldPack, life: LifeState): StorehouseRow[] | null {
  if (!world.demo || !life.demo) return null;
  const typed = life as LifeStateWithDemo;
  const view = householdView(world.demo, typed, world);
  const { household, goods } = typed.demo;
  const amounts: Record<ResourceId, number> = {
    grain: household.grain, flax: household.flax, linen: goods.linen, drachmas: life.economy?.cash ?? 0,
    ox: household.animals.ox, donkey: household.animals.donkey, silver: goods.silver, gold: goods.gold, silk: goods.silk,
    labour: view.labour, reputation: typed.demo.reputation,
  };
  const rates = { capacity: view.capacity, spoilageBps: world.demo.household.spoilageBps, overCapacitySpoilageBps: world.demo.household.overCapacitySpoilageBps };
  const alert = grainStoreAlert({ ...rates, grain: view.grain, expectedHarvest: view.expectedHarvest, expectedRent: view.expectedRent,
    expectedEating: view.expectedEating, age: life.age, tradeAge: tuning(world.demo.market).minTradeAge, plantingAge: PLANTING_HINT_AGE });
  const coming: Partial<Record<ResourceId, StorehouseFlow[]>> = {
    grain: flows([["Harvest", view.expectedHarvest, "res-grain"], ["Rent", -view.expectedRent, "home"], ["Eating", -view.expectedEating, "flow-eat"], ["Spoilage", -view.expectedSpoilage, "flow-spoil"]])
      .map(flow => flow.text === "Spoilage" ? { ...flow, hint: spoilageNote(rates) } : flow),
    flax: flows([["Harvest", view.expectedFlax, "res-flax"]]),
  };
  const last = lastYearLines(life);
  return RESOURCE_IDS.map(id => ({
    id, label: RESOURCES[id].label, icon: RESOURCES[id].icon, amount: amounts[id],
    capacity: id === "grain" ? view.capacity : null, coming: coming[id] ?? [], lastYear: last[id].lines, lastYearFlows: last[id].flows,
    ...(id === "grain" ? { alert } : {}),
  }));
}
