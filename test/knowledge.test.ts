import assert from "node:assert/strict";
import test from "node:test";
import { initialKnowledge, progressKnowledge, recordKnowledgePractice } from "../src/knowledge.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

function world(): WorldPack {
  return {
    schemaVersion: 1, id: "retention", version: "1", title: "Retention", description: "Authored retention fixture.", startYear: -66, maxAge: 100,
    stats: { knowledge: { label: "Knowledge", min: 0, max: 100, initial: 40 }, health: { label: "Health", min: 0, max: 100, initial: 80 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "record", title: "Record", text: "Record complete." }], defaultEnding: "record",
    knowledge: { stat: "knowledge", description: "Authored gameplay.", minAge: 12, idleGraceYears: 2, idleLoss: 1,
      ageBands: [{ minAge: 0, maxAge: 49, loss: 0 }, { minAge: 50, maxAge: 64, loss: 0.5 }, { minAge: 65, maxAge: 79, loss: 1 }, { minAge: 80, maxAge: 99, loss: 1.5 }] },
  };
}
function life(world: WorldPack, age = 20, knowledge = 40): LifeState {
  return { schemaVersion: 1, worldId: world.id, worldVersion: world.version, worldFingerprint: "fixture", seed: "fixture", rngState: 99,
    age, year: world.startYear + age, originId: "home", stats: { knowledge, health: 80 }, flags: {}, phase: "ready", pendingEventId: null, endingId: null,
    eventCounts: {}, lastEventAge: {}, journal: [], commands: [], ...(world.knowledge ? { knowledge: initialKnowledge(world) } : {}),
  };
}
function log() {
  const entries: { id: string; text: string }[] = [];
  return { entries, journal: (id: string, text: string) => { entries.push({ id, text }); } };
}

test("legacy worlds keep their exact state shape and random state", () => {
  const pack = world(); delete pack.knowledge;
  const state = life(pack), before = structuredClone(state), logs = log();
  assert.equal(initialKnowledge(pack), undefined);
  recordKnowledgePractice(pack, state, { type: "stat", stat: "knowledge", delta: 1 });
  progressKnowledge(pack, state, logs.journal);
  assert.deepEqual(state, before);
  assert.deepEqual(logs.entries, []);
});

test("inactivity starts only after the minimum age and the complete grace interval", () => {
  const pack = world();
  for (const age of [0, 11, 12, 13]) {
    const state = life(pack, age), logs = log();
    progressKnowledge(pack, state, logs.journal);
    assert.equal(state.stats.knowledge, 40);
    assert.deepEqual(logs.entries, []);
  }
  const firstLoss = life(pack, 14), logs = log();
  progressKnowledge(pack, firstLoss, logs.journal);
  assert.equal(firstLoss.stats.knowledge, 39);
  assert.match(logs.entries[0].text, /Knowledge falls by 1\./);
});

test("early childhood learning does not make neglect begin before the protected baseline", () => {
  const pack = world(), state = life(pack, 6), logs = log();
  recordKnowledgePractice(pack, state, { type: "stat", stat: "knowledge", delta: 1 });
  assert.equal(state.knowledge!.lastPracticeAge, 6);
  state.age = 13;
  progressKnowledge(pack, state, logs.journal);
  assert.equal(state.stats.knowledge, 40);
  state.age = 14;
  progressKnowledge(pack, state, logs.journal);
  assert.equal(state.stats.knowledge, 39);
});

test("accepted positive Knowledge effects refresh practice even at the stat cap", () => {
  const pack = world(), state = life(pack, 22, 100), logs = log();
  recordKnowledgePractice(pack, state, { type: "stat", stat: "knowledge", delta: 1 });
  assert.equal(state.knowledge!.lastPracticeAge, 22);
  assert.equal(state.stats.knowledge, 100);
  progressKnowledge(pack, state, logs.journal);
  assert.equal(state.stats.knowledge, 100);
  state.age = 23;
  progressKnowledge(pack, state, logs.journal);
  assert.equal(state.stats.knowledge, 100);
  state.age = 24;
  progressKnowledge(pack, state, logs.journal);
  assert.equal(state.stats.knowledge, 99);
});

