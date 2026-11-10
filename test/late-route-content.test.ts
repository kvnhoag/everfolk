import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld } from "../src/index.ts";
import { getOpportunityPreview } from "../src/outcomes.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import previous from "../worlds/alexandria-0.33.0.json" with { type: "json" };
import { applyLateRoutes, lateRoutePlans } from "../scripts/alexandria-late-routes.mjs";

function controlled(): WorldPack {
  const world = applyLateRoutes(structuredClone(previous)) as WorldPack;
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.yearlyEffects = []; world.yearlyRules = []; delete world.knowledge;
  const required = [world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)];
  world.events = world.events.filter(event => required.includes(event.id));
  for (const origin of world.origins) {
    origin.effects = [];
    origin.statRanges = Object.fromEntries(Object.keys(world.stats).map(id => [id, { min: 80, max: 80 }]));
  }
  for (const definition of Object.values(world.character!.skills)) definition.initial = 75;
  for (const route of world.legacy!.routes) world.character!.activities.push({
    id: `fixture-work-${route.id}`, text: "Complete the fixture's initial work", category: "career", minAge: 18,
    when: { type: "not", condition: { type: "accomplishment", achievement: `${route.id}-first-work` } },
    outcomes: [{ id: `fixture-work-${route.id}-done`, text: `${world.legacy!.achievements.find(item => item.id === `${route.id}-first-work`)!.people.join(" and ")} accept the initial work.`, weight: 1,
      effects: [{ type: "accomplishment", achievement: `${route.id}-first-work` }] }],
  });
  return world;
}

function ageTo(engine: LifeEngine, life: LifeState, age: number): LifeState {
  while (life.phase === "ready" && life.age < age) life = engine.advance(life);
  assert.equal(life.age, age);
  assert.equal(life.phase, "ready");
  return life;
}
function has(life: LifeState, achievement: string) {
  return life.accomplishments!.some(record => record.achievementId === achievement);
}
function complete(engine: LifeEngine, life: LifeState, achievement: string): LifeState {
  while (!has(life, achievement) && life.age < 80) {
    life = engine.act(life, `undertake-${achievement}`);
    if (!has(life, achievement)) life = ageTo(engine, life, life.age + 3);
  }
  assert.ok(has(life, achievement), achievement);
  return life;
}
function reachFinal(engine: LifeEngine, route: string, seed: string): LifeState {
  let life = ageTo(engine, engine.start(seed), 18);
  life = engine.act(life, `fixture-work-${route}`);
  life = ageTo(engine, life, 24);
  const spec = lateRoutePlans.find(plan => plan.id === route)!.specializations[0].id;
  life = complete(engine, life, `${route}-${spec}`);
  life = ageTo(engine, life, Math.max(30, life.age + 2));
  life = complete(engine, life, `${route}-signature-work`);
  return ageTo(engine, life, Math.max(36, life.age + 3));
}

test("seven later routes add alternative specializations, accepted signature work and a distinct ultimate title", () => {
  const world = applyLateRoutes(structuredClone(previous)) as WorldPack;
  validateWorld(world);
  assert.equal(world.version, "0.34.0");
  assert.equal(world.legacy!.routes.length, 7);
  assert.equal(world.legacy!.achievements.length - previous.legacy.achievements.length, 29);
  for (const route of world.legacy!.routes) {
    assert.deepEqual(route.stages!.map(stage => stage.achievementIds.length), [2, 1, 1]);
    const title = world.legacy!.achievements.find(item => item.id === `${route.id}-ultimate-title`)!;
    assert.equal(title.kind, "ultimate");
  }
  for (const key of ["mortality", "health", "economy", "yearlyEffects", "yearlyRules"] as const) {
    assert.deepEqual(world[key], previous[key], key);
  }
  assert.deepEqual(world.character!.skills, previous.character.skills, "Later projects retain the learned proficiencies and their taper.");
  assert.deepEqual(world.character!.jobs, previous.character.jobs, "Recognition does not silently confer an office.");
});

