import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import { calibratedEpisodeProbability, developHealthIncident, initialHealth, progressHealth, provideHealthCare, severeEpisodeFatalityProbability } from "../src/health.ts";
import type { HealthHooks } from "../src/health.ts";
import { nextRandom, seedToUint32 } from "../src/random.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

const adultRisk = 1 - (1 - .75601) ** .2;
function fixture(probability = adultRisk): WorldPack {
  return {
    schemaVersion: 1, id: "adult-mortality", version: "1", title: "Adult mortality", description: "Synthetic reference calibration fixture.", startYear: -66, maxAge: 100,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 50 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [],
    events: [{ id: "care", title: "Care is needed", text: "A severe illness needs care.", trigger: { type: "random", weight: 1 }, when: { type: "has-condition" }, maxOccurrences: 100,
      choices: [{ id: "rest", text: "Arrange care", outcomes: [{ id: "cared", text: "Care is arranged.", weight: 1, effects: [{ type: "care", amount: .55 }] }] }] }],
    endings: [{ id: "death", title: "Life ended", text: "Life ended.", kind: "death" }, { id: "record", title: "Record complete", text: "The record stops.", kind: "chapter" }], defaultEnding: "record",
    mortality: { description: "Reference probabilities.", sourceIds: [], bands: [{ minAge: 0, maxAge: 17, annualProbability: .001, ending: "death" }, { minAge: 18, maxAge: 99, annualProbability: probability, ending: "death" }] },
    health: { stat: "health", criticalHealth: 20, declineCondition: "decline", careDecision: "care", description: "Authored episode decomposition.", sourceIds: [], supportRecoveryBonus: .15,
      incidenceBands: [{ minAge: 0, maxAge: 99, annualProbability: 0 }], declineBands: [{ minAge: 0, maxAge: 99, healthLoss: 0 }],
      mortalityCalibration: { minAge: 18, referenceHealth: 50, referenceCare: .55, caseFatality: .8, onsetHealth: 20, convalescenceLoss: 4, healthInfluence: .5, careInfluence: .5 },
      conditions: [
        { id: "pneumonia", title: "Pneumonia", deathCause: "pneumonia-death", kind: "illness", weight: 1, healthLoss: 8, recoveryChance: .35, careRecoveryBonus: .4, fatalHealthThreshold: 5 },
        { id: "decline", title: "Physical decline", deathCause: "decline-death", kind: "frailty", weight: 0, healthLoss: 5, recoveryChance: 0, careRecoveryBonus: 0, fatalHealthThreshold: 0 },
      ] },
    character: { skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [], childNames: ["Child"],
      activities: [{ id: "walk", text: "Walk", category: "family", outcomes: [{ id: "walked", text: "You walk.", weight: 1, effects: [] }] }], deathCauseDescription: "Fictional named causes.",
      deathCauses: [{ id: "pneumonia-death", title: "Pneumonia", text: "Pneumonia becomes fatal.", weight: 1 }, { id: "decline-death", title: "Physical decline", text: "Health declines.", weight: 1 }] },
  };
}
function state(world: WorldPack, age = 80, health = 50): LifeState {
  const life = structuredClone(createEngine(world).start("fixture"));
  life.age = age; life.year = world.startYear + age; life.stats.health = health;
  life.health = initialHealth(world);
  return life;
}
function hooks(draw = 0, support = 0) {
  const entries: { id: string; text: string }[] = [];
  let draws = 0;
  const hooks: HealthHooks = { random: () => { draws++; return draw; }, matches: condition => condition === undefined, support, journal: (id, text) => entries.push({ id, text }) };
  return { hooks, entries, draws: () => draws };
}

