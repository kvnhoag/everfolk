import assert from "node:assert/strict";
import test from "node:test";
import type { HealthConditionDefinition, LifeState, WorldPack } from "../src/types.ts";
import { initialHealth, addHealthCondition, provideHealthCare, progressHealth, developHealthIncident } from "../src/health.ts";
import type { HealthHooks } from "../src/health.ts";

function world(): WorldPack {
  const condition = (id: string, kind: HealthConditionDefinition["kind"], weight: number, healthLoss: number): HealthConditionDefinition => ({
    id, title: id === "pneumonia" ? "Pneumonia" : id === "fracture" ? "Fractured leg" : "Physical decline",
    kind, weight, healthLoss, deathCause: `${id}-death`, recoveryChance: 0, careRecoveryBonus: 0, fatalHealthThreshold: 10,
  });
  return {
    schemaVersion: 1, id: "health-test", version: "1", title: "Health fixture", description: "Authored test model.", startYear: -66, maxAge: 100,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 80 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "End", text: "End." }], defaultEnding: "end",
    health: { stat: "health", criticalHealth: 25, declineCondition: "decline", careDecision: "medical-care", description: "Authored health fixture.", sourceIds: [],
      supportRecoveryBonus: 0.2, incidenceBands: [{ minAge: 0, maxAge: 99, annualProbability: 0.2 }], declineBands: [{ minAge: 60, maxAge: 99, healthLoss: 4 }],
      conditions: [condition("pneumonia", "illness", 1, 12), condition("fracture", "injury", 0, 20), condition("decline", "frailty", 0, 8)],
    },
  };
}
function life(world: WorldPack, health = 80, age = 20): LifeState {
  return { schemaVersion: 1, worldId: world.id, worldVersion: world.version, worldFingerprint: "fixture", seed: "fixture", rngState: 42,
    age, year: world.startYear + age, originId: "home", stats: { health }, flags: {}, phase: "ready", pendingEventId: null, endingId: null,
    eventCounts: {}, lastEventAge: {}, journal: [], commands: [], ...(world.health ? { health: initialHealth(world) } : {}),
  };
}
function hooks(draw = 0.99, support = 0) {
  const entries: { id: string; text: string }[] = [];
  let draws = 0;
  const result: HealthHooks = { random: () => { draws++; return draw; }, matches: condition => condition === undefined,
    journal: (id, text) => { entries.push({ id, text }); }, support };
  return { hooks: result, entries, draws: () => draws };
}

test("legacy worlds acquire neither health state nor random draws", () => {
  const pack = world();
  delete pack.health;
  const state = life(pack);
  const before = structuredClone(state);
  const log = hooks();
  assert.equal(initialHealth(pack), undefined);
  addHealthCondition(pack, state, "pneumonia", "A hazard.", log.hooks);
  provideHealthCare(pack, state, 1);
  assert.deepEqual(progressHealth(pack, state, log.hooks), {});
  developHealthIncident(pack, state, log.hooks);
  assert.deepEqual(state, before);
  assert.equal(log.draws(), 0);
  assert.deepEqual(log.entries, []);
});

test("condition onset warns without damage or death and duplicate exposure preserves the episode", () => {
  const pack = world(), state = life(pack, 8), log = hooks();
  addHealthCondition(pack, state, "fracture", "A load struck your leg.", log.hooks);
  assert.equal(state.stats.health, 8);
  assert.equal(state.phase, "ready");
  assert.equal(state.health!.needsCareDecision, true);
  assert.match(log.entries[0].text, /fractured leg.*need care/i);
  assert.equal(state.health!.conditions[0].lastProgressAge, state.age - 1);
  provideHealthCare(pack, state, 0.5);
  const episode = structuredClone(state.health!.conditions[0]);
  state.health!.needsCareDecision = false;
  addHealthCondition(pack, state, "fracture", "Another load.", log.hooks);
  assert.deepEqual(state.health!.conditions, [episode]);
  assert.equal(state.health!.needsCareDecision, false);
  assert.equal(log.entries.length, 1);
});

