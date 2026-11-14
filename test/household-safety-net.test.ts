import assert from "node:assert/strict";
import test from "node:test";
import type { WorldPack } from "../src/types.ts";
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
import { initialHousehold, harvest, payRent, feedHousehold, spoilAndSpin, householdView } from "../src/demo/household.ts";
import { initialTown } from "../src/demo/market.ts";
import { demoContext } from "../src/demo/state.ts";
import { settleFarmCapabilities } from "../src/capabilities/farming.ts";
import design from "../design/skill-tree/catalog.json" with { type: "json" };
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };

/**
 * An ordinary household does not starve through a slip in the plan or an empty purse while it still owns things:
 * fields planned for flax without flax seed are sown with grain, and goods are sold for food before anyone goes hungry.
 */

function fixture(flaxSeed = 0) {
  const world = structuredClone(base) as unknown as WorldPack;
  world.capabilities = { version: 1, nodes: design.nodes.filter(node => node.branch === "Farming") };
  const life = {
    schemaVersion: 1, worldId: world.id, worldVersion: world.version, worldFingerprint: "fixture", seed: "safety-net", rngState: 1,
    age: 20, year: -330, originId: world.origins[0].id, phase: "ready", pendingEventId: null, endingId: null,
    stats: { health: 100, knowledge: 50, wealth: 50, bonds: 50 }, flags: {}, journal: [], commands: [], eventCounts: {}, lastEventAge: {},
    character: { name: "Farmer", skills: { farming: 50 }, jobId: "tenant-farmer", children: [], relationshipStatus: "single", lastActivityAge: null },
    economy: { cash: 0, debt: 0, assets: {} },
    demo: { household: initialHousehold(world.demo!), goods: { silver: 0, gold: 0, silk: 0, linen: 0 }, town: initialTown(world.demo!), year: { flood: "normal", army: "quiet", road: "safe" }, reputation: 20, built: [], works: {}, lastTradeAge: null },
    vocations: { inventory: { "flax-seed": flaxSeed }, lots: [{ item: "flax-seed", quality: 1, quantity: flaxSeed }], stock: {}, accounts: { merchant: 0, workshop: 0, school: 0, council: 0 }, demand: {}, completed: {}, workedAge: null },
    capabilities: { learned: {}, evidence: [] },
  } as unknown as LifeStateWithDemo;
  return { world, life };
}
function ctx(world: WorldPack, life: LifeStateWithDemo) {
  return demoContext(world, life, effects => {
    for (const effect of effects) {
      if (effect.type === "cash") life.economy!.cash += effect.delta;
      if (effect.type === "stat") life.stats[effect.stat] += effect.delta;
    }
  }, (id, text) => life.journal.push({ type: "event", id, text, age: life.age, year: life.year }));
}
function settle(world: WorldPack, life: LifeStateWithDemo) {
  const completedAge = life.age;
  life.age++; life.year++;
  const c = ctx(world, life);
  harvest(c); payRent(c); feedHousehold(c); spoilAndSpin(c);
  settleFarmCapabilities(world, life, completedAge);
}
const ids = (life: LifeStateWithDemo) => life.journal.map(entry => entry.id);

test("fields planned for flax with no flax seed are sown with grain, and the plan itself is kept", () => {
  const { world, life } = fixture(0);
  const h = life.demo.household;
  h.grain = 500; h.flaxPlots = h.plots;
  const forecast = householdView(world.demo!, life, world);
  assert.ok(forecast.expectedHarvest > 0, "the forecast shows the grain those fields will grow");
  assert.equal(forecast.expectedFlax, 0);
  settle(world, life);
  assert.ok(ids(life).includes("household-flax-to-grain"), "the journal says why grain was sown");
  const harvestLine = life.journal.find(entry => entry.id === "household-harvest")!;
  assert.match(harvestLine.text, /harvest of \d+ measures of grain/);
  assert.doesNotMatch(harvestLine.text, /lay fallow/);
  assert.equal(h.flaxPlots, h.plots, "the player's plan is unchanged for next year");
});

test("flax is sown only on the plots its seed covers; the rest grow grain", () => {
  const { world, life } = fixture(2);
  const h = life.demo.household;
  h.grain = 500; h.flaxPlots = h.plots;
  const forecast = householdView(world.demo!, life, world);
  assert.ok(forecast.expectedHarvest > 0 && forecast.expectedFlax > 0, "one plot of flax, the other of grain");
  settle(world, life);
  assert.ok(h.flax > 0, "the seeded plot grew flax");
  assert.match(life.journal.find(entry => entry.id === "household-flax-to-grain")!.text, /1 plot/);
});

test("with flax seed for every plot, the plan is sown as set", () => {
  const { world, life } = fixture(20);
  const h = life.demo.household;
  h.grain = 500; h.flaxPlots = h.plots;
  settle(world, life);
  assert.ok(!ids(life).includes("household-flax-to-grain"));
  assert.ok(h.flax > 0);
});

test("a household with no grain and no cash sells its goods for food before going hungry", () => {
  const { world, life } = fixture();
  const h = life.demo.household;
  h.grain = 0; h.plots = 0; life.demo.goods.linen = 150; h.flax = 30;
  const health = life.stats.health;
  feedHousehold(ctx(world, life));
  assert.equal(h.lastShortfallBps, 0, "everyone ate");
  assert.equal(life.stats.health, health, "no hunger, no health lost");
  assert.ok(life.demo.goods.linen < 150 && life.demo.goods.linen > 0, "linen was sold first, and only what food needed");
  assert.ok(ids(life).includes("household-sold-for-food"));
  assert.ok(!ids(life).includes("household-hunger"));
});

test("a household with nothing left to sell still goes hungry", () => {
  const { world, life } = fixture();
  const h = life.demo.household;
  h.grain = 0; h.plots = 0;
  feedHousehold(ctx(world, life));
  assert.ok(h.lastShortfallBps > 0);
  assert.ok(ids(life).includes("household-hunger"));
});

test("goods are sold only for what is missing, and never more than the merchant can pay for", () => {
  const { world, life } = fixture();
  const h = life.demo.household;
  h.grain = 0; h.plots = 0; life.demo.goods.linen = 500;
  life.demo.town.merchant.cash = 100;
  feedHousehold(ctx(world, life));
  assert.ok(life.demo.town.merchant.cash >= 0, "the merchant never pays money it does not have");
  assert.ok(life.demo.goods.linen > 490, "only a few bolts change hands");
});

test("a household with fields and hands but no seed borrows seed grain from the royal granary and repays it at harvest", () => {
  const { world, life } = fixture();
  const h = life.demo.household;
  h.grain = 0; h.flaxPlots = 0;
  const forecast = householdView(world.demo!, life, world);
  assert.ok(forecast.expectedHarvest > 0, "the forecast counts on the borrowed seed");
  settle(world, life);
  assert.ok(ids(life).includes("household-seed-loan"));
  assert.ok(ids(life).includes("household-seed-loan-repaid"));
  assert.doesNotMatch(life.journal.find(entry => entry.id === "household-harvest")!.text, /lay fallow/);
  const ledger = [...life.capabilities!.evidence].reverse().find(entry => entry.kind === "farm-ledger")!;
  assert.ok(Number(ledger.data.grainHarvest) > 0);
});

test("seed is not borrowed when the store already holds it", () => {
  const { world, life } = fixture();
  life.demo.household.grain = 500;
  settle(world, life);
  assert.ok(!ids(life).includes("household-seed-loan"));
});
