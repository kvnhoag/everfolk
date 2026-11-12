import { applyStatDelta } from "../../src/progression.ts";
import { marketQuote } from "../../src/market.ts";
import { initialTown } from "../../src/demo/market.ts";
import { TRADE_ITEMS } from "../../src/demo/types.ts";
import type { Effect, WorldPack } from "../../src/types.ts";

export interface UniformRoll { first: number; step: number; count: number }

/** Weighted households with sorted cash values and independent resource rolls. */
export interface SocietyWealthGroup {
  weight: number;
  count: number;
  wealthAt: (index: number) => number;
  resources: UniformRoll[];
}

export type SocietyBenchmarkKind = "recorded-lives" | "authored-households";

export interface SocietyBenchmarkInfo {
  kind: SocietyBenchmarkKind;
  description: string;
  sampleCount: number;
}

/** In-memory store for recorded player life net worth observations per world and revision. */
const recordedObservations = new Map<string, number[]>();

function observationKey(worldId: string, worldVersion: string): string {
  return `${worldId}::${worldVersion}`;
}

/** Record a player life net-worth observation for a specific world and compatible revision. */
export function recordWealthObservation(worldId: string, worldVersion: string, netWorth: number): void {
  if (!Number.isFinite(netWorth)) return;
  const key = observationKey(worldId, worldVersion);
  const existing = recordedObservations.get(key) ?? [];
  existing.push(Math.round(netWorth));
  recordedObservations.set(key, existing);
}

/** Retrieve all net-worth observations for a specific world revision. */
export function getRecordedWealthObservations(worldId: string, worldVersion: string): readonly number[] {
  return recordedObservations.get(observationKey(worldId, worldVersion)) ?? [];
}

/** Clear all recorded net-worth observations (primarily for test isolation). */
export function clearRecordedWealthObservations(): void {
  recordedObservations.clear();
}

/** Retrieve metadata describing whether the society comparison is based on recorded lives or authored fallback. */
export function getSocietyWealthBenchmarkInfo(world: WorldPack, explicitObservations?: readonly number[]): SocietyBenchmarkInfo {
  const observations = explicitObservations ?? (world ? getRecordedWealthObservations(world.id, world.version) : []);
  if (observations.length > 0) {
    return {
      kind: "recorded-lives",
      description: `Based on ${observations.length} recorded player ${observations.length === 1 ? "life" : "lives"} in this world revision.`,
      sampleCount: observations.length,
    };
  }
  return {
    kind: "authored-households",
    description: "Based on starting household distributions (game population benchmark).",
    sampleCount: world?.origins?.length ?? 0,
  };
}

/** Retrieve the population used for the society percentile and median wealth. */
export function getSocietyWealthData(world: WorldPack, explicitObservations?: readonly number[]): SocietyWealthGroup[] {
  const observations = explicitObservations ?? getRecordedWealthObservations(world.id, world.version);
  if (observations.length > 0) {
    const sorted = [...observations].sort((a, b) => a - b);
    return [{
      weight: 1,
      count: sorted.length,
      wealthAt: (index: number) => sorted[index],
      resources: [],
    }];
  }
  return getMockSocietyWealthData(world);
}

/** Authored starting households stand in for player-life data for now. */
function getMockSocietyWealthData(world: WorldPack): SocietyWealthGroup[] {
  const economy = world.economy;
  if (!economy) return [];
  const definition = world.stats[economy.stat];
  const maximumWeight = Math.max(...world.origins.map(origin => origin.weight));
  const startingResources = world.demo?.startingResources;
  const demoPrices = world.demo && startingResources ? initialTown(world.demo).prices : undefined;
  return world.origins.map(origin => {
    const range = origin.statRanges?.[economy.stat] ?? definition.initialRange;
    const first = range?.min ?? definition.initial;
    const count = range ? range.max - range.min + 1 : 1;
    const effects: Extract<Effect, { type: "stat" }>[] = [];
    for (const effect of origin.effects) {
      if (effect.type === "end") break;
      if (effect.type === "stat" && effect.stat === economy.stat) effects.push(effect);
    }
    const resources = economy.assets.map(asset => {
      const range = origin.assetRanges?.[asset.id] ?? asset.initialRange ?? { min: 0, max: 0 };
      const unitPrice = marketQuote(world, { age: 0, lastEventAge: {}, eventCounts: {} }, asset.id).sell;
      return { first: range.min * unitPrice, step: unitPrice, count: range.max - range.min + 1 };
    });
    if (startingResources && demoPrices) for (const item of TRADE_ITEMS) {
      const range = startingResources.origins?.[origin.id]?.[item] ?? startingResources.defaults[item];
      const unitPrice = demoPrices[item].buy;
      resources.push({ first: range.min * unitPrice, step: unitPrice, count: range.max - range.min + 1 });
    }
    return {
      weight: origin.weight / maximumWeight,
      count,
      resources: resources.filter(roll => roll.first !== 0 || roll.count > 1),
      wealthAt(index: number) {
        let value = first + index;
        for (const effect of effects) {
          value = applyStatDelta(definition, value, effect.delta);
        }
        return Math.round(value * economy.unitsPerPoint);
      },
    };
  });
}
