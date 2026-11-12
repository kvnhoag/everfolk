import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { getNetWorth } from "../src/economy.ts";
import { marketQuote, productionPlan } from "../src/market.ts";
import type { WorldPack } from "../src/types.ts";

function pack(): WorldPack {
  return {
    schemaVersion: 1, id: "annual-market", version: "1", title: "Market", description: "Authored test economy.", startYear: -30, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 100 } }, flags: { "trader-qualified": { label: "Experienced trader", initial: false } },
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    events: [{ id: "shortage", title: "Clay shortage", text: "Clay deliveries are delayed.", trigger: { type: "age", at: 1 }, mode: "automatic", choices: [], effects: [] }],
    economy: { stat: "wealth", unitsPerPoint: 10, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Authored prices.", uncappedResources: true,
      assets: [{ id: "clay", title: "Clay", description: "Material.", value: 10, initialRange: { min: 4, max: 4 } },
        { id: "pots", title: "Pots", description: "Goods.", value: 40, initialRange: { min: 6, max: 6 } }],
      market: { minAge: 0, feePercent: 10, maxQuantity: 100, maxOrders: 20, traderJob: "trader", traderYears: 3,
        traderFocusActivity: "focus-trade", goods: ["clay", "pots"], shocks: [{ eventId: "shortage", title: "Clay deliveries delayed", durationYears: 2, priceMultipliers: { clay: 2 } }] } },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 10 } }, partners: [], childNames: ["Child"],
      jobs: [{ id: "trader", title: "Trader", description: "Trade goods.", minAge: 0, yearlyEffects: [] },
        { id: "worker", title: "Worker", description: "Paid work.", minAge: 0, yearlyEffects: [{ type: "cash", delta: 30 }] },
        { id: "potter", title: "Potter", description: "Make pots.", minAge: 0, yearlyEffects: [{ type: "skill", skill: "craft", delta: 1 }],
          production: { inputs: { clay: 2 }, outputs: { pots: 1 }, baseBatches: 1, skill: "craft", skillPerBatch: 10, maxBatches: 10 } }],
      activities: [{ id: "focus-trade", text: "Trade this year.", category: "career", outcomes: [{ id: "trade", text: "You check the accounts.", weight: 1, effects: [] }] },
        ...["potter", "worker"].map(id => ({ id: `become-${id}`, text: `Work as ${id}.`, category: "career" as const,
          outcomes: [{ id: `hired-${id}`, text: "You accept the work.", weight: 1, effects: [{ type: "job" as const, job: id }] }] }))],
      deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }] },
  };
}

test("bulk contracts reserve cash/goods immediately and settle once at the annual boundary", () => {
  const engine = createEngine(pack()), start = engine.start("bulk");
  const buy = engine.orderMarket(start, { side: "buy", asset: "clay", quantity: 10 });
  assert.equal(start.economy!.cash, 1000); assert.equal(buy.economy!.cash, 890);
  assert.equal(buy.economy!.assets.clay, 4); assert.equal(buy.economy!.market!.orders.length, 1);
  const sell = engine.orderMarket(buy, { side: "sell", asset: "pots", quantity: 3 });
  assert.equal(sell.economy!.assets.pots, 3); assert.equal(sell.economy!.cash, 890);
  assert.equal(getNetWorth(engine.world, sell), 890 + 4 * 9 + 3 * 36 + 10 * 9 + 108);
  const settled = engine.advance(sell);
  assert.equal(settled.economy!.assets.clay, 14); assert.equal(settled.economy!.cash, 998);
  assert.deepEqual(settled.economy!.market!.lastSettlement, { age: 1, bought: 10, sold: 3, revenue: 108, spent: 110 });
  assert.equal(settled.economy!.market!.orders.length, 0);
  assert.equal(engine.advance(settled).economy!.cash, 998);
  assert.deepEqual(engine.load(engine.save(settled)), settled);
  assert.deepEqual(engine.replay(settled.seed, settled.commands), settled);
});

