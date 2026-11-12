import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine, validateWorld } from "../src/index.ts";
import { developHealthIncident, initialHealth, progressHealth, provideHealthCare, severeEpisodeFatalityProbability } from "../src/health.ts";
import type { HealthHooks } from "../src/health.ts";
import { nextRandom, seedToUint32 } from "../src/random.ts";
import type { LifeState, WorldPack } from "../src/types.ts";

const GRADED = { onsetLoss: 25, lingerYears: 2, lingerLoss: 8 };

function fixture(graded: Record<string, number> | null = GRADED): WorldPack {
  return {
    schemaVersion: 1, id: "severe-pacing", version: "1", title: "Severe pacing", description: "Synthetic fixture.", startYear: -66, maxAge: 100,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 80 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [],
    events: [{ id: "care", title: "Care is needed", text: "A severe illness needs care.", trigger: { type: "random", weight: 1 }, when: { type: "has-condition" }, maxOccurrences: 100,
      choices: [{ id: "rest", text: "Arrange care", outcomes: [{ id: "cared", text: "Care is arranged.", weight: 1, effects: [{ type: "care", amount: .55 }] }] }] }],
    endings: [{ id: "death", title: "Life ended", text: "Life ended.", kind: "death" }, { id: "record", title: "Record complete", text: "The record stops.", kind: "chapter" }], defaultEnding: "record",
    mortality: { description: "Reference probabilities.", sourceIds: [], bands: [{ minAge: 0, maxAge: 17, annualProbability: .001, ending: "death" }, { minAge: 18, maxAge: 99, annualProbability: .05, ending: "death" }] },
    health: { stat: "health", criticalHealth: 20, declineCondition: "decline", careDecision: "care", description: "Authored fixture.", sourceIds: [], supportRecoveryBonus: .15,
      incidenceBands: [{ minAge: 0, maxAge: 99, annualProbability: 0 }], declineBands: [{ minAge: 0, maxAge: 99, healthLoss: 0 }],
      mortalityCalibration: { minAge: 18, referenceHealth: 50, referenceCare: .55, caseFatality: .8, onsetHealth: 20, convalescenceLoss: 4, healthInfluence: .5, careInfluence: .5, ...(graded ?? {}) },
      conditions: [
        { id: "pneumonia", title: "Pneumonia", deathCause: "pneumonia-death", kind: "illness", weight: 1, healthLoss: 8, recoveryChance: .35, careRecoveryBonus: .4, fatalHealthThreshold: 5 },
        { id: "decline", title: "Physical decline", deathCause: "decline-death", kind: "frailty", weight: 0, healthLoss: 5, recoveryChance: 0, careRecoveryBonus: 0, fatalHealthThreshold: 0 },
      ] },
    character: { skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [], childNames: ["Child"],
      activities: [{ id: "walk", text: "Walk", category: "family", outcomes: [{ id: "walked", text: "You walk.", weight: 1, effects: [] }] }], deathCauseDescription: "Fictional named causes.",
      deathCauses: [{ id: "pneumonia-death", title: "Pneumonia", text: "Pneumonia becomes fatal.", weight: 1 }, { id: "decline-death", title: "Physical decline", text: "Health declines.", weight: 1 }] },
  };
}
function state(world: WorldPack, age = 40, health = 80): LifeState {
  const life = structuredClone(createEngine(world).start("fixture"));
  life.age = age; life.year = world.startYear + age; life.stats.health = health;
  life.health = initialHealth(world);
  return life;
}
function scripted(draws: number[]) {
  const entries: string[] = [];
  let index = 0;
  const hooks: HealthHooks = { random: () => draws[Math.min(index++, draws.length - 1)], matches: condition => condition === undefined, support: 0, journal: id => entries.push(id) };
  return { hooks, entries };
}
const nextYear = (life: LifeState) => { life.age++; life.year++; };

