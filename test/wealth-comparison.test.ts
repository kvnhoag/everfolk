import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Effect, LifeState, Origin, WorldPack } from "../src/types.ts";
import { formatWealthPercentile, formatWealthStanding, getWealthComparison } from "../client/models/wealth-comparison.ts";

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

test("household benchmarks include independent resource rolls at market prices", () => {
  const world = fixture();
  world.economy!.uncappedResources = true;
  world.origins = [origin("default", 1, 0, 2)];
  world.economy!.assets[0].initialRange = { min: 0, max: 2 };
  world.economy!.assets.push({ id: "shares", title: "Shares", description: "Workshop shares.", value: 50, initialRange: { min: 1, max: 2 } });
  const values: number[] = [];
  for (let cash = 0; cash <= 2; cash++) for (let tools = 0; tools <= 2; tools++) for (let shares = 1; shares <= 2; shares++) values.push(cash * 10 + tools * 30 + shares * 50);
  values.sort((a, b) => a - b);
  const life = lifeWith(world, 0);
  life.economy!.assets = { tools: 0, shares: 0 };
  for (let wealth = 0; wealth <= 190; wealth++) {
    life.economy!.cash = wealth;
    const comparison = getWealthComparison(world, life)!;
    assert.ok(Math.abs(comparison.percentile - values.filter(value => value < wealth).length / values.length * 100) < 1e-10, `Wealth ${wealth}`);
    assert.equal(comparison.medianWealth, values[values.length / 2 - 1]);
  }
});

test("origin resource overrides and clamped cash retain inclusive probabilities", () => {
  const world = fixture();
  world.economy!.uncappedResources = true;
  world.stats.wealth.max = 10;
  world.origins = [origin("default", 1, 0, 10, [{ type: "stat", stat: "wealth", delta: 5 }])];
  world.economy!.assets[0].initialRange = { min: 9, max: 9 };
  world.origins[0].assetRanges = { tools: { min: 1, max: 3 } };
  const values: number[] = [];
  for (let cash = 0; cash <= 10; cash++) for (let tools = 1; tools <= 3; tools++) values.push(Math.min(10, cash + 5) * 10 + tools * 30);
  values.sort((a, b) => a - b);
  const life = lifeWith(world, 0); life.economy!.assets.tools = 0;
  for (let wealth = 0; wealth <= 200; wealth++) {
    life.economy!.cash = wealth;
    const comparison = getWealthComparison(world, life)!;
    assert.ok(Math.abs(comparison.percentile - values.filter(value => value < wealth).length / values.length * 100) < 1e-10);
    assert.equal(comparison.medianWealth, values[Math.floor(values.length / 2)]);
  }
});

test("very wide cash and resource rolls use analytical pair counting", { timeout: 1000 }, () => {
  const world = fixture();
  world.economy!.uncappedResources = true;
  world.stats.wealth.max = 1_000_000;
  world.economy!.unitsPerPoint = 1;
  world.origins = [origin("default", 1, 0, 1_000_000)];
  world.economy!.assets[0].value = 1;
  world.economy!.assets[0].initialRange = { min: 0, max: 1_000_000 };
  const life = lifeWith(world, 0); life.economy!.assets.tools = 0;
  life.economy!.cash = 1_000_000;
  const comparison = getWealthComparison(world, life)!;
  assert.equal(comparison.medianWealth, 1_000_000);
  assert.ok(Math.abs(comparison.percentile - (1_000_000 / 2_000_002 * 100)) < 1e-10);
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

test("wealth percentile text rounds to whole percentages and preserves tails", () => {
  assert.equal(formatWealthPercentile(0), "0%");
  assert.equal(formatWealthPercentile(0.001), "<1%");
  assert.equal(formatWealthPercentile(0.9), "<1%");
  assert.equal(formatWealthPercentile(1), "1%");
  assert.equal(formatWealthPercentile(75.49), "75%");
  assert.equal(formatWealthPercentile(75.5), "76%");
  assert.equal(formatWealthPercentile(75.678), "76%");
  assert.equal(formatWealthPercentile(99), "99%");
  assert.equal(formatWealthPercentile(99.9), ">99%");
  assert.equal(formatWealthPercentile(99.999), ">99%");
  assert.equal(formatWealthPercentile(100), "100%");
});

test("wealth standing rounds its displayed share while retaining the exact median", () => {
  assert.equal(formatWealthStanding(85.1), "Top 15%");
  assert.equal(formatWealthStanding(84.5), "Top 16%");
  assert.equal(formatWealthStanding(14.9), "Bottom 15%");
  assert.equal(formatWealthStanding(49.9), "Bottom 50%");
  assert.equal(formatWealthStanding(50), "At the median");
  assert.equal(formatWealthStanding(50.1), "Top 50%");
  assert.equal(formatWealthStanding(0), "Bottom <1%");
  assert.equal(formatWealthStanding(0.1), "Bottom <1%");
  assert.equal(formatWealthStanding(99.9), "Top <1%");
  assert.equal(formatWealthStanding(100), "Top <1%");
});
