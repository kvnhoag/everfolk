import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { validateWorld } from "../src/validate.ts";
import { matchesCondition } from "../src/conditions.ts";
import { buildCapabilityWorld } from "../src/vocations/capability-world.ts";
import { buildVocationWorld } from "../src/vocations/world.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import base from "../worlds/demo/alexandria-demo-2.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };

function fixture() {
  const world = buildCapabilityWorld(base as unknown as WorldPack);
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  world.stats.wealth.initial = 100;
  for (const origin of world.origins) { origin.effects = []; origin.statRanges = {}; }
  delete world.demo!.startingResources;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  delete world.health!.mortalityCalibration;
  return createEngine(world);
}
function settleChoices(engine: ReturnType<typeof createEngine>, life: LifeState): LifeState {
  while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id);
  return life;
}

test("all 65 skills are embedded only in the new immutable birth revision", () => {
  const world = buildCapabilityWorld(base as unknown as WorldPack);
  validateWorld(world);
  assert.equal(world.version, "alexandria-lives-3");
  assert.equal(world.capabilities!.nodes.length, 65);
  assert.equal(Math.max(...world.capabilities!.nodes.map(n => n.depth)), 10);
  assert.deepEqual(new Set(world.capabilities!.nodes.map(n => n.branch)), new Set(["Farming", "Artisan", "Philosophy", "Trade"]));
  assert.deepEqual(buildVocationWorld(base as unknown as WorldPack), retained);
  const old = createEngine(retained as unknown as WorldPack);
  const life = old.start("retained-skill-replay");
  assert.equal(life.capabilities, undefined);
  assert.deepEqual(old.load(old.save(life)), life);
});

test("accepted skill work uses the annual action and survives save, load and replay", () => {
  const engine = fixture();
  let life = engine.start("skill-tree-integrated-work");
  while (life.age < 12 && life.phase !== "ended") life = settleChoices(engine, engine.advance(life));
  assert.equal(life.phase, "ready");
  const before = structuredClone(life);
  const action = engine.getActivities(life).find(a => a.id === "cap-work-a1");
  assert.ok(action?.available, action?.reason ?? "root work was not exposed");
  const after = engine.act(life, action.id);
  assert.deepEqual(life, before, "accepted work never mutates its input snapshot");
  assert.ok(after.capabilities!.evidence.length > 0);
  assert.equal(after.character!.lastActivityAge, after.age);
  assert.ok(after.capabilities!.learned.A1);
  assert.throws(() => engine.act(after, action.id), /year|complete|available/i);
  assert.deepEqual(engine.replay(after.seed, after.commands), after);
  assert.deepEqual(engine.load(engine.save(after)), after);
  assert.equal(matchesCondition({ type: "capability", node: "A1" }, after), true);
  assert.equal(matchesCondition({ type: "capability", node: "AT10" }, after), false);
});

test("capability work cannot be smuggled into a free activity or an event", () => {
  const world = buildCapabilityWorld(base as unknown as WorldPack);
  const activity = world.character!.activities.find(a => a.id === "cap-work-a1")!;
  activity.usesYearlyActivity = false;
  assert.throws(() => validateWorld(world), /annual|capability/i);
  const other = buildCapabilityWorld(base as unknown as WorldPack);
  other.events.find(event => event.choices.length > 0)!.choices[0].outcomes[0].effects.push({ type: "capability", node: "A1" });
  assert.throws(() => validateWorld(other), /annual|capability/i);
});
