import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { marketOrderCapacity } from "../src/market.ts";
import type { WorldPack } from "../src/types.ts";

function pack(): WorldPack {
  const changeJob = (id: string) => ({ id: `work-${id}`, text: `Choose ${id}.`, category: "career" as const, usesYearlyActivity: false,
    outcomes: [{ id: `accepted-${id}`, text: "You accept the job.", weight: 1, effects: [{ type: "job" as const, job: id }] }] });
  return { schemaVersion: 1, id: "market-capacity", version: "1", title: "Market capacity", description: "Authored balance fixture.", startYear: -20, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 100 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", unitsPerPoint: 10, uncappedResources: true, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Authored prices.",
      assets: [{ id: "grain", title: "Grain", description: "A good.", value: 2, initialRange: { min: 500, max: 500 } },
        { id: "cloth", title: "Cloth", description: "Another good.", value: 3, initialRange: { min: 500, max: 500 } }],
      market: { minAge: 0, feePercent: 0, maxQuantity: 100, maxOrders: 8, traderJob: "trader", traderYears: 3, traderFocusActivity: "focus-trade", goods: ["grain", "cloth"], shocks: [],
        orderLimits: { household: { perOrder: 50, perYear: 100 }, professional: { perOrder: 100, perYear: 300 } } } },
    character: { skills: { reckoning: { label: "Reckoning", min: 0, max: 100, initial: 10 } },
      jobs: [{ id: "worker", title: "Worker", description: "Ordinary work.", minAge: 0, yearlyEffects: [] },
        { id: "buyer", title: "Purchasing agent", description: "Broad purchases.", minAge: 0, yearlyEffects: [], marketAccess: "full" },
        { id: "trader", title: "Trader", description: "Trade goods.", minAge: 0, yearlyEffects: [] }],
      partners: [], childNames: ["Child"], deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: [changeJob("worker"), changeJob("buyer"), changeJob("trader"), { id: "focus-trade", text: "Focus on trading.", category: "career",
        outcomes: [{ id: "trade-focus", text: "You check trade accounts.", weight: 1, effects: [] }] }] },
  };
}

test("order limits reject oversized and invalid input without mutating cash, stock or commands", () => {
  const engine = createEngine(pack()), life = engine.start("input-limits"), before = structuredClone(life);
  for (const quantity of [51, 101, 0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => engine.orderMarket(life, { side: "buy", asset: "grain", quantity }), /whole quantity from 1 to 50/);
    assert.deepEqual(life, before);
  }
  const accepted = engine.orderMarket(life, { side: "buy", asset: "grain", quantity: 50 });
  assert.equal(accepted.economy!.cash, 900);
  assert.deepEqual(marketOrderCapacity(engine.world, accepted), { perOrder: 50, perYear: 100, committed: 50, remaining: 50, professional: false });
});