test("calibrated adult episodes preserve the reference annual probability at reference Health and care", () => {
  const world = fixture(), life = state(world), log = hooks();
  developHealthIncident(world, life, log.hooks);
  const active = life.health!.conditions[0];
  assert.equal(active.severe!.healthBefore, 50);
  provideHealthCare(world, life, .55);
  assert.ok(Math.abs(calibratedEpisodeProbability(world, life) * severeEpisodeFatalityProbability(world, life, active) - adultRisk) < 1e-12);
  assert.equal(life.stats.health, 20);
  assert.equal(life.phase, "ready", "Onset cannot end life.");
  assert.equal(life.health!.needsCareDecision, true);
  assert.match(log.entries.at(-1)!.text, /severe.*care before/i);
});

test("an age-80 reference cohort reproduces the historical comparison's annual risk", () => {
  const world = fixture(), template = state(world);
  const count = 12_000;
  let deaths = 0;
  for (let index = 0; index < count; index++) {
    const life = structuredClone(template);
    let rng = seedToUint32(`adult-reference-${index}`);
    const hooks: HealthHooks = { random: () => { const draw = nextRandom(rng); rng = draw.state; return draw.value; }, matches: condition => condition === undefined, support: 0, journal: () => {} };
    developHealthIncident(world, life, hooks);
    provideHealthCare(world, life, .55);
    deaths += Number(Boolean(progressHealth(world, life, hooks).deathCause));
  }
  const tolerance = 5 * Math.sqrt(adultRisk * (1 - adultRisk) / count);
  assert.ok(Math.abs(deaths / count - adultRisk) < tolerance, `${deaths}/${count} should match ${adultRisk}`);
});

test("Health, care and household support change severe-episode outcomes in the expected direction", () => {
  const world = fixture(), life = state(world), log = hooks();
  developHealthIncident(world, life, log.hooks);
  const active = life.health!.conditions[0];
  const baseline = severeEpisodeFatalityProbability(world, life, active, .55);
  assert.ok(severeEpisodeFatalityProbability(world, life, active, .9) < baseline);
  assert.ok(severeEpisodeFatalityProbability(world, life, active, 0) > baseline);
  assert.ok(severeEpisodeFatalityProbability(world, life, active, .55, 1) < baseline);
  active.severe!.healthBefore = 80;
  assert.ok(severeEpisodeFatalityProbability(world, life, active, .55) < baseline);
  active.severe!.healthBefore = 20;
  assert.ok(severeEpisodeFatalityProbability(world, life, active, .55) > baseline);
});

test("severe survival restores bounded convalescent Health and fatal deterioration records its actual cause", () => {
  const world = fixture(), recovered = state(world), died = state(world);
  developHealthIncident(world, recovered, hooks().hooks);
  developHealthIncident(world, died, hooks().hooks);
  provideHealthCare(world, recovered, .55);
  provideHealthCare(world, died, .55);
  assert.deepEqual(progressHealth(world, recovered, hooks(.99).hooks), {});
  assert.equal(recovered.stats.health, 46);
  assert.deepEqual(recovered.health!.conditions, []);
  const result = progressHealth(world, died, hooks(0).hooks);
  assert.equal(result.deathCause, "pneumonia-death");
  assert.equal(died.stats.health, 5);
  assert.match(result.context!, /illness.*pneumonia.*severe.*warned.*Care was provided/i);
});

test("a minor illness can become severe without erasing existing care or duplicating the condition", () => {
  const world = fixture(), life = state(world);
  life.health!.conditions.push({ id: "pneumonia", sinceAge: 79, lastProgressAge: 79, care: .4, source: "An earlier episode." });
  developHealthIncident(world, life, hooks().hooks);
  assert.equal(life.health!.conditions.length, 1);
  assert.equal(life.health!.conditions[0].care, .4);
  assert.equal(life.health!.conditions[0].sinceAge, 79);
  assert.equal(life.health!.conditions[0].source, "An earlier episode.");
  assert.deepEqual(life.health!.conditions[0].severe, { healthBefore: 50 });
});

