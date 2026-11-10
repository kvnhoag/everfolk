import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import type { WorldPack } from "../src/types.ts";
import source from "../research/mortality-model.json" with { type: "json" };
import balance from "../research/game-balance.json" with { type: "json" };
import previous from "../worlds/alexandria-0.6.0.json" with { type: "json" };
// The 0.14 age-band profile remains a retained comparison and replay contract.
// New causal-health lives have their own condition-based integration coverage.
import current from "../worlds/alexandria-0.14.0.json" with { type: "json" };

function comparisonProbability(age: number): number {
  const interval = source.intervals.find(row => row.minAge <= age && age < row.nextAge);
  return interval ? 1 - (1 - interval.deathProbability) ** (1 / (interval.nextAge - interval.minAge))
    : 1 - Math.exp(-1 / source.oldestAgeTail.sourceRemainingLifeExpectancy);
}

function multiplier(age: number): number {
  return balance.mortality.ageMultipliers.find(row => row.minAge <= age && age <= row.maxAge)?.multiplier
    ?? balance.mortality.defaultMultiplier;
}

function probability(age: number, curve: "source" | "previous" | "current"): number {
  if (curve === "source") return comparisonProbability(age);
  if (curve === "previous") return previous.mortality.bands.find(row => row.minAge <= age && age <= row.maxAge)!.annualProbability;
  return comparisonProbability(age) * multiplier(age);
}

function survival(toBirthday: number, curve: "source" | "previous" | "current"): number {
  let surviving = 1;
  for (let age = 0; age < toBirthday; age++) surviving *= 1 - probability(age, curve);
  return surviving;
}

function cohortWorld(curve: "previous" | "current"): WorldPack {
  return {
    schemaVersion: 1, id: "mortality-balance-test", version: curve,
    title: "Mortality-only comparison", description: "Synthetic test isolates the balance profile from events and optional risks.",
    startYear: -66, maxAge: 80,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 70 } }, flags: {},
    origins: [{ id: "household", title: "Household", text: "A synthetic life starts.", weight: 1, effects: [] }],
    yearlyEffects: [], events: [],
    mortality: { description: "Synthetic mortality-only cohort.", sourceIds: [], bands: Array.from({ length: 80 }, (_, age) => ({
      minAge: age, maxAge: age, annualProbability: probability(age, curve), ending: "complete",
    })) },
    endings: [{ id: "complete", title: "Complete", text: "The test life ends.", kind: "death" }], defaultEnding: "complete",
  };
}

test("the retained 0.14 longer-life profile applies bounded factors at every authored age boundary", () => {
  assert.equal(balance.mortality.id, "longer-lives-v2");
  assert.equal(balance.mortality.defaultMultiplier, 1);
  let previousEnd = -1;
  for (const row of balance.mortality.ageMultipliers) {
    assert.equal(row.minAge, previousEnd + 1);
    assert.ok(row.maxAge >= row.minAge && row.maxAge < 95);
    assert.ok(row.multiplier > 0 && row.multiplier < 1);
    previousEnd = row.maxAge;
  }
  assert.equal(previousEnd, 94);
  for (const [age, expected] of [[0, .06], [1, .03], [4, .03], [5, .06], [17, .06], [18, .35], [59, .35], [60, .55], [79, .55], [80, .8], [94, .8], [95, 1], [99, 1]]) {
    assert.equal(multiplier(age), expected, `Age ${age}`);
  }
});

test("generated gameplay risks are lower than the preceding release through age 94 and retain the tail", () => {
  assert.equal(current.maxAge, 100);
  assert.equal(current.maxAge, previous.maxAge);
  for (let age = 0; age < current.maxAge; age++) {
    const generated = current.mortality.bands.find(row => row.minAge <= age && age <= row.maxAge)!;
    assert.equal(generated.annualProbability, probability(age, "current"), `Generated age ${age}`);
    assert.ok(generated.annualProbability > 0 && generated.annualProbability < 1);
    if (age < 95) assert.ok(generated.annualProbability < probability(age, "previous"), `Reduced age ${age}`);
    else assert.equal(generated.annualProbability, probability(age, "previous"), `Unchanged tail age ${age}`);
  }
});

