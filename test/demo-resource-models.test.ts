import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { getDemoResourceValue, getNetWorth } from "../src/economy.ts";
import { initialTown } from "../src/demo/market.ts";
import { TRADE_ITEMS } from "../src/demo/types.ts";
import { getBirthRollResources, getBirthRollStats, getVisibleBirthRollResources } from "../client/models/birth-stat-roll.ts";
import { getSocietyWealthData } from "../client/models/society-wealth-data.ts";
import { getWealthSummary } from "../client/models/wealth.ts";
import current from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import previous from "../worlds/demo/alexandria-lives-1.json" with { type: "json" };

const engine = createEngine(current);

test("new resource displays reconcile actual household rolls and wealth without changing the life", () => {
  const life = engine.start("demo-resource-models"), before = engine.save(life);
  const resources = getVisibleBirthRollResources(engine.world, life);
  assert.equal(resources[0].label, "Grain");
  assert.equal(resources.filter(resource => resource.id.startsWith("demo-resource:")).length, TRADE_ITEMS.length);
  for (const item of TRADE_ITEMS) {
    const resource = resources.find(resource => resource.id === `demo-resource:${item}`)!;
    const ranges = engine.world.demo!.startingResources!;
    assert.deepEqual(resource.range, ranges.origins?.[life.originId]?.[item] ?? ranges.defaults[item]);
    assert.equal(resource.unitPrice, life.demo!.town.prices[item].buy);
    assert.equal(resource.marketValue, resource.value * resource.unitPrice);
  }
  const summary = getWealthSummary(engine.world, life)!;
  assert.equal(summary.assetTotal, summary.assets.reduce((total, asset) => total + asset.value * asset.quantity, 0));
  assert.equal(summary.assetTotal, getDemoResourceValue(engine.world, life));
  assert.equal(summary.netWorth, summary.cash + summary.assetTotal + summary.committedValue - summary.debt);
  assert.equal(getBirthRollStats(engine.world, life).find(stat => stat.id === engine.world.economy!.stat)!.value, summary.netWorth);
  assert.equal(engine.save(life), before);
});

test("resource displays use current merchant bids and omit birth ranges after progression", () => {
  const born = engine.start("demo-resource-current-bids");
  const life = structuredClone(born);
  life.age = 1; life.year += 1;
  life.demo!.town.prices.grain.buy *= 2;
  const before = JSON.stringify(life);
  const resources = getBirthRollResources(engine.world, life);
  assert.ok(resources.every(resource => resource.range === undefined));
  const grain = resources.find(resource => resource.id === "demo-resource:grain")!;
  assert.equal(grain.unitPrice, life.demo!.town.prices.grain.buy);
  assert.equal(grain.value, life.demo!.household.grain);
  assert.equal(getWealthSummary(engine.world, life)!.netWorth, getNetWorth(engine.world, life));
  assert.equal(JSON.stringify(life), before);
});

test("society resource distributions include each background's configured rolls at initial bids", () => {
  const world = structuredClone(engine.world), oldWorld = structuredClone(world);
  delete oldWorld.demo!.startingResources;
  const groups = getSocietyWealthData(world), classic = getSocietyWealthData(oldWorld);
  const prices = initialTown(world.demo!).prices, configuration = world.demo!.startingResources!;
  world.origins.forEach((origin, index) => {
    const total = (rolls: typeof groups[number]["resources"], maximum = false) => rolls.reduce((sum, roll) => sum + roll.first + (maximum ? roll.step * (roll.count - 1) : 0), 0);
    const expected = (maximum = false) => TRADE_ITEMS.reduce((sum, item) => {
      const range = configuration.origins?.[origin.id]?.[item] ?? configuration.defaults[item];
      return sum + (maximum ? range.max : range.min) * prices[item].buy;
    }, 0);
    assert.equal(total(groups[index].resources), total(classic[index].resources) + expected());
    assert.equal(total(groups[index].resources, true), total(classic[index].resources, true) + expected(true));
    assert.equal(groups[index].wealthAt(0), classic[index].wealthAt(0));
  });
});

test("retained vocation revisions keep their previous display and wealth valuation", () => {
  const oldEngine = createEngine(previous), life = oldEngine.start("retained-resource-models"), before = oldEngine.save(life);
  assert.ok(getBirthRollResources(oldEngine.world, life).every(resource => !resource.id.startsWith("demo-resource:")));
  const summary = getWealthSummary(oldEngine.world, life)!;
  assert.ok(summary.assets.every(asset => !asset.id.startsWith("demo:")));
  assert.equal(getDemoResourceValue(oldEngine.world, life), 0);
  assert.equal(summary.netWorth, summary.cash + summary.assetTotal + summary.committedValue - summary.debt);
  assert.equal(oldEngine.save(life), before);
});