test("maximum proficiency cannot bypass earlier work, minimum age or the elapsed review periods", () => {
  const world = controlled();
  for (const definition of Object.values(world.character!.skills)) definition.initial = 100;
  const engine = createEngine(world);
  let life = ageTo(engine, engine.start("late-route-hard-gates"), 36);
  for (const plan of lateRoutePlans) {
    for (const achievement of [...plan.specializations.map(spec => `${plan.id}-${spec.id}`), `${plan.id}-signature-work`, `${plan.id}-ultimate-title`]) {
      const action = engine.getActivities(life).find(item => item.id === `undertake-${achievement}`);
      assert.equal(action?.available, false);
    }
    const title = engine.world.character!.activities.find(item => item.id === `undertake-${plan.id}-ultimate-title`)!;
    assert.equal(matchesCondition(title.when, life), false, plan.id);
  }
  life = ageTo(engine, engine.start("late-route-age-gates"), 18);
  life = engine.act(life, "fixture-work-sculpture");
  life = ageTo(engine, life, 23);
  const specialization = "sculpture-monumental-work";
  assert.throws(() => engine.act(life, `undertake-${specialization}`), /age 24/);
  life = complete(engine, ageTo(engine, life, 24), specialization);
  const signature = engine.world.character!.activities.find(item => item.id === "undertake-sculpture-signature-work")!;
  assert.equal(matchesCondition(signature.when, life), false, "Accepted work must mature before its later review.");
  assert.throws(() => engine.act(life, "train-craft"), /major activity/);
  life = complete(engine, ageTo(engine, life, Math.max(30, life.age + 2)), "sculpture-signature-work");
  const title = engine.world.character!.activities.find(item => item.id === "undertake-sculpture-ultimate-title")!;
  const signatureAge = life.age;
  assert.equal(matchesCondition(title.when, life), false);
  life = ageTo(engine, life, signatureAge + 2);
  assert.equal(matchesCondition(title.when, life), false, "The final review cannot borrow an incomplete three-year record.");
  life = ageTo(engine, life, signatureAge + 3);
  assert.equal(matchesCondition(title.when, life), true);

  const noCash = controlled();
  for (const origin of noCash.origins) origin.statRanges!.wealth = { min: 0, max: 0 };
  const poor = createEngine(noCash);
  let unfunded = ageTo(poor, poor.start("late-route-cash-gate"), 18);
  unfunded = poor.act(unfunded, "fixture-work-sculpture");
  unfunded = ageTo(poor, unfunded, 24);
  assert.equal(unfunded.economy!.cash, 0);
  assert.throws(() => poor.act(unfunded, "undertake-sculpture-monumental-work"), /cash|Needs 10/);
});

test("all seven final assessments resolve once, with real accepted work, deterministic replay and honest failure", () => {
  const engine = createEngine(controlled());
  for (const plan of lateRoutePlans) {
    let success: LifeState | undefined, failure: LifeState | undefined;
    for (let seed = 0; seed < 64 && (!success || !failure); seed++) {
      const before = reachFinal(engine, plan.id, `late-${plan.id}-${seed}`);
      const id = `${plan.id}-ultimate-title`;
      const action = engine.getActivities(before).find(item => item.id === `undertake-${id}`)!;
      assert.equal(action.available, true, plan.id);
      const saved = engine.save(before);
      const chance = getOpportunityPreview(engine.world, before, action)!.probability;
      assert.ok(chance > .15 && chance < .25, `${plan.id}: bounded prepared chance ${chance}`);
      assert.equal(engine.save(before), saved, "Reading the final preview cannot consume a roll.");
      const after = engine.act(before, action.id);
      assert.equal(after.flags[`late-${plan.id}-assessed`], true);
      assert.equal(after.character!.lastActivityAge, after.age);
      assert.deepEqual(engine.act(engine.load(saved), action.id), after, "Reloading the same accepted action reproduces its result.");
      assert.deepEqual(engine.load(engine.save(after)), after);
      assert.deepEqual(engine.replay(after.seed, after.commands), after);
      const later = ageTo(engine, after, after.age + 1);
      assert.throws(() => engine.act(later, action.id), /unavailable/);
      assert.equal(after.character!.jobId, null);
      if (has(after, id)) {
        success ??= after;
        const record = after.accomplishments!.find(record => record.achievementId === id)!;
        assert.equal(record.kind, "ultimate");
        assert.equal(record.sourceId, action.id);
        assert.equal(record.outcomeId, `${id}-accepted`);
      } else failure ??= after;
    }
    assert.ok(success, `${plan.id}: success reachable`);
    assert.ok(failure, `${plan.id}: final assessment is not guaranteed`);
  }
});

test("a final assessment consumes only that route and the alternative mathematics specialization needs no astronomy", () => {
  const world = controlled();
  world.character!.skills.astronomy.initial = 0;
  const engine = createEngine(world);
  let life = ageTo(engine, engine.start("late-independent-geometry"), 18);
  life = engine.act(life, "complete-measured-plan");
  life = ageTo(engine, life, 24);
  life = complete(engine, life, "astronomy-calendar-geometrical-exposition");
  life = ageTo(engine, life, Math.max(30, life.age + 2));
  life = complete(engine, life, "astronomy-calendar-signature-work");
  life = ageTo(engine, life, Math.max(36, life.age + 3));
  life = engine.act(life, "undertake-astronomy-calendar-ultimate-title");
  assert.equal(life.character!.skills.astronomy, 0);
  assert.equal(has(life, "astronomy-calendar-first-work"), false, "Geometry never borrows an uncompleted seasonal table.");
  assert.equal(has(life, "astronomy-calendar-geometry-first-work"), true);
  assert.equal(life.flags["late-astronomy-calendar-assessed"], true);
  assert.equal(life.flags["late-philosophy-assessed"], false, "Separate career reviews do not spend another route's chance.");
  assert.equal(life.flags["legendary-final-candidature-resolved"], undefined, "The deferred shared legendary assessment is not installed by generic career titles.");
});