test("gameplay summaries match the generated survival curve and distinguish the source", () => {
  assert.ok(Math.abs(probability(0, "current") - .0200394) < 1e-12);
  assert.ok(survival(18, "current") > .96 && survival(18, "current") < .97);
  assert.ok(survival(40, "current") > .82 && survival(40, "current") < .83);
  assert.ok(survival(60, "current") > .65 && survival(60, "current") < .66);
  for (const age of [18, 40, 60, 80]) assert.ok(survival(age, "current") > survival(age, "previous"));
  const percentage = (value: number) => `${(value * 100).toFixed(2)}%`;
  assert.ok(current.mortality.description.includes(percentage(1 - survival(1, "current"))));
  for (const age of [18, 40, 60]) assert.ok(current.mortality.description.includes(`${percentage(survival(age, "current"))} reach age ${age}`));
  assert.match(current.mortality.description, /background mortality only and exclude optional fatal choices/);
  assert.match(current.mortality.description, /22\.5 years describes that comparison, not this easier game curve/);
});

test("historical comparison inputs retain their original values independently of play balance", () => {
  assert.equal(contentFingerprint(source), "fnv1a64-a135bca3e7e2f40b");
  assert.equal(source.sourceLifeExpectancyAtBirth, 22.5);
  assert.equal(source.intervals[0].deathProbability, .33399);
  assert.ok(survival(18, "source") > .43 && survival(18, "source") < .44);
  assert.ok(survival(40, "source") > .27 && survival(40, "source") < .28);
});

test("dangerous choices and activities retain their exact separately disclosed fatal outcomes", () => {
  const fatal = (world: WorldPack) => [
    ...world.events.flatMap(event => event.choices.map(choice => ({ id: `${event.id}:${choice.id}`, outcomes: choice.outcomes }))),
    ...(world.character?.activities.map(activity => ({ id: activity.id, outcomes: activity.outcomes })) ?? []),
  ].filter(option => option.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "end" && effect.deathCause)));
  const old = fatal(previous as WorldPack), updated = fatal(current as WorldPack);
  assert.ok(old.length > 0);
  assert.deepEqual(updated, old);
});

test("a seeded mortality-only cohort sees fewer childhood and adult endings while early deaths remain possible", () => {
  const earlier = createEngine(cohortWorld("previous")), play = createEngine(cohortWorld("current"));
  let previousEarly = 0, playEarly = 0, infant = 0, previousForty = 0, playForty = 0, previousSixty = 0, playSixty = 0;
  const count = 1000;
  for (let index = 0; index < count; index++) {
    const seed = `longer-life-cohort-${index}`;
    let original = earlier.start(seed), adjusted = play.start(seed);
    while (original.phase !== "ended") original = earlier.advance(original);
    while (adjusted.phase !== "ended") adjusted = play.advance(adjusted);
    previousEarly += Number(original.age < 18); playEarly += Number(adjusted.age < 18); infant += Number(adjusted.age === 0);
    previousForty += Number(original.age >= 40); playForty += Number(adjusted.age >= 40);
    previousSixty += Number(original.age >= 60); playSixty += Number(adjusted.age >= 60);
    assert.ok(adjusted.age >= original.age, "Lower risks alone cannot shorten a paired mortality-only life.");
    if (index < 3) assert.deepEqual(play.load(play.save(adjusted)), adjusted);
  }
  assert.ok(previousEarly / count > .06 && previousEarly / count < .12);
  assert.ok(playEarly / count > .02 && playEarly / count < .06);
  assert.ok(infant / count > .01 && infant / count < .035);
  assert.ok(playEarly < previousEarly / 2);
  assert.ok(playForty / count > .76 && playForty / count < .88);
  assert.ok(playSixty / count > .59 && playSixty / count < .71);
  assert.ok(playForty - previousForty > count * .18);
  assert.ok(playSixty - previousSixty > count * .28);
});
