import { withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, yearAtAge } from "../src/index.ts";
import { getOpportunityPreview } from "../src/outcomes.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.18.0.json" with { type: "json" };

function fixture(): WorldPack {
  const world = withoutMoneylender(structuredClone(current) as WorldPack);
  // This fixture isolates career qualifications from all illness onset paths.
  delete world.health!.mortalityCalibration;
  world.events = world.events.filter(event => event.id === world.health!.careDecision);
  delete world.eventPacing;
  delete world.character!.encounterPacing;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyRules = [];
  world.yearlyEffects = [{ type: "cash", delta: 20 }];
  for (const origin of world.origins) {
    origin.effects = [];
    origin.statRanges = { ...origin.statRanges, wealth: { min: 50, max: 50 }, knowledge: { min: 30, max: 30 } };
  }
  return world;
}
function ageTo(engine: LifeEngine, life: LifeState, age: number): LifeState {
  while (life.age < age) life = engine.advance(life);
  return life;
}
function available(engine: LifeEngine, life: LifeState, id: string) {
  const activity = engine.getActivities(life).find(activity => activity.id === id);
  assert.ok(activity, `Missing ${id}`);
  return activity;
}

test("origin helps a career opening, while acquired skills and work make a larger difference", () => {
  const engine = createEngine(fixture());
  const life = structuredClone(ageTo(engine, engine.start("opening-context"), 25));
  const choice = engine.world.character!.activities.find(item => item.id === "prepare-official-petition")!;
  life.originId = "fishing-household";
  life.character!.skills.literacy = 15;
  life.character!.skills.oratory = 0;
  const baseline = getOpportunityPreview(engine.world, life, choice)!;
  assert.ok(baseline.probability > 0 && baseline.probability < 1);
  life.originId = "clerk-household";
  const originHelp = getOpportunityPreview(engine.world, life, choice)!;
  assert.ok(originHelp.probability > baseline.probability);
  life.originId = "fishing-household";
  life.character!.jobId = "copyist";
  life.character!.skills.literacy = 35;
  life.character!.skills.oratory = 25;
  life.flags["petition-presented"] = true;
  const earned = getOpportunityPreview(engine.world, life, choice)!;
  assert.ok(earned.probability > originHelp.probability, "Work and earned experience outweigh the modest origin bonus.");
  assert.ok(earned.probability < 1, "Strong applicants can still be refused.");
  life.health!.conditions.push({ id: "pneumonia", sinceAge: life.age, lastProgressAge: life.age, care: 0 });
  assert.ok(getOpportunityPreview(engine.world, life, choice)!.probability < earned.probability);
});

test("each offered route has an unconditional way to decline and recommendations never switch jobs", () => {
  const world = fixture();
  const engine = createEngine(world);
  const life = structuredClone(ageTo(engine, engine.start("decline-career-opening"), 25));
  life.character!.jobId = "porter";
  for (const event of current.events.filter(event => event.id.startsWith("career-") && event.id.endsWith("-opening"))) {
    const fallback = event.choices.find(choice => !choice.when);
    assert.ok(fallback, `${event.id} needs an unconditional fallback`);
    assert.deepEqual(fallback.outcomes.flatMap(outcome => outcome.effects), []);
    for (const outcome of event.choices.flatMap(choice => choice.outcomes)) {
      assert.equal(outcome.effects.some(effect => effect.type === "job" || effect.type === "end"), false);
    }
  }
  const pursuit = engine.world.character!.activities.find(item => item.id === "show-workshop-sample")!;
  assert.ok(pursuit.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "flag" && effect.flag === "workshop-recommendation")));
  assert.equal(pursuit.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "job")), false);
});

