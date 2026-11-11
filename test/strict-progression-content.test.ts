import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, Effect, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { advanceYearWithFocus, selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import current from "../worlds/alexandria-0.18.0.json" with {type:"json"};
import previous from "../worlds/alexandria-0.17.0.json" with {type:"json"};

test("strict progression preserves financial terms, health hazards, care and career entry requirements", () => {
  assert.equal(current.version, "0.18.0");
  assert.deepEqual(current.economy, previous.economy);
  assert.equal("gainCurve" in current.stats.wealth, false);
  assert.deepEqual(current.health, previous.health);
  assert.deepEqual(current.mortality, previous.mortality);
  assert.deepEqual(current.knowledge, previous.knowledge);
  assert.deepEqual(current.relationships, previous.relationships);
  assert.deepEqual(current.origins, previous.origins);
  const protectedEffects = (effects: readonly Effect[]) => effects.filter(effect =>
    effect.type !== "skill" && !(effect.type === "stat" && ["knowledge", "bonds"].includes(effect.stat)));
  for (const job of current.character.jobs) {
    const old = previous.character.jobs.find(candidate => candidate.id === job.id)!;
    assert.equal(job.minAge, old.minAge);
    assert.deepEqual("requirements" in job ? job.requirements : undefined, "requirements" in old ? old.requirements : undefined);
    assert.deepEqual(protectedEffects(job.yearlyEffects), protectedEffects(old.yearlyEffects));
  }
  const compareChoice = (choice: Choice, old: Choice, briefPractice = false) => {
    assert.deepEqual("when" in choice ? choice.when : undefined, "when" in old ? old.when : undefined);
    for (const outcome of choice.outcomes) {
      const oldOutcome = old.outcomes.find(candidate => candidate.id === outcome.id)!;
      assert.equal(outcome.weight, oldOutcome.weight);
      const expected = briefPractice ? oldOutcome.effects.filter(effect => !(effect.type === "stat" && effect.stat === "health" && effect.delta < 0)) : oldOutcome.effects;
      assert.deepEqual(protectedEffects(outcome.effects), protectedEffects(expected));
    }
  };
  for (const event of current.events) {
    const old = previous.events.find(candidate => candidate.id === event.id)!;
    for (const choice of event.choices) compareChoice(choice, old.choices.find(candidate => candidate.id === choice.id)!);
  }
  for (const activity of current.character.activities) compareChoice(activity, previous.character.activities.find(candidate => candidate.id === activity.id)!, ["train-craft", "train-carving", "train-sculpture"].includes(activity.id));
});

function controlledWorld(): WorldPack {
  const world = structuredClone(current) as WorldPack;
  world.events = world.events.filter(event => ["the-first-household", world.health!.careDecision].includes(event.id));
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = [];
  world.yearlyRules = [];
  for (const origin of world.origins) {
    origin.effects = [];
    origin.statRanges = { health: { min: 100, max: 100 }, knowledge: { min: 50, max: 50 }, wealth: { min: 80, max: 80 } };
  }
  return world;
}
function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.age < target) life = engine.advance(life);
  return life;
}

test("dedicated practice still reaches ordinary and specialised paid work before thirty", () => {
  const engine = createEngine(controlledWorld());
  const routes = [
    { job: "copyist", start: 6, training: Array(5).fill("train-literacy") },
    { job: "potter", start: 10, training: Array(3).fill("train-craft") },
    { job: "wood-carver", start: 10, training: [...Array(3).fill("train-craft"), ...Array(4).fill("train-carving")] },
    { job: "sculptor", start: 10, training: [...Array(3).fill("train-craft"), ...Array(4).fill("train-carving"), ...Array(2).fill("train-pottery"), ...Array(5).fill("train-sculpture")] },
  ];
  for (const route of routes) {
    let life = ageTo(engine, engine.start(`strict-career-${route.job}`), route.start);
    for (const id of route.training) {
      const action = engine.getActivities(life).find(activity => activity.id === id)!;
      assert.equal(action.available, true, `${id}: ${action.reason}`);
      life = engine.advance(engine.act(life, id));
    }
    const job = engine.world.character!.jobs.find(job => job.id === route.job)!;
    life = ageTo(engine, life, Math.max(life.age, job.minAge));
    assert.ok(life.age < 30, `${route.job} should be an attainable early livelihood.`);
    const work = engine.getActivities(life).find(activity => activity.id === `work-${route.job}`)!;
    assert.equal(work.available, true, `${route.job}: ${work.reason}`);
    life = engine.act(life, work.id);
    assert.equal(life.character!.jobId, route.job);
    assert.deepEqual(engine.load(engine.save(life)), life);
  }
});

test("a fixed ordinary-focus cohort avoids capped scores and instant mastery by thirty", () => {
  const engine = createEngine(current);
  for (const focus of ["everyday", "study", "craft", "friends", "health"] as const) {
    for (let seed = 0; seed < 8; seed++) {
      let life = engine.start(`stat-cap-audit-${seed}`);
      while (life.phase !== "ended" && life.age < 30) {
        life = life.phase === "choice"
          ? engine.choose(life, selectAutomaticChoice(engine.getChoices(life), engine.world)!.id)
          : advanceYearWithFocus(engine, life, focus);
        for (const id of ["health", "knowledge", "bonds"]) assert.ok(life.stats[id] < 100, `${focus} ${seed} ${id} at ${life.age}`);
        assert.ok(Object.values(life.character!.skills).every(value => value < 100), `${focus} ${seed} reaches instant mastery.`);
      }
      assert.equal(life.age, 30, `${focus} ${seed} must exercise a full young adult path.`);
      assert.deepEqual(engine.replay(life.seed, life.commands), life);
    }
  }
});
