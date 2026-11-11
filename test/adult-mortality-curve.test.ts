import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, yearAtAge } from "../src/index.ts";
import { matchesCondition } from "../src/conditions.ts";
import { developHealthIncident, progressHealth, provideHealthCare } from "../src/health.ts";
import { nextRandom, seedToUint32 } from "../src/random.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.19.0.json" with { type: "json" };
import source from "../research/mortality-model.json" with { type: "json" };

const world = current as WorldPack;
const comparison = (age: number) => {
  const interval = source.intervals.find(row => row.minAge <= age && age < row.nextAge);
  return interval ? 1 - (1 - interval.deathProbability) ** (1 / (interval.nextAge - interval.minAge))
    : 1 - Math.exp(-1 / source.oldestAgeTail.sourceRemainingLifeExpectancy);
};
const generated = (age: number) => world.mortality!.bands.find(band => band.minAge <= age && age <= band.maxAge)!.annualProbability;

test("the play reduction ends at18 and every adult annual target keeps the source conversion", () => {
  assert.equal(world.version, "0.42.0");
  assert.equal(world.health!.mortalityCalibration!.minAge, 18);
  for (let age = 0; age < 100; age++) {
    if (age < 18) assert.ok(generated(age) < comparison(age), `Childhood age ${age}`);
    else assert.equal(generated(age), comparison(age), `Unreduced adult age ${age}`);
  }
  for (let age = 0; age < 18; age++) {
    const old = previous.mortality.bands.find(band => band.minAge <= age && age <= band.maxAge)!.annualProbability;
    assert.equal(generated(age), old, `Childhood target age ${age} stays unchanged`);
  }
  assert.equal(world.maxAge, 100);
  assert.equal(world.endings.find(ending => ending.id === world.defaultEnding)!.kind, "chapter");
});

test("adult-conditional survival matches the unchanged life-table intervals", () => {
  const expected = new Map([[40, .6390647459520908], [60, .323714159657325], [80, .02623817384689295]]);
  for (const [birthday, target] of expected) {
    let survived = 1;
    for (let age = 18; age < birthday; age++) survived *= 1 - generated(age);
    assert.ok(Math.abs(survived - target) < 1e-7, `${birthday}: ${survived}`);
  }
  for (const interval of source.intervals.filter(row => row.minAge >= 20)) {
    let survived = 1;
    for (let age = interval.minAge; age < interval.nextAge; age++) survived *= 1 - generated(age);
    assert.ok(Math.abs((1 - survived) - interval.deathProbability) < 1e-12);
  }
});

test("actual warned severe episodes reproduce reference annual mortality in seeded neutral intervals", () => {
  const neutral = structuredClone(world);
  neutral.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  neutral.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  const engine = createEngine(neutral), template = engine.start("curve-template");
  const config = neutral.health!.mortalityCalibration!;
  let rng = seedToUint32("adult-curve-reference-trials-v1");
  const random = () => { const result = nextRandom(rng); rng = result.state; return result.value; };
  const trials = 20_000;
  for (const age of [18, 20, 40, 60, 80, 95]) {
    let deaths = 0;
    for (let index = 0; index < trials; index++) {
      const life: LifeState = { ...template, age, year: yearAtAge(neutral.startYear, age), phase: "ready", pendingEventId: null,
        stats: { ...template.stats, [neutral.health!.stat]: config.referenceHealth }, health: { conditions: [], needsCareDecision: false } };
      let warned = false;
      const hooks = { random, support: 0, matches: (condition: Parameters<typeof matchesCondition>[0]) => matchesCondition(condition, life), journal: () => { warned = true; } };
      developHealthIncident(neutral, life, hooks);
      const serious = life.health!.conditions.some(condition => condition.severe);
      if (!serious) continue;
      assert.equal(life.health!.needsCareDecision, true);
      assert.equal(warned, true);
      assert.equal(life.phase, "ready");
      assert.equal(life.deathCauseId, undefined);
      provideHealthCare(neutral, life, config.referenceCare);
      const result = progressHealth(neutral, life, hooks);
      if (!result.deathCause) continue;
      deaths++;
      const condition = neutral.health!.conditions.find(item => item.deathCause === result.deathCause)!;
      assert.ok(life.stats[neutral.health!.stat] <= condition.fatalHealthThreshold);
    }
    const expected = generated(age), observed = deaths / trials;
    const tolerance = 6 * Math.sqrt(expected * (1 - expected) / trials) + 1 / trials;
    assert.ok(Math.abs(observed - expected) <= tolerance, `Age ${age}: ${observed} vs ${expected}`);
  }
});