test("fatal severe progression does not retain conditions that recovered earlier in the same interval", () => {
  const world = fixture(), life = state(world);
  world.health!.conditions.push({ ...world.health!.conditions[0], id: "malaria", title: "Malaria", recoveryChance: 1 });
  life.health!.conditions = [
    { id: "malaria", sinceAge: 79, lastProgressAge: 79, care: 0 },
    { id: "pneumonia", sinceAge: 79, lastProgressAge: 79, care: .55, severe: { healthBefore: 50 } },
    { id: "decline", sinceAge: 79, lastProgressAge: 79, care: 0 },
  ];
  const result = progressHealth(world, life, hooks().hooks);
  assert.equal(result.deathCause, "pneumonia-death");
  assert.deepEqual(life.health!.conditions.map(condition => condition.id), ["pneumonia", "decline"]);
  assert.equal(life.health!.conditions[0].lastProgressAge, 80);
  assert.equal(life.health!.conditions[0].care, 0);
  assert.match(result.context!, /illness began at age 79/);
  assert.doesNotMatch(result.context!, /severe.*recorded at age 79/);
});

test("the adult calibration neither adds childhood draws nor changes an older world's health rules", () => {
  const world = fixture(), child = state(world, 17), log = hooks();
  developHealthIncident(world, child, log.hooks);
  assert.equal(log.draws(), 0);
  assert.deepEqual(child.health!.conditions, []);
  delete world.health!.mortalityCalibration;
  const adult = state(world), oldLog = hooks();
  developHealthIncident(world, adult, oldLog.hooks);
  assert.equal(oldLog.draws(), 0);
  assert.deepEqual(adult.health!.conditions, []);
});

test("the engine stops for care before a severe illness can kill and preserves exact save replay", () => {
  const engine = createEngine(fixture(.8));
  let deaths = 0, recoveries = 0;
  for (let index = 0; index < 32; index++) {
    let life = engine.start(`warned-severe-${index}`);
    while (life.age < 18) life = engine.advance(life);
    assert.equal(life.age, 18);
    assert.equal(life.phase, "choice");
    assert.equal(life.pendingEventId, "care");
    assert.equal(life.stats.health, 20);
    assert.equal(life.endingId, null);
    assert.ok(life.health!.conditions[0].severe);
    assert.throws(() => engine.advance(life), /pending choice/);
    life = engine.choose(life, "rest");
    const before = life;
    life = engine.advance(life);
    if (life.phase === "ended") {
      deaths++;
      assert.equal(life.age, 18);
      assert.equal(life.deathCauseId, "pneumonia-death");
      assert.equal(life.deathCauseKind, "condition");
      assert.ok(before.journal.some(entry => entry.id === "health-severe-onset-pneumonia"));
      assert.equal(life.stats.health, 5);
    } else recoveries++;
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.ok(deaths > 0 && recoveries > 0);
});

test("calibration validation rejects impossible decomposition and unsafe health or care fields", () => {
  const changed = (mutate: (world: WorldPack) => void) => { const world = fixture(); mutate(world); assert.throws(() => validateWorld(world), /mortalityCalibration/); };
  changed(world => { delete world.mortality; });
  changed(world => { world.health!.mortalityCalibration!.caseFatality = .1; });
  changed(world => { world.health!.mortalityCalibration!.caseFatality = 0; });
  changed(world => { world.health!.mortalityCalibration!.onsetHealth = 21; });
  changed(world => { world.health!.mortalityCalibration!.onsetHealth = 4; });
  changed(world => { world.health!.mortalityCalibration!.referenceCare = 1; world.health!.mortalityCalibration!.careInfluence = 1; });
  changed(world => { world.health!.mortalityCalibration!.referenceHealth = Infinity; });
  changed(world => { world.health!.mortalityCalibration!.convalescenceLoss = -1; });
  changed(world => { world.health!.conditions[0].when = { type: "age", op: "gte", value: 20 }; });
  changed(world => { (world.health!.mortalityCalibration as unknown as Record<string, unknown>).unknown = 1; });
  assert.doesNotThrow(() => validateWorld(fixture()));
});
