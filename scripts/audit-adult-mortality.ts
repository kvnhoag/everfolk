/** Reproducible numerical check; this is game calibration, not an ancient cohort. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createEngine, yearAtAge } from "../src/index.ts";
import { matchesCondition } from "../src/conditions.ts";
import { developHealthIncident, progressHealth, provideHealthCare } from "../src/health.ts";
import { nextRandom, seedToUint32 } from "../src/random.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { advanceYearWithFocus, selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import rawPack from "../worlds/alexandria-sample.json" with { type: "json" };

const pack = rawPack as WorldPack;
const calibration = pack.health?.mortalityCalibration;
if (!calibration || calibration.minAge !== 18) throw new Error("Build the adult-calibrated world before running this audit.");
const intervalTrials = Number(process.argv[2] ?? 100_000);
const playCount = Number(process.argv[3] ?? 128);
if (!Number.isSafeInteger(intervalTrials) || intervalTrials < 10_000 || intervalTrials > 1_000_000 || !Number.isSafeInteger(playCount) || playCount < 1 || playCount > 1_000) throw new Error("Use 10000-1000000 reference trials and 1-1000 play lives.");
const engine = createEngine(pack);
const template = engine.start("adult-calibration-template");
const neutralWorld = structuredClone(engine.world);
neutralWorld.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
neutralWorld.health!.declineBands.forEach(band => { band.healthLoss = 0; });
let randomState = seedToUint32("adult-mortality-reference-v1");
const random = () => { const draw = nextRandom(randomState); randomState = draw.state; return draw.value; };
const referenceProbability = (age: number) => pack.mortality!.bands.find(band => age >= band.minAge && age <= band.maxAge)!.annualProbability;
let unannounced = 0;

function referenceInterval(age: number): boolean {
  const life: LifeState = { ...template, age, year: yearAtAge(pack.startYear, age), phase: "ready", pendingEventId: null,
    stats: { ...template.stats, [pack.health!.stat]: calibration!.referenceHealth }, health: { conditions: [], needsCareDecision: false } };
  const warnings: string[] = [];
  const hooks = { random, support: 0, matches: (condition: Parameters<typeof matchesCondition>[0]) => matchesCondition(condition, life), journal: (id: string) => { warnings.push(id); } };
  developHealthIncident(neutralWorld, life, hooks);
  if (!life.health!.conditions.some(condition => condition.severe)) return false;
  if (!life.health!.needsCareDecision || warnings.length === 0) unannounced++;
  provideHealthCare(neutralWorld, life, calibration!.referenceCare);
  const result = progressHealth(neutralWorld, life, hooks);
  if (!result.deathCause) return false;
  const condition = neutralWorld.health!.conditions.find(condition => condition.deathCause === result.deathCause)!;
  assert.ok(life.stats[pack.health!.stat] <= condition.fatalHealthThreshold);
  return true;
}

const intervals = [18, 20, 40, 60, 80, 95].map(age => {
  let deaths = 0;
  for (let index = 0; index < intervalTrials; index++) if (referenceInterval(age)) deaths++;
  const expected = referenceProbability(age), observed = deaths / intervalTrials;
  const tolerance = 6 * Math.sqrt(expected * (1 - expected) / intervalTrials) + 1 / intervalTrials;
  assert.ok(Math.abs(observed - expected) <= tolerance, `Age ${age}: ${observed} vs ${expected}`);
  return { age, intervals: intervalTrials, deaths, expectedAnnualProbability: expected, observedAnnualProbability: observed, tolerance };
});
assert.equal(unannounced, 0);

const survivalTrials = Math.min(intervalTrials, 25_000);
const checkpoints = [40, 60, 80];
const reached = Object.fromEntries(checkpoints.map(age => [age, 0]));
for (let index = 0; index < survivalTrials; index++) {
  for (let age = calibration.minAge; age < 80; age++) {
    if (referenceInterval(age)) break;
    if (checkpoints.includes(age + 1)) reached[age + 1]++;
  }
}
const referenceSurvival = checkpoints.map(age => {
  let expected = 1;
  for (let completedAge = calibration.minAge; completedAge < age; completedAge++) expected *= 1 - referenceProbability(completedAge);
  const observed = reached[age] / survivalTrials;
  const tolerance = 6 * Math.sqrt(expected * (1 - expected) / survivalTrials) + 1 / survivalTrials;
  assert.ok(Math.abs(observed - expected) <= tolerance, `Survival to ${age}: ${observed} vs ${expected}`);
  return { birthday: age, entrantsAt18: survivalTrials, reached: reached[age], expectedConditionalSurvival: expected, observedConditionalSurvival: observed, tolerance };
});

const policies = ["everyday", "health"] as const;
const actualPlay = policies.map(policy => {
  const ages: number[] = [];
  const milestones = { 18: 0, 40: 0, 60: 0, 80: 0 };
  let naturalDeaths = 0, explicitDeaths = 0, chapterRecords = 0, unannouncedNaturalDeaths = 0;
  for (let index = 0; index < playCount; index++) {
    let life = engine.start(`adult-play-audit-${index}`);
    const careSeen = new Set<string>();
    for (let commands = 0; commands < 2_000 && life.phase !== "ended"; commands++) {
      if (life.phase === "choice") {
        if (life.pendingEventId === pack.health!.careDecision) for (const condition of life.health!.conditions) careSeen.add(condition.id);
        life = engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world, life)!.id);
      } else life = advanceYearWithFocus(engine, life, policy);
    }
    assert.equal(life.phase, "ended", "The bounded policy must finish.");
    ages.push(life.age);
    for (const birthday of [18, 40, 60, 80] as const) if (life.age >= birthday) milestones[birthday]++;
    if (life.deathCauseKind === "condition") {
      naturalDeaths++;
      const matching = pack.health!.conditions.filter(condition => condition.deathCause === life.deathCauseId);
      if (!matching.some(condition => careSeen.has(condition.id) && life.stats[pack.health!.stat] <= condition.fatalHealthThreshold)) unannouncedNaturalDeaths++;
    } else if (life.deathCauseKind === "choice") explicitDeaths++;
    else chapterRecords++;
    if (index < 4) assert.deepEqual(engine.load(engine.save(life)), life);
  }
  assert.equal(unannouncedNaturalDeaths, 0);
  ages.sort((a, b) => a - b);
  return { policy, lives: playCount, meanCompletedAge: ages.reduce((sum, age) => sum + age, 0) / ages.length,
    medianCompletedAge: ages[Math.floor(ages.length / 2)], birthdayReached: milestones, naturalDeaths, explicitDeaths, chapterRecords, unannouncedNaturalDeaths };
});

const report = {
  version: pack.version, fingerprint: engine.fingerprint,
  interpretation: "Reference trials isolate the source-based annual mortality calibration at reference Health, reference care and no household support. They disable ordinary illness and ageing and reset Health each interval. Actual play policies retain normal events, illness, ageing, work and care; their results are separate game outcomes and are not estimates of historical mortality. The source is a later Roman Egyptian female model, not measured rates for Ptolemaic Alexandria.",
  reference: { intervals, conditionalSurvivalFrom18: referenceSurvival, unannounced }, actualPlay,
};
writeFileSync(new URL("../artifacts/adult-mortality-audit.json", import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