test("a graded onset takes a healthy adult down part of the way, never to the floor", () => {
  const world = fixture(), life = state(world);
  developHealthIncident(world, life, scripted([0]).hooks);
  assert.equal(life.stats.health, 55);
  const frail = state(world, 40, 30);
  developHealthIncident(world, frail, scripted([0]).hooks);
  assert.equal(frail.stats.health, 20, "the onset floor still applies");
});

test("without the graded fields the onset keeps its original sharp fall", () => {
  const world = fixture(null), life = state(world);
  developHealthIncident(world, life, scripted([0]).hooks);
  assert.equal(life.stats.health, 20);
});

test("a lingering severe illness cannot kill in its first years and fails slowly", () => {
  const world = fixture(), life = state(world);
  developHealthIncident(world, life, scripted([0]).hooks);
  const healths = [life.stats.health];
  for (let year = 0; year < 2; year++) {
    nextYear(life);
    provideHealthCare(world, life, .55);
    // 0.99 never recovers, and a fatal draw of 0 must still be ignored while lingering.
    const log = scripted([0.99]);
    assert.deepEqual(progressHealth(world, life, log.hooks), {}, `year ${year + 1} is not fatal`);
    assert.equal(life.health!.needsCareDecision, true);
    assert.equal(life.health!.conditions[0].severe!.lingered, year + 1);
    assert.ok(log.entries.includes("health-severe-lingers-pneumonia"));
    healths.push(life.stats.health);
  }
  assert.ok(healths.every((value, index) => index === 0 || value < healths[index - 1]), `health falls each year: ${healths}`);
  assert.ok(healths.at(-1)! > 5, "still above the fatal threshold");
  nextYear(life);
  provideHealthCare(world, life, .55);
  const result = progressHealth(world, life, scripted([0]).hooks);
  assert.equal(result.deathCause, "pneumonia-death");
  assert.match(result.context!, /illness began at age 40/);
});

test("a lingering illness can resolve with convalescence", () => {
  const world = fixture(), life = state(world);
  developHealthIncident(world, life, scripted([0]).hooks);
  nextYear(life);
  const log = scripted([0]);
  assert.deepEqual(progressHealth(world, life, log.hooks), {});
  assert.equal(life.health!.conditions.length, 0);
  assert.ok(log.entries.includes("health-recovery-pneumonia"));
  assert.equal(life.stats.health, 76);
});

test("a lingerRecovery share below one makes a lingering illness harder to shake off", () => {
  const world = fixture({ ...GRADED, lingerRecovery: .5 });
  // Care 0.55 gives a 0.57 recovery chance, halved to about 0.285: a 0.4 draw no longer recovers.
  const life = state(world);
  developHealthIncident(world, life, scripted([0]).hooks);
  nextYear(life);
  provideHealthCare(world, life, .55);
  progressHealth(world, life, scripted([.4]).hooks);
  assert.equal(life.health!.conditions[0].severe!.lingered, 1);
  const full = fixture(), same = state(full);
  developHealthIncident(full, same, scripted([0]).hooks);
  nextYear(same);
  provideHealthCare(full, same, .55);
  progressHealth(full, same, scripted([.4]).hooks);
  assert.equal(same.health!.conditions.length, 0);
});

test("the this-year fatality shown to the player is zero while the illness is still lingering", () => {
  const world = fixture(), life = state(world);
  developHealthIncident(world, life, scripted([0]).hooks);
  const active = life.health!.conditions[0];
  assert.equal(severeEpisodeFatalityProbability(world, life, active, .9), 0);
  active.severe!.lingered = 2;
  assert.ok(severeEpisodeFatalityProbability(world, life, active, .9) > 0);
});