test("an earned workshop recommendation opens explicit leadership work through actual training and replay", () => {
  const engine = createEngine(fixture());
  let successful: LifeState | undefined;
  for (let seed = 0; seed < 16 && !successful; seed++) {
    let life = ageTo(engine, engine.start(`workshop-career-${seed}`), 10);
    life = engine.act(life, "train-craft");
    life = engine.act(ageTo(engine, life, 11), "train-craft");
    life = engine.act(ageTo(engine, life, 12), "work-apprentice");
    for (const age of [13, 14, 15]) life = engine.act(ageTo(engine, life, age), "train-reckoning");
    for (let age = 16; age < 25; age++) life = engine.act(ageTo(engine, life, age), "train-pottery");
    life = ageTo(engine, life, 25);
    assert.equal(available(engine, life, "work-pottery-workshop-lead").available, false, "Skills alone do not grant the opening.");
    const previousJob = life.character!.jobId;
    life = engine.act(life, "show-workshop-sample");
    assert.equal(life.character!.jobId, previousJob, "A successful sample does not replace employment.");
    if (!life.flags["workshop-recommendation"]) continue;
    assert.equal(available(engine, life, "show-workshop-sample").available, false);
    life = ageTo(engine, life, 26);
    const post = available(engine, life, "work-pottery-workshop-lead");
    assert.equal(post.available, true, post.reason);
    life = engine.act(life, post.id);
    assert.equal(life.character!.jobId, "pottery-workshop-lead");
    const before = life.economy!.cash;
    life = engine.advance(life);
    assert.ok(life.economy!.cash > before, "The accepted post pays regular cash.");
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
    assert.deepEqual(engine.load(engine.save(life)), life);
    successful = life;
  }
  assert.ok(successful, "An ordinary origin can earn the opening through training.");
});

test("recommendations never bypass job skills, current service or the end of royal rule", () => {
  const engine = createEngine(fixture());
  const life = structuredClone(ageTo(engine, engine.start("appointment-gates"), 28));
  for (const id of ["court-recommendation", "officer-recommendation", "scholar-recommendation", "workshop-recommendation"]) life.flags[id] = true;
  assert.equal(available(engine, life, "work-patron-supported-reader").available, false);
  assert.equal(available(engine, life, "work-pottery-workshop-lead").available, false);
  assert.equal(available(engine, life, "seek-officer-commission").available, false);
  for (const id of Object.keys(life.character!.skills)) life.character!.skills[id] = 80;
  life.character!.jobId = "soldier";
  life.flags["officer-commission"] = true;
  assert.equal(available(engine, life, "seek-officer-commission").available, true);
  life.character!.jobId = "officer";
  assert.equal(available(engine, life, "seek-general-command").available, true);
  assert.equal(available(engine, life, "seek-court-appointment").available, true);
  life.age = 36;
  life.year = yearAtAge(engine.world.startYear, 36);
  assert.equal(life.year, -30);
  for (const id of ["seek-officer-commission", "seek-general-command", "seek-court-appointment", "prepare-official-petition", "organise-unit-supplies"]) {
    assert.equal(available(engine, life, id).available, false, id);
  }
  assert.equal(available(engine, life, "work-patron-supported-reader").available, true);
  assert.equal(available(engine, life, "work-pottery-workshop-lead").available, true);
});

test("rare appointments keep skill requirements and older lives keep their authored fixed chances", () => {
  const engine = createEngine(fixture());
  const life = structuredClone(ageTo(engine, engine.start("prestige-odds"), 30));
  life.character!.jobId = "officer";
  const command = engine.world.character!.activities.find(item => item.id === "seek-general-command")!;
  assert.ok(Math.abs(getOpportunityPreview(engine.world, life, command)!.probability - .02) < 1e-12);
  life.flags["officer-recommendation"] = true;
  life.flags["joined-alexandrian-war"] = true;
  life.character!.skills.warfare = 80;
  life.character!.skills.oratory = 50;
  const improved = getOpportunityPreview(engine.world, life, command)!.probability;
  assert.ok(improved > .02 && improved < .15, "Senior command stays exceptional even with strong backing.");
  for (const id of ["seek-general-command", "seek-officer-commission", "seek-court-appointment"]) {
    const retained = previous.character.activities.find(item => item.id === id)!;
    assert.equal("weightModifiers" in retained.outcomes[0], false);
    assert.equal("opportunity" in retained, false);
    assert.deepEqual(engine.world.character!.activities.find(item => item.id === id)!.when, retained.when);
  }
});

test("civilian leadership pays more than the corresponding ordinary occupation", () => {
  const income = (id: string) => current.character.jobs.find(job => job.id === id)!.yearlyEffects.reduce((sum, effect) => {
    if (effect.type === "cash") return sum + effect.delta;
    if (effect.type === "stat" && effect.stat === current.economy.stat) return sum + effect.delta * current.economy.unitsPerPoint;
    return sum;
  }, 0);
  for (const [higher, ordinary] of [
    ["patron-supported-reader", "sky-table-calculator"],
    ["pottery-workshop-lead", "potter"],
    ["carving-workshop-lead", "wood-carver"],
    ["sculpture-workshop-lead", "sculptor"],
  ]) assert.ok(income(higher) > income(ordinary), `${higher} should pay more than ${ordinary}`);
});