test("split contracts across goods and both sides share one annual capacity", () => {
  const engine = createEngine(pack()); let life = engine.start("shared-capacity");
  life = engine.orderMarket(life, { side: "buy", asset: "grain", quantity: 50 });
  life = engine.orderMarket(life, { side: "sell", asset: "cloth", quantity: 50 });
  const before = structuredClone(life);
  assert.equal(marketOrderCapacity(engine.world, life).remaining, 0);
  for (const side of ["buy", "sell"] as const) assert.throws(() => engine.orderMarket(life, { side, asset: "grain", quantity: 1 }), /Annual market capacity/);
  assert.deepEqual(life, before);
  life = engine.cancelMarketOrder(life, 1);
  assert.equal(life.economy!.cash, 1000);
  assert.equal(marketOrderCapacity(engine.world, life).remaining, 50);
  life = engine.orderMarket(life, { side: "buy", asset: "cloth", quantity: 50 });
  assert.equal(marketOrderCapacity(engine.world, life).remaining, 0);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("settlement renews capacity once per year while retaining its actual receipts and deliveries", () => {
  const engine = createEngine(pack()); let life = engine.start("annual-renewal");
  life = engine.orderMarket(life, { side: "buy", asset: "grain", quantity: 50 });
  life = engine.orderMarket(life, { side: "sell", asset: "cloth", quantity: 50 });
  life = engine.advance(life);
  assert.equal(life.economy!.assets.grain, 550);
  assert.equal(life.economy!.assets.cloth, 450);
  assert.equal(life.economy!.cash, 1050);
  assert.equal(marketOrderCapacity(engine.world, life).remaining, 100);
  assert.deepEqual(life.economy!.market!.lastSettlement, { age: 1, bought: 50, sold: 50, revenue: 150, spent: 100 });
  assert.doesNotThrow(() => engine.orderMarket(life, { side: "sell", asset: "grain", quantity: 50 }));
  assert.equal(engine.advance(life).economy!.cash, 1050, "Completed receipts are not paid again.");
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("purchasing roles have a larger finite budget and changing roles cannot erase commitments", () => {
  const engine = createEngine(pack()); let life = engine.act(engine.start("professional-capacity"), "work-buyer");
  life = engine.orderMarket(life, { side: "buy", asset: "grain", quantity: 100 });
  life = engine.orderMarket(life, { side: "sell", asset: "cloth", quantity: 100 });
  life = engine.orderMarket(life, { side: "buy", asset: "cloth", quantity: 100 });
  assert.equal(marketOrderCapacity(engine.world, life).remaining, 0);
  assert.throws(() => engine.orderMarket(life, { side: "sell", asset: "grain", quantity: 1 }), /Annual market capacity/);
  const orders = life.economy!.market!.orders;
  life = engine.act(life, "work-worker");
  assert.deepEqual(life.economy!.market!.orders, orders);
  assert.deepEqual(marketOrderCapacity(engine.world, life), { perOrder: 50, perYear: 100, committed: 300, remaining: 0, professional: false });
  assert.throws(() => engine.orderMarket(life, { side: "buy", asset: "grain", quantity: 1 }), /Annual market capacity/);
  const restored = engine.load(engine.save(life));
  assert.deepEqual(restored, life);
  const settled = engine.advance(life);
  assert.equal(settled.economy!.market!.lastSettlement!.bought, 200, "Existing agreements remain honoured after a role change.");
  assert.equal(marketOrderCapacity(engine.world, settled).remaining, 100);
  for (const order of [...orders]) life = engine.cancelMarketOrder(life, order.id);
  assert.equal(marketOrderCapacity(engine.world, life).remaining, 100);
  assert.equal(life.economy!.cash, 1000);
  assert.equal(life.economy!.assets.cloth, 500);
});

test("a trading focus cannot raise the cap while the configured trader still receives the professional budget", () => {
  const engine = createEngine(pack()), focused = engine.act(engine.start("focus-capacity"), "focus-trade");
  assert.equal(marketOrderCapacity(engine.world, focused).professional, false);
  assert.throws(() => engine.orderMarket(focused, { side: "buy", asset: "grain", quantity: 51 }), /whole quantity/);
  const trader = engine.act(engine.start("trader-capacity"), "work-trader");
  assert.deepEqual(marketOrderCapacity(engine.world, trader), { perOrder: 100, perYear: 300, committed: 0, remaining: 300, professional: true });
});

test("retained worlds without annual limits preserve their exact order rules", () => {
  const world = pack(); delete world.economy!.market!.orderLimits;
  const engine = createEngine(world); let life = engine.start("legacy-capacity");
  for (let index = 0; index < 4; index++) life = engine.orderMarket(life, { side: "buy", asset: "grain", quantity: 100 });
  assert.deepEqual(marketOrderCapacity(engine.world, life), { perOrder: 100, perYear: undefined, committed: 400, remaining: undefined, professional: false });
  assert.deepEqual(engine.load(engine.save(life)), life);
});
