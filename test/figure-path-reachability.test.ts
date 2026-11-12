import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { buildFigurePathWorld } from "../src/figures/world.ts";
import { getFigurePaths } from "../src/figures/progress.ts";
import { figureFixture } from "./helpers/figure-path-fixture.ts";
import type { Condition, LifeState, WorldPack } from "../src/types.ts";
import base from "../worlds/demo/alexandria-deep-1.json" with { type: "json" };

// Mechanical reachability fixtures: resources/health/proficiency are authored,
// while every encounter, learned capability, work year and title must be earned.
function fixture(options: { skill?: number; seed?: string; configure?: (world: WorldPack) => void } = {}) {
  const world = buildFigurePathWorld(base as unknown as WorldPack);
  delete world.knowledge; delete world.demo!.startingResources; delete world.health!.mortalityCalibration;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  const interrupts = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(event => interrupts.has(event.id));
  world.yearlyEffects = []; world.yearlyRules = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = options.skill ?? 100;
  world.stats.health.initial = 100; world.stats.knowledge.initial = 80; world.stats.bonds.initial = 80;
  world.stats.wealth.max = 100000; world.stats.wealth.initial = 100000 / world.economy!.unitsPerPoint;
  world.demo!.household.startingGrain = 1000000; world.demo!.household.storeCapacity = 1000000;
  world.demo!.household.spoilageBps = 0;
  world.origins = [{ id: "figure-route-fixture", title: "Route fixture", text: "Explicit test resources; actual work still required.", weight: 1, effects: [] }];
  options.configure?.(world);
  const engine = createEngine(world);
  let life = engine.start(options.seed ?? "figure-route-reachability");
  const ready = () => { while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id); assert.notEqual(life.phase, "ended"); };
  const next = () => { life = engine.advance(life); ready(); };
  const atAge = (age: number) => { while (life.age < age) next(); assert.equal(life.age, age); };
  const act = (id: string) => { life = engine.act(life, id); ready(); };
  const freeWorkYear = () => { if (life.vocations!.workedAge === life.age || life.character!.lastActivityAge === life.age) next(); };
  const work = (id: string) => { freeWorkYear(); act(id); };
  const capWork = (id: string) => work("v-cap-" + id.toLowerCase());
  const path = (id: string) => { const result = getFigurePaths(world, life).find(path => path.definition.id === id)!; assert.ok(result, "Missing path " + id); return result; };
  const durable = () => { assert.deepEqual(engine.load(engine.save(life)), life); assert.deepEqual(engine.replay(life.seed, life.commands), life); };
  return { world, engine, next, atAge, act, work, freeWorkYear, capWork, path, durable, get life() { return life; } };
}
type Route = ReturnType<typeof fixture>;
function phiIntroduction(run: Route) {
  run.atAge(12);
  for (const id of ["guided-reading", "argument-exercise"]) run.capWork(id);
  assert.ok(run.life.deepCapabilities!.learned.P2);
}

test("Alexander's living encounter is reachable at 18 without royal birth or the age-28 General job", () => {
  const run = fixture({ skill: 35, seed: "young-alexander-route" });
  run.atAge(18);
  const path = run.path("alexander");
  assert.equal(path.directAvailable, true);
  assert.notEqual(run.life.character!.jobId, "general");
  assert.notEqual(run.life.originId, "royal-household");
  assert.equal(run.life.deepCapabilities!.learned.PS10, undefined);
  run.act(path.definition.encounter.activityId);
  assert.equal(run.path("alexander").encounterMode, "direct");
  assert.equal(run.path("alexander").encounterRecord!.age, 18);
  run.durable();
});

test("Aristotle's Lyceum entry is reachable at 18 with moderate skills and actual foundation work", () => {
  const run = fixture({ skill: 35, seed: "young-aristotle-route" });
  phiIntroduction(run); run.atAge(18);
  assert.equal(run.life.deepCapabilities!.learned.PS10, undefined);
  assert.equal(run.life.deepCapabilities!.learned.PS9, undefined);
  const path = run.path("aristotle");
  assert.equal(path.directAvailable, true);
  run.act(path.definition.encounter.activityId);
  assert.equal(run.path("aristotle").encounterMode, "direct");
  assert.equal(run.path("aristotle").encounterRecord!.age, 18);
  run.durable();
});

test("expired direct encounters reject atomically while later study is labelled a tradition", () => {
  const run = fixture();
  phiIntroduction(run); run.atAge(16);
  run.act("v-buy-clay"); run.act("v-buy-papyrus"); run.act("v-buy-ink");
  run.capWork("cost-basket"); run.atAge(30);
  for (const id of ["alexander", "aristotle", "cleomenes"]) {
    const path = run.path(id);
    assert.equal(path.directAvailable, false);
    const before = JSON.stringify(run.life);
    assert.throws(() => run.act(path.definition.encounter.activityId), /unavailable|require|condition|year|age/i);
    assert.equal(JSON.stringify(run.life), before);
    assert.ok(path.definition.tradition, "Missing mediated later route for " + id);
    run.work(path.definition.tradition!.activityId);
    assert.equal(run.path(id).encounterMode, "tradition");
  }
  run.durable();
});


