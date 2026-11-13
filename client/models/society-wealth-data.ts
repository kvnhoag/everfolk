import { applyStatDelta } from "../../src/progression.ts";
import { marketQuote } from "../../src/market.ts";
import { merchantSaleValue } from "../../src/demo/market-depth.ts";
import type { DemoState } from "../../src/demo/types.ts";
import { initialTown } from "../../src/demo/market.ts";
import { TRADE_ITEMS } from "../../src/demo/types.ts";
import type { Effect, LifeState, WorldPack } from "../../src/types.ts";

export interface UniformRoll { first: number; step: number; count: number; /** Optional monotone whole-currency values for a nonlinear market curve. */ valueAt?: (index: number) => number }

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

export const MAX_RECORDED_OBSERVATIONS_PER_REVISION = 500;
const MAX_RECORDED_REVISIONS = 64;

export type WealthObservationsSnapshot = Record<string, Record<string, number>>;

/** In-memory store for recorded player life net worth observations per world and revision, keyed by life identity. */
const recordedObservations = new Map<string, Map<string, number>>();
let anonymousObservationSeq = 0;

function observationKey(worldId: string, worldVersion: string): string {
  return `${worldId}::${worldVersion}`;
}

/** Stable identifier for a single recorded life so progression updates replace rather than duplicate it. */
export function recordedLifeIdentity(life: Pick<LifeState, "worldFingerprint" | "seed">): string {
  return `${life.worldFingerprint}:${life.seed}`;
}

function upsertObservation(key: string, id: string, roundedNetWorth: number): void {
  const cleanId = id.trim();
  if (!cleanId) return;
  let entries = recordedObservations.get(key);
  if (!entries) {
    entries = new Map<string, number>();
    recordedObservations.set(key, entries);
  }
  if (!entries.has(cleanId) && entries.size >= MAX_RECORDED_OBSERVATIONS_PER_REVISION) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
  entries.set(cleanId, roundedNetWorth);
}

/** Record a life's total assets (cash and holdings, before debt) for a specific world and compatible revision. */
export function recordWealthObservation(worldId: string, worldVersion: string, netWorth: number, lifeId?: string): void {
  if (!Number.isFinite(netWorth)) return;
  const id = lifeId?.trim() || `anon-${++anonymousObservationSeq}`;
  upsertObservation(observationKey(worldId, worldVersion), id, Math.round(netWorth));
}

/** Retrieve all net-worth observations for a specific world revision. */
export function getRecordedWealthObservations(worldId: string, worldVersion: string): readonly number[] {
  const entries = recordedObservations.get(observationKey(worldId, worldVersion));
  return entries ? Array.from(entries.values()) : [];
}

/** Export persisted recorded-life wealth observations per world revision. */
export function exportWealthObservationsSnapshot(): WealthObservationsSnapshot {
  const snapshot: WealthObservationsSnapshot = {};
  for (const [revisionKey, entries] of recordedObservations.entries()) {
    if (entries.size > 0) snapshot[revisionKey] = Object.fromEntries(entries);
  }
  return snapshot;
}

/** Restore recorded-life wealth observations from a validated snapshot. */
export function hydrateWealthObservations(snapshot: WealthObservationsSnapshot, options?: { merge?: boolean }): void {
  if (!options?.merge) clearRecordedWealthObservations();
  for (const [revisionKey, entries] of Object.entries(snapshot).slice(0, MAX_RECORDED_REVISIONS)) {
    if (!entries || typeof entries !== "object") continue;
    for (const [lifeId, netWorth] of Object.entries(entries).slice(-MAX_RECORDED_OBSERVATIONS_PER_REVISION)) {
      if (typeof netWorth !== "number" || !Number.isFinite(netWorth)) continue;
      upsertObservation(revisionKey, lifeId, Math.round(netWorth));
      const match = /^anon-(\d+)$/.exec(lifeId);
      if (match) anonymousObservationSeq = Math.max(anonymousObservationSeq, Number(match[1]));
    }
  }
}

