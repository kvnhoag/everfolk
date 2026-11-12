import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { buildFigurePathWorld } from "../src/figures/world.ts";
import { getFigurePathProgress } from "../src/figures/progress.ts";
import type { WorldPack } from "../src/types.ts";
import base from "../worlds/demo/alexandria-lives-5.json" with { type: "json" };

test("a current-world early cohort reaches Aristotle using actual numeric P1/P2 work at moderate proficiency", () => {
  const world = buildFigurePathWorld(base as unknown as WorldPack);
  world.birthYears = { from: -350, to: -350 };
  delete world.knowledge; delete world.demo!.startingResources; delete world.health!.mortalityCalibration;
  for (const event of world.events) { event.when = { type: "age", op: "gte", value: 1000 }; event.maxOccurrences = 1; }
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  world.yearlyRules = []; world.yearlyEffects = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = 35;
  for (const origin of world.origins) { origin.effects = []; origin.statRanges = {}; origin.assetRanges = {}; }
  world.stats.health.initial = 100; world.stats.knowledge.initial = 100;
  world.stats.wealth.initial = 100; world.economy!.unitsPerPoint = 1000;
  world.demo!.household.startingGrain = 1000000; world.demo!.household.storeCapacity = 1000000; world.demo!.household.spoilageBps = 0;
  const engine = createEngine(world);
  let life = engine.start("numeric-aristotle-entry");
  const ready = () => { while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id); assert.notEqual(life.phase, "ended"); };
  const next = () => { life = engine.advance(life); ready(); };
  while (life.age < 12) next();
  for (const node of ["P1", "P2"]) {
    for (let attempt = 0; attempt < 5 && !life.capabilities!.learned[node]; attempt++) {
      if (life.character!.lastActivityAge === life.age) next();
      const activity = engine.getActivities(life).find(activity => activity.id === "cap-work-" + node.toLowerCase())!;
      assert.ok(activity.available, activity.reason);
      life = engine.act(life, activity.id);
    }
    assert.ok(life.capabilities!.learned[node]);
  }
  while (life.age < 18) next();
  const path = world.figurePaths!.find(path => path.id === "aristotle")!;
  assert.equal(life.year, -332);
  assert.equal(life.capabilities!.learned.PS10, undefined);
  life = engine.act(life, path.encounter.activityId);
  const progress = getFigurePathProgress(world, path, life);
  assert.equal(progress.encounterMode, "direct");
  assert.equal(progress.associationRank, null);
  assert.equal(progress.specialTitle, null);
  assert.equal(life.deepCapabilities, undefined);
  assert.ok(life.capabilities!.evidence.some(record => record.nodeId === "P1"));
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});