type FullRoute = ReturnType<typeof figureFixture>;
function workGates(condition: Condition | undefined): { action: string; count: number }[] {
  if (!condition) return [];
  if (condition.type === "vocation") return [{ action: condition.action, count: condition.count }];
  if (condition.type === "all" || condition.type === "any") return condition.conditions.flatMap(workGates);
  return [];
}
function performRequiredWork(run: FullRoute, activityId: string) {
  const activity = run.world.character!.activities.find(activity => activity.id === activityId)!;
  assert.ok(activity, activityId);
  for (const { action, count } of workGates(activity.when)) {
    while ((run.life.vocations!.completed[action] ?? 0) < count) {
      run.fundWork(action); run.yearly(run.workActivity(action).id);
    }
  }
}
function completeLegacy(run: FullRoute, id: string, enter = true, expectedSuccess = true) {
  const path = run.path(id);
  if (enter) {
    run.advanceTo(Math.max(18, path.encounter.fromYear - run.world.startYear));
    run.yearly(path.encounter.activityId);
  }
  assert.equal(run.progress(id).associationRank, null);
  assert.equal(run.progress(id).specialTitle, null);
  for (const stage of path.stages) {
    const before = JSON.stringify(run.life);
    assert.throws(() => run.act(stage.activityId), /unavailable|require|condition|year|work/i);
    assert.equal(JSON.stringify(run.life), before);
    performRequiredWork(run, stage.activityId);
    run.act(stage.activityId);
    assert.equal(run.progress(id).associationRank, stage.rank);
    assert.equal(run.progress(id).specialTitle, null);
  }
  performRequiredWork(run, path.capstone.activityId);
  run.act(path.capstone.activityId);
  assert.equal(Boolean(run.progress(id).specialTitle), expectedSuccess);
  if (expectedSuccess) assert.equal(run.progress(id).specialTitle!.rank, path.baseRank);
  assert.equal(run.progress(id).principalRank, path.baseRank);
  return path;
}
function civicProgramme(run: FullRoute) {
  run.researchFoundation();
  for (const action of ["public-address", "public-address", "negotiate-agreement", "negotiate-agreement", "public-budget", "public-service", "coalition-agreement", "coalition-agreement", "policy-project", "policy-project"]) run.cap(action);
  assert.ok(run.life.deepCapabilities!.learned.PP9);
}
function buyCargo(run: FullRoute) {
  if (run.life.character!.lastActivityAge === run.life.age || run.life.vocations!.workedAge === run.life.age) run.next();
  run.demo({ type: "trade", side: "buy", item: "grain", quantity: 20, counterparty: "merchant" });
}
function tradeProgramme(run: FullRoute) {
  run.sculptureFoundation();
  run.act("v-buy-papyrus"); run.act("v-buy-ink");
  run.cap("cost-basket");
  assert.ok(run.life.deepCapabilities!.learned.T2);
  run.advanceTo(18);
  // The living official is met before later work continues in the revenue tradition.
  run.yearly(run.path("cleomenes").encounter.activityId);
  for (const action of ["price-comparison", "price-comparison", "stock-reconciliation", "stock-reconciliation"]) run.cap(action);
  for (const action of ["supply-plan", "supply-plan", "delivery-order", "delivery-order"]) { buyCargo(run); run.cap(action); }
  assert.ok(run.life.deepCapabilities!.learned.T7);
  for (let year = 0; year < 2; year++) {
    run.next(); run.act("v-sell-clay-model"); run.cap("trading-year");
  }
  for (let year = 0; year < 2; year++) { buyCargo(run); run.cap("enterprise-contract"); }
  assert.ok(run.life.deepCapabilities!.learned.T9);
}
function biasCapstone(world: WorldPack, id: string, success: boolean) {
  const path = world.figurePaths!.find(path => path.id === id)!;
  const activity = world.character!.activities.find(activity => activity.id === path.capstone.activityId)!;
  for (const outcome of activity.outcomes) {
    const grants = outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === path.capstone.achievementId);
    outcome.weight = grants === success ? 1000000000 : 1;
  }
}
function biasPromotion(world: WorldPack, success: boolean) {
  for (const path of world.figurePaths ?? []) if (path.promotion) {
    const activity = world.character!.activities.find(activity => activity.id === path.promotion!.activityId)!;
    for (const outcome of activity.outcomes) {
      const grantsPromotion = outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === path.promotion!.achievementId);
      outcome.weight = grantsPromotion === success ? 1000000000 : 1;
    }
  }
}
function conditionalFixture(id: "demetrius" | "ptolemy" | "zeno", success: boolean) {
  const run = figureFixture(id + (success ? "-resolved-success" : "-resolved-failure"), 12, world => biasPromotion(world, success));
  if (id === "demetrius") run.sculptureMastery();
  if (id === "ptolemy") civicProgramme(run);
  if (id === "zeno") {
    run.researchMastery(); run.cap("public-address"); run.cap("public-address");
  }
  const path = completeLegacy(run, id);
  assert.equal(run.progress(id).promoted, false);
  assert.equal(run.progress(id).principalRank, "Epic");
  const promotion = path.promotion!;
  // Neither completed ordinary work nor the calendar alone promotes the figure.
  if (id === "ptolemy") run.advanceTo(45);
  if (id === "demetrius") run.advanceTo(45);
  if (id !== "demetrius") performRequiredWork(run, promotion.activityId);
  run.act(promotion.activityId);
  assert.equal(run.progress(id).promoted, success);
  assert.equal(run.progress(id).principalRank, success ? "Legendary" : "Epic");
  assert.equal(run.progress(id).specialTitle!.rank, success ? "Legendary" : "Epic");
  assert.equal(run.progress(id).alternateHistory, success && id === "demetrius");
  assert.equal(run.life.accomplishments!.some(record => record.achievementId === promotion.achievementId), success);
  const before = JSON.stringify(run.life);
  assert.throws(() => run.act(promotion.activityId), /unavailable|require|condition|already/i);
  assert.equal(JSON.stringify(run.life), before);
  run.durable();
  return run;
}

