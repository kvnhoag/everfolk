import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityAvailability, Choice, LifeState, StatDefinition, WorldPack } from "../src/types.ts";
import { applyStatDelta } from "../src/progression.ts";
import { getChoiceImpact } from "../client/models/choice-impact.ts";
import { trainingSkillChanges } from "../client/models/skill-tree.ts";
import { createEngine } from "../src/index.ts";

const definition = (): StatDefinition => ({
  label: "Health", min: 0, max: 100, initial: 39,
  gainCurve: [{ from: 0, multiplier: 1 }, { from: 40, multiplier: 0.5 }, { from: 70, multiplier: 0.2 }, { from: 90, multiplier: 0.05 }],
});

test("definitions without a curve preserve exact legacy bounds and arithmetic", () => {
  const stat = definition();
  delete stat.gainCurve;
  for (const current of [-200, 0, 39, 98, 100, 200]) for (const delta of [-200, -4, -0, 0, 1, 6, 200]) {
    assert.equal(applyStatDelta(stat, current, delta), Math.max(stat.min, Math.min(stat.max, current + delta)));
  }
});

test("crossing a growth threshold spends only the remaining authored reward at the next rate", () => {
  const stat = definition();
  assert.equal(applyStatDelta(stat, 39, 4), 41.5);
  assert.equal(applyStatDelta(stat, 38, 4), 41);
  assert.equal(applyStatDelta(stat, 69, 10), 71.6);
  assert.equal(applyStatDelta(stat, 89, 10), 90.25);
  assert.equal(applyStatDelta(stat, 90, 10), 90.5);
});

test("large rewards traverse all bands without bypassing the cost of mastery", () => {
  const stat = definition();
  // 40 / 1 + 30 / .5 + 20 / .2 + 10 / .05 = 400 reward points.
  assert.equal(applyStatDelta(stat, 0, 399), 99.95);
  assert.equal(applyStatDelta(stat, 0, 400), 100);
  assert.equal(applyStatDelta(stat, 0, 1_000), 100);
  assert.equal(applyStatDelta(stat, 100, 20), 100);
});

test("penalties remain full strength and ordered recovery does not erase a previous penalty", () => {
  const stat = definition();
  assert.equal(applyStatDelta(stat, 91, -8), 83);
  assert.equal(applyStatDelta(stat, 1, -8), 0);
  let value = 98;
  for (const delta of [10, -10, 5]) value = applyStatDelta(stat, value, delta);
  assert.equal(value, 89.5);
});

test("tiny gains and very wide valid ranges terminate without mutating their definition", () => {
  const stat = definition(), before = structuredClone(stat);
  assert.equal(applyStatDelta(stat, 90, Number.MIN_VALUE), 90);
  assert.equal(applyStatDelta(stat, 99, Number.EPSILON), 99);
  assert.deepEqual(stat, before);
  const wide = { label: "Wide", min: -1e300, max: 1e300, initial: 0, gainCurve: [{ from: -1e300, multiplier: Number.MIN_VALUE }] };
  assert.equal(applyStatDelta(wide, 0, 1), Number.MIN_VALUE);
});

function previewFixture(): { world: WorldPack; life: LifeState } {
  const world: WorldPack = {
    schemaVersion: 1, id: "growth-preview", version: "1", title: "Growth", description: "Authored test fixture.", startYear: -20, maxAge: 100,
    stats: { health: definition() }, flags: {}, origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
    character: { skills: { carving: { ...definition(), label: "Wood carving" } }, jobs: [], partners: [], childNames: ["Child"], activities: [],
      deathCauseDescription: "Authored causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }] },
  };
  const life: LifeState = { schemaVersion: 1, worldId: world.id, worldVersion: world.version, worldFingerprint: "fixture", seed: "fixture", rngState: 42,
    age: 20, year: 1, originId: "home", stats: { health: 39 }, flags: {}, phase: "ready", pendingEventId: null, endingId: null, eventCounts: {}, lastEventAge: {}, journal: [], commands: [],
    character: { skills: { carving: 69 }, jobId: null, partnerId: null, relationshipStatus: "single", children: [], lastActivityAge: null, lastActivityAges: {} } };
  return { world, life };
}

test("choice and skill previews apply ordered growth, penalties and terminal stops without changing the life", () => {
  const { world, life } = previewFixture(), before = structuredClone(life);
  const choice: Choice = { id: "practice", text: "Practice", outcomes: [
    { id: "successful", text: "Completed.", weight: 1, effects: [
      { type: "stat", stat: "health", delta: 4 }, { type: "stat", stat: "health", delta: -1 },
      { type: "skill", skill: "carving", delta: 10 }, { type: "skill", skill: "carving", delta: -1 },
      { type: "end", ending: "complete" }, { type: "stat", stat: "health", delta: 100 }, { type: "skill", skill: "carving", delta: 100 },
    ] },
    { id: "unfinished", text: "Stopped early.", weight: 1, effects: [{ type: "stat", stat: "health", delta: -2 }, { type: "skill", skill: "carving", delta: -2 }] },
  ] };
  const impact = getChoiceImpact(choice, life, world);
  assert.deepEqual(impact.stats, [{ id: "health", label: "Health", min: -2, max: 1.5, variable: true }]);
  const skillChanges = trainingSkillChanges({ ...choice, category: "training", available: true } as ActivityAvailability, world, life);
  assert.equal(skillChanges[0].min, -2);
  assert.ok(Math.abs(skillChanges[0].max - 1.6) < 1e-12);
  assert.equal(impact.canEndLife, true);
  assert.deepEqual(life, before);
});

test("curved previews match accepted engine effects and exact command replay", () => {
  const { world } = previewFixture();
  world.character!.skills.carving.initial = 69;
  world.character!.activities = [{ id: "rest", text: "Rest", category: "family", outcomes: [{ id: "rested", text: "You rest.", weight: 1, effects: [] }] }];
  const choice: Choice = { id: "practice", text: "Practise carving", outcomes: [{ id: "practised", text: "The work is complete.", weight: 1, effects: [
    { type: "stat", stat: "health", delta: 4 }, { type: "stat", stat: "health", delta: -1 },
    { type: "skill", skill: "carving", delta: 10 }, { type: "skill", skill: "carving", delta: -1 },
    { type: "end", ending: "complete" }, { type: "stat", stat: "health", delta: 100 }, { type: "skill", skill: "carving", delta: 100 },
  ] }] };
  world.events = [{ id: "opening", title: "A task", text: "Practise a task.", trigger: { type: "age", at: 0 }, choices: [choice] }];
  const engine = createEngine(world), life = engine.start("growth-engine-parity"), original = structuredClone(life);
  const impact = getChoiceImpact(choice, life, engine.world);
  const skills = trainingSkillChanges({ ...choice, category: "training", available: true }, engine.world, life);
  const next = engine.choose(life, choice.id);
  assert.equal(impact.stats[0].min, next.stats.health - life.stats.health);
  assert.equal(impact.stats[0].max, next.stats.health - life.stats.health);
  assert.equal(skills[0].min, next.character!.skills.carving - life.character!.skills.carving);
  assert.equal(skills[0].max, next.character!.skills.carving - life.character!.skills.carving);
  assert.deepEqual(life, original);
  assert.deepEqual(engine.load(engine.save(next)), next);
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
});