test("care measurably improves survival: healer, then rest, then carrying on", () => {
  const world = fixture();
  const care: Record<string, number> = { healer: .9, rest: .55, carry: 0 };
  const deaths: Record<string, number> = {};
  const count = 4000;
  for (const [name, amount] of Object.entries(care)) {
    deaths[name] = 0;
    for (let index = 0; index < count; index++) {
      const life = state(world);
      let rng = seedToUint32(`pacing-${index}`);
      const hooks: HealthHooks = { random: () => { const draw = nextRandom(rng); rng = draw.state; return draw.value; }, matches: condition => condition === undefined, support: 0, journal: () => {} };
      developHealthIncident(world, life, hooks);
      if (!life.health!.conditions.length) continue;
      for (let year = 0; year < 5 && life.health!.conditions.length; year++) {
        nextYear(life);
        provideHealthCare(world, life, amount);
        if (progressHealth(world, life, hooks).deathCause) { deaths[name]++; break; }
      }
    }
  }
  assert.ok(deaths.healer < deaths.rest && deaths.rest < deaths.carry, JSON.stringify(deaths));
});

test("validation checks the graded fields", () => {
  const changed = (mutate: (world: WorldPack) => void) => { const world = fixture(); mutate(world); assert.throws(() => validateWorld(world), /mortalityCalibration/); };
  assert.doesNotThrow(() => validateWorld(fixture()));
  assert.doesNotThrow(() => validateWorld(fixture(null)));
  changed(world => { world.health!.mortalityCalibration!.onsetLoss = -1; });
  changed(world => { world.health!.mortalityCalibration!.lingerYears = 1.5; });
  changed(world => { world.health!.mortalityCalibration!.lingerYears = -1; });
  changed(world => { world.health!.mortalityCalibration!.lingerLoss = -2; });
  changed(world => { world.health!.mortalityCalibration!.lingerLoss = Infinity; });
  changed(world => { world.health!.mortalityCalibration!.lingerRecovery = 1.5; });
  changed(world => { world.health!.mortalityCalibration!.lingerRecovery = -.1; });
});

const load = (name: string): WorldPack => JSON.parse(readFileSync(new URL(`../worlds/demo/${name}.json`, import.meta.url), "utf8"));

test("only the new free-play world carries the milder illness rules", () => {
  const lives4 = load("alexandria-lives-4").health!.mortalityCalibration!;
  assert.deepEqual([lives4.onsetLoss, lives4.lingerYears, lives4.lingerLoss, lives4.lingerRecovery], [25, 2, 8, 0.1]);
  for (const name of ["alexandria-lives-3", "alexandria-lives-2", "alexandria-lives-1"]) {
    const older = load(name).health!.mortalityCalibration!;
    for (const key of ["onsetLoss", "lingerYears", "lingerLoss", "lingerRecovery"]) assert.equal(Object.hasOwn(older, key), false, `${name} ${key}`);
  }
  const adult = (world: WorldPack) => world.mortality!.bands.find(band => band.minAge <= 40 && band.maxAge >= 40)!.annualProbability;
  assert.ok(adult(load("alexandria-lives-4")) < adult(load("alexandria-lives-3")), "fewer severe onsets");
});

test("in the new world no severe illness kills within two years of its onset, whatever care is chosen", () => {
  const world = load("alexandria-lives-4"), engine = createEngine(world);
  let onsets = 0, deaths = 0;
  for (const choice of ["rest-and-care", "carry-on"]) {
    for (let index = 0; index < 40; index++) {
      let life = engine.start(`mild-${choice}-${index}`);
      while (life.phase !== "ended") {
        if (life.phase === "choice") {
          const options = engine.getChoices(life);
          life = engine.choose(life, (options.find(option => option.id === choice) ?? options[0]).id);
        } else life = engine.advance(life);
      }
      const onset = life.journal.filter(entry => entry.id.startsWith("health-severe-onset-"));
      onsets += onset.length;
      const death = life.journal.find(entry => entry.id.startsWith("health-severe-deterioration-"));
      if (!death) continue;
      deaths++;
      const began = onset.filter(entry => entry.age <= death.age).at(-1)!;
      assert.ok(death.age - began.age >= 2, `${life.seed}: onset at ${began.age}, fatal at ${death.age}`);
    }
  }
  assert.ok(onsets > 0 && deaths > 0, "the cohort sees both onsets and deaths");
});
