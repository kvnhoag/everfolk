import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { getNetWorth } from "../src/economy.ts";
import type { LifeEngine, LifeState } from "../src/types.ts";
import { buildPriceHistory } from "../client/demo/price-history.ts";
import { GOODS, lifeRecordChanges } from "../client/models/life-record.ts";
import { demoWorld } from "./fixtures/demo/world.ts";

function fixture(): LifeEngine {
  const world = demoWorld();
  world.economy!.uncappedResources = true;
  world.economy!.assets.push({ id: "trade-stock", title: "Trade stock", description: "Projection fixture.", value: 10, initialRange: { min: 4, max: 4 } });
  world.character!.jobs.push({ id: "contract-trader", title: "Contract trader", description: "Projection fixture.", minAge: 0, yearlyEffects: [] });
  world.character!.activities.push({ id: "contract-focus", text: "Arrange contracts", category: "career", outcomes: [{ id: "contracts-arranged", text: "Contracts arranged.", weight: 1, effects: [] }] });
  world.economy!.market = { minAge: 0, feePercent: 10, maxQuantity: 20, maxOrders: 10, goods: ["trade-stock"], traderJob: "contract-trader", traderYears: 3, traderFocusActivity: "contract-focus", shocks: [] };
  world.influences = [{ id: "projection.gift", label: "A gift", baseWeight: 1, effects: [{ type: "cash", delta: 10 }] }];
  for (const origin of world.origins) {
    origin.statRanges = { ...origin.statRanges, wealth: { min: 20, max: 20 }, health: { min: 90, max: 90 } };
  }
  world.yearlyEffects = []; world.yearlyRules = [];
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  return createEngine(world);
}

function ready(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

test("life records project market reservations and cancellation while retaining influence attribution", () => {
  const engine = fixture(), initial = ready(engine, engine.start("market-record-projection"));
  let life = engine.orderMarket(initial, { side: "buy", asset: "trade-stock", quantity: 2 });
  // Wealth is shown as cash plus the value of goods (here the reserved order); together they are the true change.
  const money = (changes: readonly { id: string; delta: number }[] | undefined) => (changes ?? []).filter(change => change.id === "wealth" || change.id === GOODS).reduce((total, change) => total + change.delta, 0);
  assert.equal(money(lifeRecordChanges(life, engine).years.get(0)), -4);
  life = engine.cancelMarketOrder(life, 1);
  assert.equal(money(lifeRecordChanges(life, engine).years.get(0)), 0);
  life = engine.influence(life, { type: "influence", mode: "apply", entry: "projection.gift", power: 1, source: { contractId: "lives.testnet", tokenId: "1" } });
  life = engine.orderMarket(life, { side: "sell", asset: "trade-stock", quantity: 1 });
  life = ready(engine, engine.advance(life));
  const saved = engine.save(life), result = lifeRecordChanges(life, engine);
  const changes = money([...result.years.values()].flat());
  assert.equal(changes, getNetWorth(engine.world, life) - getNetWorth(engine.world, initial));
  const influenceIndex = life.journal.findIndex(entry => entry.type === "influence");
  assert.equal(result.entries.get(influenceIndex)?.find(change => change.id === "wealth")?.delta, 10);
  assert.equal(engine.save(life), saved);
  assert.deepEqual(lifeRecordChanges(life, engine), result);
});

test("demo price history keeps every year across annual-market orders and cancellation", () => {
  const engine = fixture();
  let life = ready(engine, engine.start("market-price-projection"));
  const snapshots = [life];
  life = engine.orderMarket(life, { side: "buy", asset: "trade-stock", quantity: 2 });
  life = engine.cancelMarketOrder(life, 1);
  life = engine.orderMarket(life, { side: "buy", asset: "trade-stock", quantity: 3 });
  life = engine.orderMarket(life, { side: "sell", asset: "trade-stock", quantity: 1 });
  for (let year = 0; year < 3; year++) {
    life = ready(engine, engine.advance(life));
    snapshots.push(life);
  }
  const saved = engine.save(life), history = buildPriceHistory(engine.world, life);
  assert.deepEqual(history.map(point => point.age), [0, 1, 2, 3]);
  for (const point of history) {
    const expected = snapshots[point.age].demo!;
    assert.deepEqual(point.prices, expected.town.prices);
    assert.equal(point.merchantGrainStock, expected.town.merchant.grain);
    assert.equal(point.flood, expected.year.flood);
  }
  assert.deepEqual(buildPriceHistory(engine.world, life), history);
  assert.equal(engine.save(life), saved);
});