test("Alexander's actual campaign work earns three contribution ranks and a separate Legendary legacy", () => {
  const run = figureFixture("complete-alexander", 18, world => biasCapstone(world, "alexander", true));
  completeLegacy(run, "alexander");
  assert.ok(run.life.age <= 27);
  assert.equal(run.progress("alexander").principalTitle, "Alexander the Great");
  assert.equal(run.progress("alexander").specialTitle!.rank, "Legendary");
  run.durable();
});

test("a failed strategic campaign cannot award Alexander's player legacy or be retried", () => {
  const run = figureFixture("failed-alexander", 18, world => biasCapstone(world, "alexander", false));
  const path = completeLegacy(run, "alexander", true, false);
  assert.equal(run.progress("alexander").principalRank, "Legendary");
  assert.equal(run.progress("alexander").specialTitle, null);
  assert.equal(run.progress("alexander").associationRank, "Epic");
  const before = JSON.stringify(run.life);
  assert.throws(() => run.act(path.capstone.activityId), /unavailable|require|condition|already/i);
  assert.equal(JSON.stringify(run.life), before);
  run.durable();
});

test("Pytheas's actual funded voyage records earn Epic without inventing a Legendary or exact Thule discovery", () => {
  const run = figureFixture("complete-pytheas", 18);
  completeLegacy(run, "pytheas");
  assert.equal(run.progress("pytheas").specialTitle!.rank, "Epic");
  assert.equal(run.life.deepCapabilities!.learned.PS10, undefined);
  assert.match(run.path("pytheas").summary, /uncertain|lost|Thule/i);
  run.durable();
});

test("Menander's actual writing, rehearsal and staging work earns the Legendary dramatic legacy", () => {
  const run = figureFixture("complete-menander", 18);
  completeLegacy(run, "menander");
  assert.equal(run.progress("menander").specialTitle!.rank, "Legendary");
  assert.equal(run.life.deepCapabilities!.learned.PP10, undefined);
  assert.equal(run.life.deepCapabilities!.learned.PS10, undefined);
  assert.match(run.path("menander").summary, /write|rehearse|comedy/i);
  run.durable();
});

test("Cleomenes's living contact and actual audited supply programme earn the fixed Epic legacy", () => {
  const run = figureFixture("complete-cleomenes");
  tradeProgramme(run);
  completeLegacy(run, "cleomenes", false);
  assert.equal(run.progress("cleomenes").specialTitle!.rank, "Epic");
  assert.equal(run.progress("cleomenes").promoted, false);
  assert.equal(run.path("cleomenes").promotion, undefined);
  assert.ok(run.progress("cleomenes").encounterRecord!.year <= -323);
  run.durable();
});

for (const id of ["demetrius", "ptolemy", "zeno"] as const) for (const success of [true, false]) {
  test(id + (success ? " reaches Legendary after its successful" : " stays Epic after its failed") + " one-shot founding/capture outcome", () => {
    const run = conditionalFixture(id, success);
    if (id === "demetrius") {
      const record = run.life.accomplishments!.find(record => record.achievementId === "fig-demetrius-promotion-attempt")!;
      assert.ok(record.year >= -305 && record.year <= -304);
    }
    if (id === "ptolemy") {
      const record = run.life.accomplishments!.find(record => record.achievementId === "fig-ptolemy-promotion-attempt")!;
      assert.ok(record.year >= -305 && record.year <= -304);
    }
    if (id === "zeno") assert.equal(run.progress(id).provisionalPromotion, true);
  });
}