test("lower Health raises named illness incidence while zero-weight injuries are never sampled", () => {
  const pack = world();
  const healthy = life(pack, 100), vulnerable = life(pack, 30);
  developHealthIncident(pack, healthy, hooks(0.2).hooks);
  developHealthIncident(pack, vulnerable, hooks(0.2).hooks);
  assert.deepEqual(healthy.health!.conditions, []);
  assert.deepEqual(vulnerable.health!.conditions.map(condition => condition.id), ["pneumonia"]);
  assert.equal(vulnerable.stats.health, 30);
  assert.equal(vulnerable.health!.needsCareDecision, true);
});

test("incidents obey eligibility, avoid duplicate episodes and consume no draws at zero incidence", () => {
  const pack = world(), state = life(pack);
  pack.health!.conditions[0].when = { type: "age", op: "gte", value: 60 };
  const log = hooks(0);
  developHealthIncident(pack, state, log.hooks);
  assert.deepEqual(state.health!.conditions, []);
  assert.equal(log.draws(), 0);
  delete pack.health!.conditions[0].when;
  pack.health!.incidenceBands[0].annualProbability = 0;
  developHealthIncident(pack, state, log.hooks);
  assert.equal(log.draws(), 0);
  pack.health!.incidenceBands[0].annualProbability = 1;
  developHealthIncident(pack, state, log.hooks);
  developHealthIncident(pack, state, log.hooks);
  assert.deepEqual(state.health!.conditions.map(condition => condition.id), ["pneumonia"]);
});

test("care and household support reduce unresolved condition damage and are used for one progression", () => {
  const pack = world(), unsupported = life(pack), supported = life(pack);
  addHealthCondition(pack, unsupported, "pneumonia", undefined, hooks().hooks);
  addHealthCondition(pack, supported, "pneumonia", undefined, hooks().hooks);
  provideHealthCare(pack, supported, 0.9);
  progressHealth(pack, unsupported, hooks().hooks);
  progressHealth(pack, supported, hooks(0.99, 1).hooks);
  assert.equal(unsupported.stats.health, 68);
  assert.ok(supported.stats.health > unsupported.stats.health);
  assert.equal(supported.health!.conditions[0].care, 0);
  assert.equal(supported.health!.needsCareDecision, true);
  const alreadyProgressed = supported.stats.health;
  progressHealth(pack, supported, hooks().hooks);
  assert.equal(supported.stats.health, alreadyProgressed, "The same episode is not damaged twice at one completed age.");
});

test("care and support can permit recovery before otherwise fatal deterioration", () => {
  const pack = world();
  pack.health!.conditions[0].recoveryChance = 0.1;
  pack.health!.conditions[0].careRecoveryBonus = 0.8;
  const untreated = life(pack, 20), cared = life(pack, 20);
  addHealthCondition(pack, untreated, "pneumonia", undefined, hooks().hooks);
  addHealthCondition(pack, cared, "pneumonia", undefined, hooks().hooks);
  provideHealthCare(pack, cared, 0.9);
  assert.equal(progressHealth(pack, untreated, hooks(0.5).hooks).deathCause, "pneumonia-death");
  const log = hooks(0.5, 1);
  assert.deepEqual(progressHealth(pack, cared, log.hooks), {});
  assert.equal(cared.health!.conditions.some(condition => condition.id === "pneumonia"), false);
  assert.ok(log.entries.some(entry => /recover from pneumonia/i.test(entry.text)));
  assert.equal(cared.stats.health, 20, "Recovery does not invent an immediate Health refill.");
});

test("a fatal episode identifies its actual condition and exposure, with no separate death draw", () => {
  const pack = world(), state = life(pack, 20), log = hooks();
  addHealthCondition(pack, state, "pneumonia", "You were already ill after the crossing.", log.hooks);
  const result = progressHealth(pack, state, log.hooks);
  assert.equal(result.deathCause, "pneumonia-death");
  assert.match(result.context!, /Pneumonia began at age 20/);
  assert.match(result.context!, /after the crossing/);
  assert.equal(log.draws(), 0, "A zero-recovery episode does not roll randomly for death.");
  assert.equal(state.stats.health, 8);
  assert.equal(state.health!.needsCareDecision, false);
});