test("zero grace still respects learning completed in the current year", () => {
  const pack = world(); pack.knowledge!.idleGraceYears = 0;
  const idle = life(pack, 12), studied = life(pack, 12), logs = log();
  recordKnowledgePractice(pack, studied, { type: "stat", stat: "knowledge", delta: 1 });
  progressKnowledge(pack, idle, logs.journal);
  progressKnowledge(pack, studied, logs.journal);
  assert.equal(idle.stats.knowledge, 39);
  assert.equal(studied.stats.knowledge, 40);
  studied.age++;
  progressKnowledge(pack, studied, logs.journal);
  assert.equal(studied.stats.knowledge, 39);
});

test("other stats, skill gains and nonpositive effects cannot pretend to be Knowledge practice", () => {
  const pack = world(), state = life(pack), before = structuredClone(state);
  for (const effect of [
    { type: "stat", stat: "health", delta: 5 }, { type: "stat", stat: "knowledge", delta: 0 },
    { type: "stat", stat: "knowledge", delta: -1 }, { type: "stat", stat: "knowledge", delta: NaN },
    { type: "skill", skill: "literacy", delta: 5 }, { type: "cash", delta: 10 },
  ] as const) recordKnowledgePractice(pack, state, effect);
  assert.deepEqual(state, before);
});

test("age-related loss applies to active learners while inactivity adds its own loss", () => {
  const pack = world();
  for (const [age, ageLoss] of [[49, 0], [50, 0.5], [64, 0.5], [65, 1], [79, 1], [80, 1.5], [99, 1.5]]) {
    const studying = life(pack, age), idle = life(pack, age), activeLog = log(), idleLog = log();
    recordKnowledgePractice(pack, studying, { type: "stat", stat: "knowledge", delta: 1 });
    progressKnowledge(pack, studying, activeLog.journal);
    progressKnowledge(pack, idle, idleLog.journal);
    assert.equal(studying.stats.knowledge, 40 - ageLoss, `active age ${age}`);
    assert.equal(idle.stats.knowledge, 39 - ageLoss, `idle age ${age}`);
    assert.equal(activeLog.entries.length, ageLoss > 0 ? 1 : 0);
    assert.equal(idleLog.entries[0].id, ageLoss > 0 ? "knowledge-combined-decline" : "knowledge-idle-decline");
  }
});

test("loss is bounded and logged once using only the actual decrease", () => {
  const pack = world(), state = life(pack, 80, 0.5), logs = log();
  progressKnowledge(pack, state, logs.journal);
  assert.equal(state.stats.knowledge, 0);
  assert.deepEqual(logs.entries, [{ id: "knowledge-combined-decline", text: "You have not kept up with learning, and age is affecting your recall. Knowledge falls by 0.5." }]);
  state.age++;
  progressKnowledge(pack, state, logs.journal);
  assert.equal(state.stats.knowledge, 0);
  assert.equal(logs.entries.length, 1);
});

test("retention never changes another stat, accepted commands, practice age or RNG", () => {
  const pack = world(), state = life(pack, 70), before = structuredClone(state), logs = log();
  progressKnowledge(pack, state, logs.journal);
  assert.equal(state.stats.knowledge, 38);
  assert.equal(state.stats.health, before.stats.health);
  assert.equal(state.rngState, before.rngState);
  assert.deepEqual(state.commands, before.commands);
  assert.deepEqual(state.knowledge, before.knowledge);
  assert.equal(state.age, before.age);
});

test("ended lives cannot learn or lose Knowledge", () => {
  const pack = world(), state = life(pack, 70), logs = log(); state.phase = "ended";
  const before = structuredClone(state);
  recordKnowledgePractice(pack, state, { type: "stat", stat: "knowledge", delta: 1 });
  progressKnowledge(pack, state, logs.journal);
  assert.deepEqual(state, before);
  assert.deepEqual(logs.entries, []);
});
