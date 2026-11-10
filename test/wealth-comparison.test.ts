import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Effect, LifeState, Origin, WorldPack } from "../src/types.ts";
import { formatWealthPercentile, getWealthComparison } from "../client/wealth-comparison.ts";

function origin(id: string, weight: number, min?: number, max = min, effects: Effect[] = []): Origin {
  return { id, title: id, text: "A reference household.", weight, effects,
    ...(min !== undefined ? { statRanges: { wealth: { min, max: max! } } } : {}) };
}

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "wealth-comparison", version: "1", title: "Wealth comparison", description: "Authored household comparison.", startYear: -66, maxAge: 70,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 5 } }, flags: {},
    origins: [origin("workers", 3, 0, 2), origin("estate", 1, 10)], yearlyEffects: [],
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, description: "Authored money.",
      assets: [{ id: "tools", title: "Tools", description: "A tool chest.", value: 30, maxOwned: 1 }] },
    events: [], endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
  };
}

function lifeWith(world: WorldPack, cash: number): LifeState {
  const life = structuredClone(createEngine(world).start("comparison"));
  life.economy!.cash = cash;
  return life;
}

test("society comparison uses all weighted origins and strictly excludes ties", () => {
  const world = fixture(), life = lifeWith(world, 20);
  assert.deepEqual(getWealthComparison(world, life), { netWorth: 20, percentile: 50, medianWealth: 10 });
  life.originId = "estate";
  assert.equal(getWealthComparison(world, life)!.percentile, 50);
  life.economy!.cash = 10;
  assert.equal(getWealthComparison(world, life)!.percentile, 25);
  life.economy!.cash = 100;
  assert.equal(getWealthComparison(world, life)!.percentile, 75);
});

test("fallback ranges and fixed values retain inclusive starting-roll probabilities", () => {
  const world = fixture();
  world.stats.wealth.initialRange = { min: 2, max: 4 };
  world.origins = [origin("default", 1)];
  let comparison = getWealthComparison(world, lifeWith(world, 30))!;
  assert.ok(Math.abs(comparison.percentile - 100 / 3) < 1e-12);
  assert.equal(comparison.medianWealth, 30);
  delete world.stats.wealth.initialRange;
  comparison = getWealthComparison(world, lifeWith(world, 50))!;
  assert.equal(comparison.percentile, 0);
  assert.equal(comparison.medianWealth, 50);
});

test("ordered origin effects preserve clamps, tied wealth and ending stops", () => {
  const world = fixture(); world.stats.wealth.max = 10;
  const gain: Effect = { type: "stat", stat: "wealth", delta: 5 };
  const loss: Effect = { type: "stat", stat: "wealth", delta: -5 };
  world.origins = [origin("clamped", 1, 8, 10, [gain, loss])];
  assert.deepEqual(getWealthComparison(world, lifeWith(world, 50)), { netWorth: 50, percentile: 0, medianWealth: 50 });
  assert.equal(getWealthComparison(world, lifeWith(world, 51))!.percentile, 100);
  world.origins[0].effects = [loss, gain];
  assert.equal(getWealthComparison(world, lifeWith(world, 90))!.medianWealth, 90);
  world.origins[0].effects = [gain, { type: "end", ending: "complete" }, loss];
  assert.equal(getWealthComparison(world, lifeWith(world, 100))!.medianWealth, 100);
});

test("fractional fixed stats and origin changes round currency exactly like birth accounts", () => {
  const world = fixture();
  world.stats.wealth = { label: "Wealth", min: 0, max: 1, initial: 0.1 };
  world.origins = [origin("fractional", 1, undefined, undefined, [{ type: "stat", stat: "wealth", delta: 0.2 }])];
  const life = lifeWith(world, 3);
  assert.deepEqual(getWealthComparison(world, life), { netWorth: 3, percentile: 0, medianWealth: 3 });
});

test("net worth includes assets and debt and remains uncapped by its backing stat", () => {
  const world = fixture(), life = lifeWith(world, 20);
  life.stats.wealth = 100;
  assert.equal(getWealthComparison(world, life)!.percentile, 50);
  life.economy!.cash = 50; life.economy!.debt = 30;
  assert.equal(getWealthComparison(world, life)!.percentile, 50);
  life.economy!.cash = 20; life.economy!.assets.tools = 1;
  assert.equal(getWealthComparison(world, life)!.percentile, 50);
  life.economy!.cash = 0; life.economy!.assets.tools = 0; life.economy!.debt = 10;
  assert.deepEqual(getWealthComparison(world, life), { netWorth: -10, percentile: 0, medianWealth: 10 });
  life.economy!.cash = 2000; life.economy!.debt = 0;
  assert.equal(getWealthComparison(world, life)!.netWorth, 2000);
  assert.equal(getWealthComparison(world, life)!.percentile, 100);
});

test("enormous ranges are ranked analytically without enumeration", { timeout: 1000 }, () => {
  const world = fixture();
  world.stats.wealth.max = 1_000_000_000_000; world.economy!.unitsPerPoint = 1;
  world.origins = [origin("large", 1, 0, 1_000_000_000_000)];
  const comparison = getWealthComparison(world, lifeWith(world, 500_000_000_000))!;
  assert.equal(comparison.medianWealth, 500_000_000_000);
  assert.equal(comparison.percentile, 500_000_000_000 / 1_000_000_000_001 * 100);
});

test("subnormal weights retain relative household shares", () => {
  const world = fixture();
  world.origins = [origin("low", Number.MIN_VALUE, 0), origin("high", Number.MIN_VALUE, 10)];
  assert.deepEqual(getWealthComparison(world, lifeWith(world, 100)), { netWorth: 100, percentile: 50, medianWealth: 0 });
});

test("comparison preserves the world, state and RNG and leaves legacy scores alone", () => {
  const world = fixture(), life = lifeWith(world, 20);
  const beforeWorld = structuredClone(world), beforeLife = structuredClone(life);
  getWealthComparison(world, life); getWealthComparison(world, life);
  assert.deepEqual(world, beforeWorld); assert.deepEqual(life, beforeLife);
  delete life.economy;
  assert.equal(getWealthComparison(world, life), null);
  delete world.economy;
  assert.equal(getWealthComparison(world, beforeLife), null);
});

test("percentile text keeps useful precision without rounding partial ranks to endpoints", () => {
  assert.equal(formatWealthPercentile(0), "0%");
  assert.equal(formatWealthPercentile(0.001), "<0.1%");
  assert.equal(formatWealthPercentile(0.1), "0.1%");
  assert.equal(formatWealthPercentile(75.678), "75.7%");
  assert.equal(formatWealthPercentile(99.9), "99.9%");
  assert.equal(formatWealthPercentile(99.999), ">99.9%");
  assert.equal(formatWealthPercentile(100), "100%");
});