test("recovery clears the care decision when no condition or critical decline remains", () => {
  const pack = world(), state = life(pack, 70), log = hooks();
  pack.health!.conditions[0].recoveryChance = 1;
  addHealthCondition(pack, state, "pneumonia", undefined, log.hooks);
  provideHealthCare(pack, state, 0.5);
  assert.deepEqual(progressHealth(pack, state, log.hooks), {});
  assert.deepEqual(state.health!.conditions, []);
  assert.equal(state.health!.needsCareDecision, false);
  assert.equal(log.draws(), 0);
});

test("critical Health without an active cause produces a warning before any fatal progression", () => {
  const pack = world(), state = life(pack, 5), log = hooks();
  assert.deepEqual(progressHealth(pack, state, log.hooks), {});
  assert.deepEqual(state.health!.conditions.map(condition => condition.id), ["decline"]);
  assert.equal(state.health!.needsCareDecision, true);
  assert.match(log.entries[0].text, /physical decline/i);
  state.age++;
  const next = progressHealth(pack, state, log.hooks);
  assert.equal(next.deathCause, "decline-death");
});

test("age-related decline gives a care opportunity when it first makes Health critical", () => {
  const pack = world(), state = life(pack, 28, 60), log = hooks();
  assert.deepEqual(progressHealth(pack, state, log.hooks), {});
  assert.equal(state.stats.health, 24);
  assert.equal(state.health!.conditions[0].id, "decline");
  assert.equal(state.health!.conditions[0].sinceAge, 60);
  assert.ok(log.entries.some(entry => entry.id === "health-age-decline"));
  assert.equal(state.health!.needsCareDecision, true);
});

test("multiple unresolved conditions accumulate damage and use the strongest contributing cause", () => {
  const pack = world(), state = life(pack, 30), log = hooks();
  addHealthCondition(pack, state, "pneumonia", undefined, log.hooks);
  addHealthCondition(pack, state, "fracture", undefined, log.hooks);
  const result = progressHealth(pack, state, log.hooks);
  assert.equal(state.stats.health, 0);
  assert.equal(result.deathCause, "fracture-death");
});

test("care is bounded, does not carry over to future episodes, and refuses invalid amounts", () => {
  const pack = world(), state = life(pack), log = hooks();
  provideHealthCare(pack, state, 0.9);
  assert.equal(state.health!.lastCareAge, undefined);
  addHealthCondition(pack, state, "pneumonia", undefined, log.hooks);
  assert.equal(state.health!.conditions[0].care, 0);
  provideHealthCare(pack, state, 0.5);
  provideHealthCare(pack, state, 0.9);
  assert.equal(state.health!.conditions[0].care, 1);
  assert.equal(state.health!.lastCareAge, state.age);
  assert.throws(() => provideHealthCare(pack, state, NaN), /finite nonnegative/);
  assert.throws(() => provideHealthCare(pack, state, -1), /finite nonnegative/);
  assert.throws(() => addHealthCondition(pack, state, "missing", undefined, log.hooks), /Unknown health condition/);
});

test("ended lives cannot acquire illness, receive care or progress conditions", () => {
  const pack = world(), state = life(pack), log = hooks(0);
  addHealthCondition(pack, state, "pneumonia", undefined, log.hooks);
  state.phase = "ended";
  const before = structuredClone(state);
  const count = log.entries.length;
  addHealthCondition(pack, state, "fracture", undefined, log.hooks);
  provideHealthCare(pack, state, 1);
  progressHealth(pack, state, log.hooks);
  developHealthIncident(pack, state, log.hooks);
  assert.deepEqual(state, before);
  assert.equal(log.draws(), 0);
  assert.equal(log.entries.length, count);
});
