import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { getNetWorth, getVocationHoldings, getVocationInventoryValue } from "../src/economy.ts";
import { bid } from "../src/vocations/view.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import lives1 from "../worlds/demo/alexandria-lives-1.json" with { type: "json" };
import lives2 from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import lives3 from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };
import lives4 from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };

function ready(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

for (const [pack, historicalWorth] of [[lives1, 52], [lives2, 1436], [lives3, 1382]] as const) {
  test(pack.version + " retains historical wealth after buying vocation materials", () => {
    const engine = createEngine(pack);
    let life = ready(engine, engine.start("retained-vocation-wealth"));
    while (life.age < 16) life = ready(engine, engine.advance(life));
    life = engine.act(life, "v-buy-clay");
    assert.equal(life.economy!.cash, 52);
    assert.equal(life.vocations!.inventory.clay, 4);
    assert.equal(getVocationInventoryValue(engine.world, life), 0);
    assert.deepEqual(getVocationHoldings(engine.world, life), []);
    assert.equal(getNetWorth(engine.world, life), historicalWorth);
    assert.equal(life.stats.wealth, historicalWorth / engine.world.economy!.unitsPerPoint);
    assert.deepEqual(engine.load(engine.save(life)), life);
  });
}

test("current worlds value graded craft stock within the shared finite buyer budget", () => {
  const engine = createEngine(lives4), life = structuredClone(engine.start("current-vocation-wealth"));
  life.vocations!.inventory = { clay: 4, vessel: 2 };
  life.vocations!.lots = [{ item: "clay", quality: 1, quantity: 4 }, { item: "vessel", quality: 1, quantity: 2 }];
  // The current pack's buyer bid for a vessel; the buyer's budget funds exactly one.
  const vessel = bid(engine.world, "vessel", 1);
  life.vocations!.accounts.merchant = vessel;
  life.vocations!.demand.vessel = 2;
  assert.equal(getVocationInventoryValue(engine.world, life), 8 + vessel, "Four clay cost 8; the buyer can fund one vessel.");
  life.vocations!.demand.vessel = 0;
  assert.equal(getVocationInventoryValue(engine.world, life), 8);
});

test("flax and linen count as vocation holdings when no demo household shares their store", () => {
  const world: WorldPack = {
    schemaVersion: 1, id: "non-demo-vocations", version: "1", title: "Workshop", description: "Independent textile store fixture.", startYear: 1, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 100 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "Home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", unitsPerPoint: 10, currency: { singular: "drachma", plural: "drachmas", short: "dr" }, description: "Fixture prices.", assets: [] },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [], childNames: ["Child"],
      deathCauseDescription: "Fictional fixture.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: ["flax", "linen"].map(item => ({ id: "buy-" + item, text: "Buy " + item, category: "career", usesYearlyActivity: false,
        outcomes: [{ id: "bought-" + item, text: "Bought.", weight: 1, effects: [{ type: "vocation", action: "buy-" + item }] }] })) },
    vocations: { materials: { flax: { price: 3, stock: 10 }, linen: { price: 25, stock: 10 } }, recipes: {}, demand: {},
      actions: { "buy-flax": { kind: "buy", item: "flax", quantity: 2 }, "buy-linen": { kind: "buy", item: "linen", quantity: 1 } },
      accounts: { merchant: 1000, workshop: 1000, school: 1000, council: 1000 } },
  };
  const engine = createEngine(world), initial = engine.start("non-demo-textile-wealth");
  let life = engine.act(initial, "buy-flax");
  assert.equal(getVocationInventoryValue(world, life), 6);
  life = engine.act(life, "buy-linen");
  assert.equal(getVocationInventoryValue(world, life), 31);
  assert.equal(getNetWorth(world, life), getNetWorth(world, initial));
  assert.deepEqual(getVocationHoldings(world, life).map(item => item.item).sort(), ["flax", "linen"]);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