test("cancellation refunds reservations, leaves no goods/income, and replays exactly", () => {
  const engine = createEngine(pack()), start = engine.start("cancel");
  let life = engine.orderMarket(start, { side: "buy", asset: "clay", quantity: 3 });
  life = engine.orderMarket(life, { side: "sell", asset: "pots", quantity: 2 });
  life = engine.cancelMarketOrder(life, 1); life = engine.cancelMarketOrder(life, 2);
  assert.equal(life.economy!.cash, start.economy!.cash); assert.deepEqual(life.economy!.assets, start.economy!.assets);
  assert.throws(() => engine.cancelMarketOrder(life, 2), /no longer pending/);
  assert.equal(engine.advance(life).economy!.market!.lastSettlement, undefined);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("invalid orders cannot overdraw cash, double-sell stock, use fractions or bypass replay fields", () => {
  const engine = createEngine(pack()), start = engine.start("invalid");
  for (const request of [{ side: "buy", asset: "clay", quantity: 100 }, { side: "sell", asset: "pots", quantity: 7 },
    { side: "buy", asset: "clay", quantity: 0.5 }, { side: "buy", asset: "missing", quantity: 1 },
    { side: "sell", asset: "pots", quantity: NaN }]) assert.throws(() => engine.orderMarket(start, request as any));
  assert.equal(start.commands.length, 0); assert.equal(start.economy!.cash, 1000);
  const reserved = engine.orderMarket(start, { side: "sell", asset: "pots", quantity: 6 });
  assert.throws(() => engine.orderMarket(reserved, { side: "sell", asset: "pots", quantity: 1 }), /uncommitted/);
  assert.throws(() => engine.replay(start.seed, [{ type: "market-order", side: "buy", asset: "clay", quantity: 1, unitPrice: 1 } as any]), /Invalid command/);
});

test("capped markets count pending purchases and cancelable sales toward ownership", () => {
  for (const explicitFlag of [true, false]) {
    const world = pack();
    if (explicitFlag) world.economy!.uncappedResources = false;
    else delete world.economy!.uncappedResources;
    world.economy!.assets[0].maxOwned = 8;
    const engine = createEngine(world), start = engine.start("capped-orders");
    assert.throws(() => engine.orderMarket(start, { side: "buy", asset: "clay", quantity: 5 }), /at most 8 clay/);
    let life = engine.orderMarket(start, { side: "buy", asset: "clay", quantity: 3 });
    assert.throws(() => engine.orderMarket(life, { side: "buy", asset: "clay", quantity: 2 }), /at most 8 clay/);
    life = engine.orderMarket(life, { side: "sell", asset: "clay", quantity: 2 });
    assert.throws(() => engine.orderMarket(life, { side: "buy", asset: "clay", quantity: 2 }), /at most 8 clay/);
    life = engine.cancelMarketOrder(life, 2);
    assert.equal(life.economy!.assets.clay, 4);
    life = engine.cancelMarketOrder(life, 1);
    life = engine.orderMarket(life, { side: "buy", asset: "clay", quantity: 4 });
    life = engine.advance(life);
    assert.equal(life.economy!.assets.clay, 8);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("ordinary resource gains cannot consume capacity reserved by market contracts", () => {
  const world = pack(); world.economy!.uncappedResources = false;
  world.economy!.assets[0].maxOwned = 6;
  world.character!.activities.push({ id: "extra-clay", text: "Collect extra clay", category: "career", outcomes: [{
    id: "clay-collected", text: "You collect clay.", weight: 1, effects: [{ type: "asset", asset: "clay", delta: 2 }],
  }] });
  const engine = createEngine(world), start = engine.start("reserved-capacity");
  for (const side of ["buy", "sell"] as const) {
    let life = engine.orderMarket(start, { side, asset: "clay", quantity: side === "buy" ? 1 : 2 });
    if (side === "sell") life = engine.act(life, "extra-clay");
    const activity = engine.getActivities(life).find(item => item.id === "extra-clay")!;
    assert.equal(activity.available, false);
    assert.throws(() => engine.act(life, "extra-clay"), /unavailable/);
    life = engine.cancelMarketOrder(life, 1);
    assert.equal(life.economy!.assets.clay, side === "buy" ? 4 : 6);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("prices follow actual reported events and expire, while existing contract quotes stay fixed", () => {
  const engine = createEngine(pack()), start = engine.start("signals");
  assert.deepEqual(marketQuote(engine.world, start, "clay"), { buy: 11, sell: 9, signals: [] });
  const ordered = engine.orderMarket(start, { side: "buy", asset: "clay", quantity: 2 });
  let life = engine.advance(ordered);
  assert.equal(life.economy!.market!.lastSettlement!.spent, 22);
  assert.equal(marketQuote(engine.world, life, "clay").buy, 22);
  assert.equal(marketQuote(engine.world, life, "clay").signals[0].eventId, "shortage");
  assert.equal(life.stats.wealth * 10, getNetWorth(engine.world, life));
  life = engine.advance(engine.advance(life));
  assert.equal(marketQuote(engine.world, life, "clay").buy, 11);
  assert.equal(life.stats.wealth * 10, getNetWorth(engine.world, life));
});

test("a report at birth updates wealth immediately without requiring a cash effect", () => {
  const world = pack(); world.events[0].trigger = { type: "age", at: 0 };
  const engine = createEngine(world), life = engine.start("birth-report");
  assert.equal(marketQuote(world, life, "clay").sell, 18);
  assert.equal(life.stats.wealth * 10, getNetWorth(world, life));
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("production uses delivered inputs, scales with stocked batches and skill, and stops when materials run out", () => {
  const world = pack(), engine = createEngine(world);
  const hired = engine.act(engine.start("production"), "become-potter");
  const ordered = engine.orderMarket(hired, { side: "buy", asset: "clay", quantity: 4 });
  const produced = engine.advance(ordered);
  assert.equal(produced.economy!.assets.clay, 4); assert.equal(produced.economy!.assets.pots, 8);
  assert.equal(produced.economy!.cash, 956, "Production creates stock, not free cash.");
  const used = engine.advance(produced), empty = engine.advance(used);
  assert.equal(used.economy!.assets.clay, 0); assert.equal(used.economy!.assets.pots, 10);
  assert.equal(empty.economy!.assets.pots, 10); assert.equal(empty.character!.skills.craft, used.character!.skills.craft);
  assert.match(empty.journal.at(-1)!.text, /lack of materials/);
  const skilled = structuredClone(produced); skilled.character!.skills.craft = 50;
  const plan = productionPlan(world, skilled, world.character!.jobs[2]);
  assert.equal(plan.capacity, 6); assert.equal(plan.batches, 2, "Stock still limits skilled production.");
});

test("capped production shares output capacity with deliveries and resumes after settled sales", () => {
  const world = pack(); world.economy!.uncappedResources = false;
  world.economy!.assets[1].maxOwned = 7;
  const engine = createEngine(world);
  let life = engine.act(engine.start("capped-production"), "become-potter");
  assert.equal(productionPlan(world, life, engine.world.character!.jobs[2]).batches, 1);
  life = engine.orderMarket(life, { side: "buy", asset: "pots", quantity: 1 });
  life = engine.advance(life);
  assert.equal(life.economy!.assets.pots, 7);
  assert.equal(life.economy!.assets.clay, 4, "The delivery fills storage before production.");
  assert.equal(life.character!.skills.craft, 10, "Stopped work earns no production skill.");
  life = engine.orderMarket(life, { side: "sell", asset: "pots", quantity: 2 });
  life = engine.advance(life);
  assert.equal(life.economy!.assets.pots, 7);
  assert.equal(life.economy!.assets.clay, 0);
  assert.equal(life.economy!.market!.lastSettlement!.sold, 2);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("production ownership limits apply to net output when a recipe consumes the same good", () => {
  for (const [starting, input, output, expected] of [[4, 1, 2, 6], [6, 1, 1, 6], [6, 2, 1, 4]]) {
    const world = pack(); world.economy!.uncappedResources = false;
    world.economy!.assets[0].maxOwned = 6;
    world.economy!.assets[0].initialRange = { min: starting, max: starting };
    world.character!.jobs[2].production!.inputs = { clay: input };
    world.character!.jobs[2].production!.outputs = { clay: output };
    const engine = createEngine(world);
    let life = engine.act(engine.start("net-production"), "become-potter");
    assert.equal(productionPlan(world, life, engine.world.character!.jobs[2]).batches, 2);
    life = engine.advance(life);
    assert.equal(life.economy!.assets.clay, expected);
    assert.equal(life.character!.skills.craft, 11);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("focused completed sales qualify trader work without silently replacing an existing occupation", () => {
  const engine = createEngine(pack()); let life = engine.act(engine.start("trader"), "become-worker");
  life = engine.advance(life); assert.equal(life.economy!.cash, 1030);
  for (let year = 0; year < 3; year++) {
    life = engine.act(life, "focus-trade"); life = engine.orderMarket(life, { side: "sell", asset: "pots", quantity: 1 });
    const cash = life.economy!.cash;
    life = engine.advance(life); assert.equal(life.economy!.cash, cash + 36, "Trading takes the place of annual wages.");
  }
  assert.equal(life.economy!.market!.tradingYears, 3); assert.equal(life.flags["trader-qualified"], true);
  assert.equal(life.character!.jobId, "worker");
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("buy-only orders and full-time work do not count as trader livelihood years", () => {
  const engine = createEngine(pack()); let life = engine.act(engine.start("not-trader"), "become-worker");
  life = engine.orderMarket(life, { side: "sell", asset: "pots", quantity: 1 }); life = engine.advance(life);
  assert.equal(life.economy!.market!.tradingYears, 0);
  life = engine.act(life, "focus-trade"); life = engine.orderMarket(life, { side: "buy", asset: "clay", quantity: 1 });
  life = engine.advance(life); assert.equal(life.economy!.market!.tradingYears, 0);
});

test("age and decisions gate new contracts, and fatal intervals never settle future orders", () => {
  const world = pack(); world.economy!.market!.minAge = 18;
  const engine = createEngine(world), child = engine.start("age");
  assert.throws(() => engine.orderMarket(child, { side: "buy", asset: "clay", quantity: 1 }), /from age 18/);
  const choiceWorld = pack(); choiceWorld.events.push({ id: "decision", title: "Decision", text: "Choose.", trigger: { type: "age", at: 0 },
    choices: [{ id: "continue", text: "Continue.", outcomes: [{ id: "done", text: "Done.", weight: 1, effects: [] }] }] });
  const choosing = createEngine(choiceWorld);
  assert.throws(() => choosing.orderMarket(choosing.start("choice"), { side: "buy", asset: "clay", quantity: 1 }), /decision/);
  const fatal = pack(); fatal.endings[0].kind = "death";
  fatal.mortality = { description: "Certain fixture.", sourceIds: [], bands: [{ minAge: 0, maxAge: 79, annualProbability: 1, ending: "end" }] };
  const death = createEngine(fatal), ordered = death.orderMarket(death.start("fatal"), { side: "buy", asset: "clay", quantity: 1 });
  const ended = death.advance(ordered);
  assert.equal(ended.phase, "ended"); assert.equal(ended.economy!.assets.clay, 4); assert.equal(ended.economy!.market!.orders.length, 1);
  assert.throws(() => death.cancelMarketOrder(ended, 1), /ended/);
});

test("disabling a market report in the editor removes its price signal from new publications", async () => {
  const { compileWorld, getBuiltinCatalog } = await import("../server/content.ts");
  const draft = getBuiltinCatalog().worlds[0];
  draft.disabledEventIds.push("market-poor-harvest");
  const published = compileWorld(draft);
  assert.equal(published.events.some(event => event.id === "market-poor-harvest"), false);
  assert.equal(published.economy!.market!.shocks.some(shock => shock.eventId === "market-poor-harvest"), false);
  assert.equal(draft.pack.economy!.market!.shocks.some(shock => shock.eventId === "market-poor-harvest"), true);
});

test("disabled work routes remove only their resource activity links from compiled publications", async () => {
  const { compileWorld } = await import("../server/content.ts");
  const world = pack();
  world.flags["supply-route"] = { label: "Supply work", initial: false };
  world.character!.activities.push({ id: "supply-work", text: "Prepare supplies", category: "career", outcomes: [{
    id: "supply-result", text: "Supplies prepared.", weight: 1, effects: [{ type: "flag", flag: "supply-route", value: true }],
  }] });
  world.economy!.assets[0].context = { activities: ["supply-work"] };
  world.economy!.assets[1].context = { jobs: ["potter"], activities: ["supply-work"] };
  const draft = { id: world.id, enabled: true, pack: world, disabledEventIds: [], routes: [{
    id: "supply", title: "Supply route", description: "Optional supply work.", flag: "supply-route", enabled: false,
  }] };
  const compiled = compileWorld(draft);
  assert.equal(compiled.character!.activities.some(activity => activity.id === "supply-work"), false);
  assert.equal(compiled.economy!.assets[0].context, undefined);
  assert.deepEqual(compiled.economy!.assets[1].context, { jobs: ["potter"] });
  assert.deepEqual(draft.pack.economy!.assets[0].context, { activities: ["supply-work"] });
});