/** Clear all recorded net-worth observations (primarily for test isolation). */
export function clearRecordedWealthObservations(): void {
  recordedObservations.clear();
  anonymousObservationSeq = 0;
}

/** A handful of finished lives is not a society; below this many, the authored households stay the benchmark. */
export const MIN_RECORDED_LIVES = 20;

function benchmarkObservations(world: WorldPack | undefined, explicitObservations?: readonly number[]): readonly number[] {
  if (explicitObservations) return explicitObservations;
  const recorded = world ? getRecordedWealthObservations(world.id, world.version) : [];
  return recorded.length >= MIN_RECORDED_LIVES ? recorded : [];
}

/** Retrieve metadata describing whether the society comparison is based on recorded lives or authored fallback. */
export function getSocietyWealthBenchmarkInfo(world: WorldPack, explicitObservations?: readonly number[]): SocietyBenchmarkInfo {
  const observations = benchmarkObservations(world, explicitObservations);
  const revisionLabel = world?.version ? `world revision ${world.version}` : "this world revision";
  if (observations.length > 0) {
    return {
      kind: "recorded-lives",
      description: `Based on ${observations.length} recorded player ${observations.length === 1 ? "life" : "lives"} in ${revisionLabel}.`,
      sampleCount: observations.length,
    };
  }
  const recordedCount = explicitObservations ? 0 : (world ? getRecordedWealthObservations(world.id, world.version).length : 0);
  return {
    kind: "authored-households",
    description: `Based on starting household distributions (${recordedCount} of ${MIN_RECORDED_LIVES} recorded ${recordedCount === 1 ? "life" : "lives"} collected in ${revisionLabel}).`,
    sampleCount: world?.origins?.length ?? 0,
  };
}

/** Retrieve the population used for the society percentile and median wealth. */
export function getSocietyWealthData(world: WorldPack, explicitObservations?: readonly number[]): SocietyWealthGroup[] {
  const observations = benchmarkObservations(world, explicitObservations);
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
  const demoTown = world.demo && startingResources ? initialTown(world.demo) : undefined;
  const demoPrices = demoTown?.prices;
  const referenceDemo = { town: demoTown, year: { flood: "normal", army: "quiet", road: "safe", fresh: [] } } as unknown as DemoState;
  return world.origins.map(origin => {
    const range = origin.statRanges?.[economy.stat] ?? definition.initialRange;
    const first = range?.min ?? definition.initial;
    const count = range ? range.max - range.min + 1 : 1;
    const effects: Extract<Effect, { type: "stat" }>[] = [];
    for (const effect of origin.effects) {
      if (effect.type === "end") break;
      if (effect.type === "stat" && effect.stat === economy.stat) effects.push(effect);
    }
    const resources: UniformRoll[] = economy.assets.map(asset => {
      const range = origin.assetRanges?.[asset.id] ?? asset.initialRange ?? { min: 0, max: 0 };
      const unitPrice = marketQuote(world, { age: 0, lastEventAge: {}, eventCounts: {} }, asset.id).sell;
      return { first: range.min * unitPrice, step: unitPrice, count: range.max - range.min + 1 };
    });
    if (startingResources && demoPrices) for (const item of TRADE_ITEMS) {
      const range = startingResources.origins?.[origin.id]?.[item] ?? startingResources.defaults[item];
      if (world.demo!.market.depth) {
        const cache = new Map<number, number>();
        const valueAt = (index: number): number => {
          if (!cache.has(index)) cache.set(index, merchantSaleValue(world.demo!, referenceDemo, item, range.min + index));
          return cache.get(index)!;
        };
        resources.push({ first: valueAt(0), step: 0, count: range.max - range.min + 1, valueAt });
      } else {
        const unitPrice = demoPrices[item].buy;
        resources.push({ first: range.min * unitPrice, step: unitPrice, count: range.max - range.min + 1 });
      }
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
