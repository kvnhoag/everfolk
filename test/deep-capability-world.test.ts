import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { buildDeepSkillWorld } from "../src/deep-capabilities/world.ts";
import { validateWorld } from "../src/validate.ts";
import { loadLifeWorld } from "../client/chain/life-world.ts";
import base from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import shipped from "../worlds/demo/alexandria-deep-1.json" with { type: "json" };
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";

function fixture() {
  const world = buildDeepSkillWorld(base as unknown as WorldPack);
  delete world.knowledge;
  delete world.demo!.startingResources;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  delete world.health!.mortalityCalibration;
  const interrupts = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(event => interrupts.has(event.id));
  world.yearlyRules = []; world.yearlyEffects = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = 100;
  world.origins = [{ id: "test-household", title: "Test household", text: "High-proficiency fixture isolates actual proof and ledger requirements.", weight: 1, effects: [] }];
  world.stats.wealth.initial = 100;
  const engine = createEngine(world);
  let life = engine.start("deep-tree-runtime");
  while (life.age < 18) life = next(engine, life);
  return { world, engine, life };
}
function ready(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}
const next = (engine: LifeEngine, life: LifeState) => ready(engine, engine.advance(life));
const act = (engine: LifeEngine, life: LifeState, id: string) => engine.act(life, "v-" + id);

test("deep world is reproducible, contains 65 capabilities and preserves earlier revisions", async () => {
  const before = JSON.stringify(base);
  const world = buildDeepSkillWorld(base as unknown as WorldPack);
  validateWorld(world);
  assert.deepEqual(world, shipped);
  assert.equal(world.deepCapabilities!.rules.length, 65);
  assert.equal(world.events.filter(event => event.id.startsWith("cap-tree-")).length, 24);
  assert.equal(JSON.stringify(base), before);
  for (const version of ["alexandria-lives-1", "alexandria-lives-2", "alexandria-deep-1"]) {
    assert.equal((await loadLifeWorld(version)).version, version);
  }
  assert.equal(createEngine(base).start("old-life").deepCapabilities, undefined);
});

test("high proficiencies do not bypass supervised work, paid preparation or two production years", () => {
  const { engine, life: initial } = fixture();
  let life = initial;
  assert.deepEqual(life.deepCapabilities!.learned, {});
  assert.throws(() => act(engine, life, "make-garment"), /starter|supervis|A3|material preparation/i);
  life = act(engine, life, "cap-tool-practice");
  assert.ok(life.deepCapabilities!.learned.A1);
  assert.deepEqual(initial.deepCapabilities!.learned, {});
  assert.throws(() => act(engine, life, "cap-measurement-exercise"), /year|activity|work/i);
  life = act(engine, next(engine, life), "cap-measurement-exercise");
  assert.ok(life.deepCapabilities!.learned.A2);
  for (let year = 0; year < 2; year++) {
    life = act(engine, next(engine, life), "buy-flax");
    life = act(engine, life, "cap-prepare-textiles");
  }
  assert.ok(life.deepCapabilities!.learned.A3);
  assert.equal(life.deepCapabilities!.learned.A4, undefined);
  for (let year = 0; year < 2; year++) {
    life = next(engine, life);
    life = act(engine, life, "buy-linen");
    life = act(engine, life, "buy-thread");
    life = act(engine, life, "make-garment");
    if (year === 0) assert.equal(life.deepCapabilities!.learned.A4, undefined);
  }
  assert.ok(life.deepCapabilities!.learned.A4);
  assert.ok(life.deepCapabilities!.learned.AT5);
  const production = life.deepCapabilities!.evidence.filter(record => record.kind === "production");
  assert.equal(production.length, 2);
  assert.ok(production.every(record => record.facts.supervised === true && record.facts.paidInputs === true));
  assert.deepEqual(engine.load(engine.save(life)), life);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.ok(Object.isFrozen(life.deepCapabilities!.learned));
});

test("practice changes relevant scores without granting completion evidence", () => {
  const { world } = fixture();
  for (const definition of Object.values(world.character!.skills)) definition.initial = 0;
  const engine = createEngine(world);
  let life = engine.start("practice-proof-boundary");
  while (life.age < 18) life = next(engine, life);
  const before = { ...life.character!.skills };
  life = act(engine, life, "practice-craft");
  assert.equal(life.character!.skills.craft, before.craft + 5);
  assert.equal(life.character!.skills.carving, before.carving + 1);
  assert.equal(life.character!.skills.reckoning, before.reckoning + 1);
  assert.equal(life.character!.skills.philosophy, before.philosophy);
  assert.deepEqual(life.deepCapabilities!.learned, {});
  assert.equal(life.deepCapabilities!.evidence.length, 0);
});

test("capability conditions and annual-work restrictions are validated", () => {
  const world = buildDeepSkillWorld(base as unknown as WorldPack);
  const activity = world.character!.activities.find(activity => activity.id === "v-cap-measurement-exercise")!;
  activity.when = { type: "capability", node: "missing-node" };
  assert.throws(() => validateWorld(world), /unknown capability/i);
  activity.when = { type: "capability", node: "A1", learned: false };
  assert.doesNotThrow(() => validateWorld(world));
  activity.usesYearlyActivity = false;
  assert.throws(() => validateWorld(world), /year|annual|labour/i);
});
