import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import { getWealthSummary } from "../client/models/wealth.ts";
import { advanceYearWithFocus, focusStatus, normalizeYearlyFocus } from "../client/models/yearly-focus.ts";
import { productionWithDeliveries } from "../client/models/market.ts";
import { getBirthRollResources, getBirthRollStats } from "../client/models/birth-stat-roll.ts";
import { getWealthComparison } from "../client/models/wealth-comparison.ts";

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "market-ui", version: "1", title: "Market display", description: "Authored market display fixture.", startYear: -20, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 20 } }, flags: { "trader-qualified": { label: "Trading experience", initial: false } },
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [],
    events: [{ id: "shortage", title: "A shortage", text: "Supply falls.", mode: "automatic", trigger: { type: "age", at: 20 }, effects: [], choices: [] }],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, description: "Authored prices.",
      assets: [{ id: "thread", title: "Thread", description: "A bundle.", value: 10, initialRange: { min: 3, max: 3 } }],
      market: { minAge: 18, feePercent: 10, maxQuantity: 100, maxOrders: 10, traderJob: "trader", traderYears: 2, traderFocusActivity: "focus-market-trading", goods: ["thread"],
        shocks: [{ eventId: "shortage", title: "Thread shortage", durationYears: 2, priceMultipliers: { thread: 2 } }] } },
    character: { skills: { reckoning: { label: "Reckoning", min: 0, max: 100, initial: 0 } },
      jobs: [{ id: "clerk", title: "Clerk", description: "Paid writing.", minAge: 18, yearlyEffects: [{ type: "cash", delta: 30 }] },
        { id: "trader", title: "Trader", description: "Market work.", minAge: 18, yearlyEffects: [] }], partners: [], childNames: ["Child"],
      deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: [
        { id: "become-clerk", text: "Become a clerk", category: "career", minAge: 18, usesYearlyActivity: false, outcomes: [{ id: "hired", text: "You are hired.", weight: 1, effects: [{ type: "job", job: "clerk" }] }] },
        { id: "focus-market-trading", text: "Spend the year trading", category: "finance", minAge: 18, outcomes: [{ id: "focus", text: "You study the market.", weight: 1, effects: [{ type: "skill", skill: "reckoning", delta: 1 }] }] },
      ] },
  };
}

function adult(engine: ReturnType<typeof createEngine>) {
  let life = engine.start("market-display");
  while (life.age < 18) life = engine.advance(life);
  return life;
}

test("wealth display reconciles cash, held stock and committed orders", () => {
  const engine = createEngine(fixture());
  let life = adult(engine);
  life = engine.orderMarket(life, { side: "buy", asset: "thread", quantity: 2 });
  life = engine.orderMarket(life, { side: "sell", asset: "thread", quantity: 1 });
  const before = structuredClone(life), summary = getWealthSummary(engine.world, life)!;
  assert.equal(summary.cash, 178);
  assert.equal(summary.assetTotal, 18);
  assert.equal(summary.committedValue, 27);
  assert.equal(summary.netWorth, summary.cash + summary.assetTotal + summary.committedValue - summary.debt);
  assert.deepEqual(life, before);
});

test("event-driven stock valuation agrees with the balance sheet", () => {
  const engine = createEngine(fixture());
  let life = adult(engine);
  life = engine.advance(engine.advance(life));
  const summary = getWealthSummary(engine.world, life)!;
  assert.equal(summary.assets[0].value, 18);
  assert.equal(summary.assetTotal, 54);
  assert.equal(summary.netWorth, summary.cash + summary.assetTotal);
});

test("trading focus uses ordinary commands and discloses the year's forgone wage", () => {
  const engine = createEngine(fixture());
  const life = engine.act(adult(engine), "become-clerk");
  assert.equal(normalizeYearlyFocus("trade", engine.world), "trade");
  assert.match(focusStatus(life, engine.world, "trade", engine.getActivities(life)), /puts paid work aside/);
  const focused = engine.act(life, "focus-market-trading");
  assert.equal(getWealthSummary(engine.world, focused)!.jobCash, 0);
  const advanced = advanceYearWithFocus(engine, life, "trade");
  assert.equal(advanced.economy!.cash, life.economy!.cash);
  assert.deepEqual(advanced.commands.slice(life.commands.length), [{ type: "act", activity: "focus-market-trading" }, { type: "advance" }]);
  assert.deepEqual(engine.load(engine.save(advanced)), advanced);
  const oldWorld = fixture();
  delete oldWorld.economy!.market;
  oldWorld.character!.activities = [];
  assert.equal(normalizeYearlyFocus("trade", oldWorld), "everyday");
});

test("production forecast includes firm deliveries and respects a trading year", () => {
  const world = fixture();
  world.economy!.assets.push({ id: "cloth", title: "Cloth", description: "Finished cloth.", value: 30 });
  world.economy!.market!.goods.push("cloth");
  const job = { id: "weaver", title: "Weaver", description: "Weave cloth.", minAge: 18, yearlyEffects: [], production: { inputs: { thread: 2 }, outputs: { cloth: 1 }, baseBatches: 4, maxBatches: 4 } };
  world.character!.jobs.push(job);
  const engine = createEngine(world);
  const life = engine.orderMarket(adult(engine), { side: "buy", asset: "thread", quantity: 5 });
  const before = structuredClone(life);
  assert.deepEqual(productionWithDeliveries(engine.world, life, job), { capacity: 4, batches: 4, inputs: { thread: 8 }, outputs: { cloth: 4 } });
  assert.deepEqual(life, before, "Forecasting does not deliver or consume stock.");
  const trading = engine.act(life, "focus-market-trading");
  assert.deepEqual(productionWithDeliveries(engine.world, trading, job), { capacity: 4, batches: 0, inputs: {}, outputs: {} });
});

test("birth resources and wealth range use the same event-aware sell prices", () => {
  const world = fixture();
  world.events[0].trigger = { type: "age", at: 0 };
  const engine = createEngine(world), life = engine.start("market-birth");
  const resources = getBirthRollResources(engine.world, life);
  assert.equal(resources[0].unitPrice, 18);
  assert.equal(resources[0].marketValue, 54);
  const wealth = getBirthRollStats(engine.world, life).find(stat => stat.id === "wealth")!;
  assert.equal(wealth.value, life.economy!.cash + resources.reduce((sum, item) => sum + item.marketValue, 0));
  assert.deepEqual(wealth.range, { min: 254, max: 254 });
});

test("the starting-household wealth benchmark uses ordinary sell values after fees", () => {
  const engine = createEngine(fixture()), life = engine.start("market-benchmark");
  assert.equal(getWealthComparison(engine.world, life)!.medianWealth, 227);
  assert.equal(getWealthComparison(engine.world, life)!.netWorth, 227);
  assert.equal(getWealthComparison(engine.world, life)!.percentile, 0);
});
