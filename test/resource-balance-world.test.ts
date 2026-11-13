import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { getWealthComparison } from "../client/models/wealth-comparison.ts";
import { householdView } from "../src/demo/household.ts";
import { ordinarySeedGrain } from "../src/capabilities/farming.ts";
import { buildResourceBalanceWorld } from "../src/vocations/resource-balance-world.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import retained from "../worlds/demo/alexandria-lives-8-wsl-contributions.json" with { type: "json" };
import current from "../worlds/demo/alexandria-lives-9-wsl-resources.json" with { type: "json" };

const world = current as unknown as WorldPack;

test("balanced release reproduces exactly and keeps the retained world unchanged", () => {
  const before = JSON.stringify(retained);
  assert.deepEqual(buildResourceBalanceWorld(retained as unknown as WorldPack), current);
  assert.equal(JSON.stringify(retained), before);
  validateWorld(world);
  assert.throws(() => buildResourceBalanceWorld(world), /retained lives-8/);
});

test("farm births are modest across rolls, including the strongest permitted roll", () => {
  const engine = createEngine(world);
  let farmer: LifeState | undefined, count = 0;
  for (let index = 0; index < 96; index++) {
    const life = engine.start(`balance-${index}`);
    if (life.originId !== "tenant-farming-household") continue;
    farmer = life; count++;
    assert.ok(life.demo!.household.grain >= 45 && life.demo!.household.grain <= 75);
    assert.equal(life.demo!.household.animals.donkey, 0);
    assert.ok(life.demo!.household.flax >= 0 && life.demo!.household.flax <= 2);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.ok(count > 5);
  const best = structuredClone(farmer!);
  best.economy!.cash = 90;
  best.demo!.household.grain = 75;
  best.demo!.household.flax = 2;
  assert.ok(getWealthComparison(world, best)!.percentile < 75, "even the maximum farm birth is below the top quarter");
});

test("normal crop income, food, seed and market pressure scale together", () => {
  const engine = createEngine(world), oldEngine = createEngine(retained as unknown as WorldPack);
  const life = engine.start("balance-1"), old = oldEngine.start("balance-1");
  const preview = householdView(world.demo!, life as Parameters<typeof householdView>[1]);
  const previous = householdView(oldEngine.world.demo!, old as Parameters<typeof householdView>[1]);
  assert.equal(preview.expectedHarvest, previous.expectedHarvest / 10);
  assert.equal(preview.expectedEating, previous.expectedEating / 10);
  assert.equal(ordinarySeedGrain(life, world.demo), 2);
  assert.ok(preview.expectedHarvest - preview.expectedRent - preview.expectedEating > 0, "an ordinary household can feed itself in a normal year");
  assert.equal(world.demo!.market.depth!.halfUnits.grain, oldEngine.world.demo!.market.depth!.halfUnits.grain / 10);
  assert.equal(world.demo!.market.basePrice.grain, oldEngine.world.demo!.market.basePrice.grain);
  assert.deepEqual(world.demo!.service.wage, oldEngine.world.demo!.service.wage);
  const settled = engine.advance(life);
  assert.equal(settled.age, 1);
  assert.equal(settled.demo!.household.lastShortfallBps, 0);
  assert.ok(settled.demo!.household.grain > life.demo!.household.grain, "a normal first harvest leaves a modest reserve after food and seed");
  assert.ok(settled.demo!.household.grain < world.demo!.household.storeCapacity);
  assert.deepEqual(engine.load(engine.save(settled)), settled);
  for (const [id, action] of Object.entries(world.vocations!.actions)) {
    const prior = oldEngine.world.vocations!.actions[id];
    if (action.kind === "work" && prior.kind === "work" && prior.inputs?.grain) assert.equal(action.inputs!.grain, Math.max(1, Math.floor(prior.inputs.grain / 10)));
  }
});

test("new births resolve the balanced pack while both revisions retain exact save replay", async () => {
  assert.equal((await loadLifeWorld("alexandria-lives-9")).version, world.version);
  assert.equal((await loadLifeWorld("alexandria-lives-8")).version, retained.version);
  for (const pack of [world, retained as unknown as WorldPack]) {
    const engine = createEngine(pack), life = engine.start("balanced-resource-replay");
    assert.equal(engineForLife(life).fingerprint, engine.fingerprint);
    assert.deepEqual(loadAnyLife(engine.save(life)), life);
  }
});
