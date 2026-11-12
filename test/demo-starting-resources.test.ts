import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { getDemoResourceValue, getNetWorth } from "../src/economy.ts";
import { validateWorld } from "../src/validate.ts";
import { TRADE_ITEMS } from "../src/demo/types.ts";
import type { TradeItem } from "../src/demo/types.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import current from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import previous from "../worlds/demo/alexandria-lives-1.json" with { type: "json" };

function holding(life: LifeState, item: TradeItem): number {
  const demo = life.demo!;
  return item === "grain" || item === "flax" ? demo.household[item]
    : item === "ox" || item === "donkey" ? demo.household.animals[item] : demo.goods[item];
}
function ready(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

test("new freeplay births roll actual household holdings by origin and count current market bids", () => {
  const engine = createEngine(current), missing = new Set(engine.world.origins.map(origin => origin.id));
  for (let index = 0; index < 2048 && missing.size; index++) {
    const life = engine.start("demo-resource-birth-" + index), config = engine.world.demo!.startingResources!;
    missing.delete(life.originId);
    let value = 0;
    for (const item of TRADE_ITEMS) {
      const quantity = holding(life, item), range = config.origins?.[life.originId]?.[item] ?? config.defaults[item];
      assert.ok(Number.isSafeInteger(quantity) && quantity >= range.min && quantity <= range.max, life.originId + ": " + item);
      value += quantity * life.demo!.town.prices[item].buy;
    }
    assert.equal(getDemoResourceValue(engine.world, life), value);
    assert.equal(getNetWorth(engine.world, life), life.economy!.cash + value - life.economy!.debt);
    assert.equal(life.stats[engine.world.economy!.stat], getNetWorth(engine.world, life) / engine.world.economy!.unitsPerPoint);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.equal(missing.size, 0);
});

test("birth rolls use only the demo stream after scheduling, and fixed quantities consume no extra draw", () => {
  const disabled = structuredClone(current) as WorldPack;
  delete disabled.demo!.startingResources;
  const seed = "separate-demo-resource-stream", baseline = createEngine(disabled).start(seed), rolled = createEngine(current).start(seed);
  assert.equal(rolled.rngState, baseline.rngState);
  assert.deepEqual(rolled.demo!.schedule, baseline.demo!.schedule);
  assert.deepEqual(rolled.demo!.year, baseline.demo!.year);
  const fixed = structuredClone(disabled);
  fixed.demo!.startingResources = { defaults: Object.fromEntries(TRADE_ITEMS.map(item => [item, { min: item === "grain" ? 500 : 0, max: item === "grain" ? 500 : 0 }])) as NonNullable<NonNullable<WorldPack["demo"]>["startingResources"]>["defaults"] };
  const fixedLife = createEngine(fixed).start(seed);
  assert.equal(fixedLife.demo!.rng, baseline.demo!.rng);
  assert.equal(fixedLife.demo!.household.grain, 500);
});

test("retained freeplay resources keep their previous starts, valuation and exact world registration", async () => {
  const engine = createEngine(previous), born = engine.start("previous-demo-resource-birth");
  assert.equal(born.demo!.household.grain, engine.world.demo!.household.startingGrain);
  assert.equal(getDemoResourceValue(engine.world, born), 0);
  assert.equal(getNetWorth(engine.world, born), born.economy!.cash);
  assert.deepEqual(engine.load(engine.save(born)), born);
  const retained = await loadLifeWorld(previous.version), latest = await loadLifeWorld(current.version);
  assert.equal(retained.version, "alexandria-lives-1");
  assert.equal(retained.demo!.startingResources, undefined);
  assert.deepEqual(retained.demo, previous.demo);
  assert.deepEqual(latest.demo!.startingResources, current.demo.startingResources);
});

test("demo trade, vocation supplies and annual settlement keep wealth synchronized to real inventory", () => {
  const world = structuredClone(current) as WorldPack;
  world.yearlyRules = []; world.yearlyEffects = [];
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const origin of world.origins) origin.statRanges = { ...origin.statRanges, health: { min: 90, max: 90 }, wealth: { min: 100, max: 100 } };
  const engine = createEngine(world);
  let life = ready(engine, engine.start("demo-resource-transfers"));
  while (life.age < 18) life = ready(engine, engine.advance(life));
  const check = () => assert.equal(life.stats[world.economy!.stat], getNetWorth(world, life) / world.economy!.unitsPerPoint);
  check();
  life = engine.act(life, "v-buy-linen"); check();
  assert.ok(life.demo!.goods.linen > 0);
  life = engine.demo(life, { type: "trade", item: "linen", side: "sell", quantity: 1, counterparty: "merchant" }); check();
  life = ready(engine, engine.advance(life)); check();
  assert.deepEqual(engine.load(engine.save(life)), life);
});

for (const [label, mutate] of [
  ["unknown origin", (world: WorldPack) => { world.demo!.startingResources!.origins!["unknown-home"] = {}; }],
  ["missing default", (world: WorldPack) => { delete (world.demo!.startingResources!.defaults as Partial<Record<TradeItem, unknown>>).grain; }],
  ["reversed range", (world: WorldPack) => { world.demo!.startingResources!.defaults.flax = { min: 2, max: 1 }; }],
  ["fractional quantity", (world: WorldPack) => { world.demo!.startingResources!.defaults.flax.max = 0.5; }],
  ["unsafe combined value", (world: WorldPack) => { world.demo!.startingResources!.defaults.gold.max = 1_000_000_000_000; }],
] as const) {
  test("starting resource validation rejects " + label, () => {
    const world = structuredClone(current) as WorldPack;
    mutate(world);
    assert.throws(() => validateWorld(world), /startingResources/);
  });
}
