import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { getDemoResourceValue, getNetWorth } from "../src/economy.ts";
import { initialTown, marketView } from "../src/demo/market.ts";
import { orderValue, merchantSaleValue } from "../src/demo/market-depth.ts";
import { getBirthRollResources } from "../client/models/birth-stat-roll.ts";
import { getWealthSummary } from "../client/models/wealth.ts";
import { getWealthComparison } from "../client/models/wealth-comparison.ts";
import { getSocietyWealthData } from "../client/models/society-wealth-data.ts";
import { buildPriceHistory } from "../client/demo/price-history.ts";
import { liveUntil } from "./fixtures/demo/world.ts";
import current from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
import type { WorldPack } from "../src/types.ts";

const world = current as unknown as WorldPack, engine = createEngine(world);
const adult = liveUntil(engine, "market-depth", life => life.age >= 18 && life.phase === "ready") as LifeStateWithDemo;
function stores(): LifeStateWithDemo {
  const life = structuredClone(adult);
  life.demo.household.grain = 1000; life.demo.household.flax = 0; life.demo.household.animals = { ox: 0, donkey: 0 };
  for (const item of Object.keys(life.demo.goods)) life.demo.goods[item as keyof typeof life.demo.goods] = 0;
  life.demo.year = { flood: "normal", army: "quiet", road: "safe", fresh: [] };
  life.demo.town.merchant.grain = world.demo!.market.targetGrainStock;
  life.demo.town.merchant.cash = 20000; life.demo.town.prices.grain = { buy: 1, sell: 2 };
  life.demo.town.pressure = { grain: 1500 }; life.demo.lastTradeAge = null;
  life.economy!.cash = 5000;
  return life;
}

test("whole-store wealth uses depth proceeds and transfers unchanged into cash", () => {
  const life = stores(), expected = orderValue(world.demo!, life.demo, "grain", "sell", 1000).total;
  assert.equal(expected, 437);
  assert.equal(getDemoResourceValue(world, life), expected);
  const row = getWealthSummary(world, life)!.assets.find(row => row.id === "demo:grain")!;
  assert.equal(row.quantity * row.value, expected);
  assert.equal(getBirthRollResources(world, life).find(row => row.id === "demo-resource:grain")!.marketValue, expected);
  const sold = engine.demo(life, { type: "trade", item: "grain", side: "sell", quantity: 1000, counterparty: "merchant", reserveOverride: true });
  assert.equal(sold.economy!.cash - life.economy!.cash, expected);
  assert.equal(getDemoResourceValue(world, sold), 0);
  assert.equal(getNetWorth(world, sold), getNetWorth(world, life));
});

test("retained fixed-price worlds preserve their original store valuation", () => {
  assert.equal(getDemoResourceValue(retained as unknown as WorldPack, stores()), 1000);
});

test("authored households rank nonlinear depth-valued resource rolls exactly", () => {
  const fixture = structuredClone(world);
  fixture.id = "depth-benchmark"; fixture.version = "1";
  fixture.origins = [{ id: "one", title: "One", text: "A benchmark household.", weight: 1, effects: [], statRanges: { wealth: { min: 0, max: 0 } } }];
  fixture.demo!.startingResources!.origins = { one: { grain: { min: 450, max: 454 } } };
  const state = stores(); state.economy!.assets = {}; state.economy!.cash = 0; state.economy!.debt = 0;
  state.vocations!.inventory = {}; state.vocations!.lots = [];
  const reference = { ...state.demo, town: initialTown(fixture.demo!), year: { flood: "normal", army: "quiet", road: "safe", fresh: [] } } as typeof state.demo;
  const values = Array.from({ length: 5 }, (_, index) => merchantSaleValue(fixture.demo!, reference, "grain", 450 + index));
  const roll = getSocietyWealthData(fixture)[0].resources.find(roll => roll.count === 5)!;
  assert.deepEqual(values, values.map((_, index) => roll.valueAt!(index)));
  state.demo = reference; state.demo.household.grain = 452;
  const result = getWealthComparison(fixture, state)!;
  assert.equal(result.medianWealth, values[2]);
  assert.equal(result.percentile, values.filter(value => value < result.netWorth).length / values.length * 100);
});

test("price history matches market depth quotes before and after an accepted sale", () => {
  const first = buildPriceHistory(world, adult).at(-1)!;
  const quote = marketView(world.demo!, adult).quotes.find(quote => quote.item === "grain")!;
  assert.deepEqual(first.prices.grain, { buy: quote.buy, sell: quote.sell });
  const quantity = Math.min(50, adult.demo.household.grain);
  assert.ok(quantity > 0);
  const sold = engine.demo(adult, { type: "trade", item: "grain", side: "sell", quantity, counterparty: "merchant", reserveOverride: true });
  const after = marketView(world.demo!, sold as LifeStateWithDemo).quotes.find(quote => quote.item === "grain")!;
  assert.deepEqual(buildPriceHistory(world, sold).at(-1)!.prices.grain, { buy: after.buy, sell: after.sell });
});
