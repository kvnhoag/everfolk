import { withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with {type:"json"};
import legacy from "../worlds/alexandria-0.4.0.json" with {type:"json"};
import { advanceYearWithFocus, focusActivity, focusStatus, normalizeYearlyFocus, persistYearlyFocus, readYearlyFocus, YEARLY_FOCUSES } from "../client/yearly-focus.ts";
import { trainingSkillChanges } from "../client/skill-tree.ts";

function controlledWorld(qualified = true): WorldPack {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  // Focus tests isolate accepted craft actions from all illness onset paths.
  delete world.health!.mortalityCalibration;
  world.events = world.events.filter(event => event.id === world.health!.careDecision);
  delete world.eventPacing;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = [];
  world.yearlyRules = [];
  world.stats.wealth.initialRange = { min: 50, max: 50 };
  world.origins.forEach(origin => { origin.effects = []; origin.statRanges = { ...origin.statRanges, wealth: { min: 50, max: 50 } }; });
  if (qualified) for (const skill of ["craft", "pottery", "carving"]) world.character!.skills[skill].initial = 20;
  return world;
}
function ageTo(engine: LifeEngine, target: number): LifeState {
  let life = engine.start("specific-craft-focus");
  while (life.age < target) life = engine.advance(life);
  return life;
}

test("each named craft focus accepts its own existing activity and replays its real effects", () => {
  const engine = createEngine(controlledWorld()), life = ageTo(engine, 14);
  const pairs = [["craft", "train-craft"], ["pottery", "train-pottery"], ["carving", "train-carving"], ["sculpture", "train-sculpture"]] as const;
  assert.deepEqual(YEARLY_FOCUSES.filter(focus => pairs.some(([id]) => focus.id === id)).map(focus => focus.label), ["Woodwork", "Pottery", "Wood carving", "Stone sculpture"]);
  for (const [id, activity] of pairs) {
    assert.equal(focusActivity(engine.world, id)?.id, activity);
    const actual = advanceYearWithFocus(engine, life, id);
    assert.deepEqual(actual, engine.advance(engine.act(life, activity)));
    assert.deepEqual(actual.commands.slice(life.commands.length), [{ type: "act", activity }, { type: "advance" }]);
    assert.deepEqual(engine.load(engine.save(actual)), actual);
  }
});

test("a locked specialism reports its engine requirements and never substitutes another craft", () => {
  const engine = createEngine(controlledWorld(false)), life = ageTo(engine, 14);
  for (const id of ["pottery", "carving", "sculpture"] as const) {
    const action = engine.getActivities(life).find(action => action.id === focusActivity(engine.world, id)!.id)!;
    assert.equal(action.available, false);
    assert.equal(focusStatus(life, engine.world, id, engine.getActivities(life)), `Skipped this year: ${action.reason}`);
    const actual = advanceYearWithFocus(engine, life, id);
    assert.deepEqual(actual, engine.advance(life));
    assert.equal(actual.character!.lastActivityAge, null);
  }
  const child = ageTo(engine, 10);
  assert.match(focusStatus(child, engine.world, "sculpture", engine.getActivities(child)), /age 14/);
});

test("the saved craft preference survives and older worlds omit unavailable specialisms", () => {
  const engine = createEngine(controlledWorld()), life = ageTo(engine, 14), rows = new Map<string,string>();
  const storage = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
  persistYearlyFocus(storage, life, "craft");
  assert.equal(readYearlyFocus(storage, life, engine.world), "craft");
  assert.equal(normalizeYearlyFocus("craft", legacy as WorldPack), "craft");
  assert.equal(focusActivity(legacy as WorldPack, "craft")?.id, "train-craft");
  for (const id of ["pottery", "carving", "sculpture"] as const) {
    assert.equal(normalizeYearlyFocus(id, legacy as WorldPack), "everyday");
    assert.equal(focusActivity(legacy as WorldPack, id), undefined);
  }
});

test("choosing and previewing specific crafts cannot spend money, advance time or practise", () => {
  const world = controlledWorld();
  world.character!.skills.craft.initial = 100;
  world.character!.skills.pottery.initial = 98;
  const engine = createEngine(world), life = ageTo(engine, 14), before = structuredClone(life), saved = engine.save(life);
  const rows = new Map<string,string>();
  const storage = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
  for (const id of ["craft", "pottery", "carving", "sculpture"] as const) persistYearlyFocus(storage, life, id);
  const pottery = engine.getActivities(life).find(action => action.id === "train-pottery")!;
  assert.deepEqual(trainingSkillChanges(pottery, engine.world, life), [{ id: "pottery", label: engine.world.character!.skills.pottery.label, min: 0.25, max: 0.25 }]);
  assert.deepEqual(life, before);
  assert.equal(engine.save(life), saved);
});
