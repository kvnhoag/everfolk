import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createEngine, getLegacyRoutes, matchesCondition } from "../src/index.ts";
import { contentFingerprint } from "../src/random.ts";
import type { CharacterActivity, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";
import { collectLegacyEntries } from "../client/storage/legacy-store.ts";
import { getArchivedBuiltinWorld } from "../server/content.ts";
import { getAccomplishmentPreviews } from "../client/models/choice-impact.ts";
import { buildHouseholdTitlePaths, householdProjectCooldown, isHouseholdTitleRoute } from "../client/models/household-title-paths.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.46.0.json" with { type: "json" };
import { withoutMarketSignals } from "./fixture-features.ts";

const hooks = registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith(".css")) return { format: "module", source: "export {};", shortCircuit: true };
  if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: new URL(url).pathname,
  }).outputText };
  return nextLoad(url, context);
} });
const { default: HouseholdTitlePaths } = await import("../client/components/HouseholdTitlePaths.tsx");
const { default: ChoiceImpact } = await import("../client/components/ChoiceImpact.tsx");
hooks.deregister();

const stages = ["first-service", "tested-project", "completed-duty", "title"] as const;
type Stage = (typeof stages)[number];
const plans = [
  { id: "royal-diplomacy", origin: "royal-household", audience: "royal", services: ["royal-send-envoys"], finalAge: 28 },
  { id: "royal-guardianship", origin: "royal-household", audience: "royal", services: ["royal-inspect-guard"], finalAge: 30 },
  { id: "royal-stewardship", origin: "royal-household", audience: "royal", services: ["royal-hold-council", "royal-plan-succession"], finalAge: 32 },
  { id: "estate-restoration", origin: "estate-household", audience: "aristocrat", services: ["aristocrat-improve-irrigation"], finalAge: 28 },
  { id: "estate-patronage", origin: "estate-household", audience: "aristocrat", services: ["aristocrat-settle-tenancy", "aristocrat-sponsor-festival"], finalAge: 28 },
  { id: "estate-inheritance", origin: "estate-household", audience: "aristocrat", services: ["aristocrat-plan-inheritance"], finalAge: 35 },
] as const;
type Plan = (typeof plans)[number];
const achievementId = (plan: Plan, stage: Stage) => `${plan.id}-${stage}`;
const activityId = (plan: Plan, stage: Stage) => `household-title-${plan.id}-${stage}`;
const has = (life: LifeState, id: string) => life.accomplishments!.some(record => record.achievementId === id);

/** Keep the shipped origins, action effects and project gates. Only unrelated
 * incidents and decay are suppressed; all progress still comes from commands. */
function fixture(origin: string, treasury?: number): WorldPack {
  const world = withoutMarketSignals(structuredClone(current) as WorldPack);
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = [];
  world.yearlyRules = world.yearlyRules!.filter(rule => plans.some(plan => rule.id === `${plan.id}-recognized-service`));
  delete world.knowledge;
  const required = [world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)];
  world.events = world.events.filter(event => required.includes(event.id));
  for (const definition of Object.values(world.character!.skills)) definition.initial = definition.max;
  for (const household of world.origins) {
    household.weight = household.id === origin ? 10_000 : 1;
    household.statRanges = Object.fromEntries(Object.entries(world.stats).map(([id, definition]) => [id, { min: definition.max, max: definition.max }]));
  }
  for (const management of [world.royalty!, world.aristocracy!]) {
    management.yearlyEffects = [];
    for (const [id, definition] of Object.entries(management.metrics)) definition.initial = id === "treasury" ? treasury ?? definition.max : definition.max;
  }
  return world;
}

function birthFor(engine: LifeEngine, origin: string, prefix: string): LifeState {
  for (let index = 0; index < 256; index++) {
    const life = engine.start(`${prefix}-${index}`);
    if (life.originId === origin) return life;
  }
  assert.fail(`The birth draw must reach ${origin}.`);
}

function settle(engine: LifeEngine, life: LifeState): LifeState {
  while (life.phase === "choice") {
    const choices = engine.getChoices(life);
    const choice = choices.find(choice => choice.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "end"))) ?? choices[0];
    assert.ok(choice, life.pendingEventId);
    life = engine.choose(life, choice.id);
  }
  return life;
}

function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  life = settle(engine, life);
  while (life.phase !== "ended" && life.age < target) life = settle(engine, engine.advance(life));
  assert.equal(life.age, target); assert.equal(life.phase, "ready");
  return life;
}

function listed(engine: LifeEngine, life: LifeState, id: string) {
  const result = engine.getActivities(life).find(activity => activity.id === id);
  assert.ok(result, `${id} must be listed for ${life.originId}.`);
  return result;
}

function prepared(engine: LifeEngine, plan: Plan, prefix: string): LifeState {
  let life = ageTo(engine, birthFor(engine, plan.origin, prefix), 16);
  for (const id of plan.services) {
    assert.ok(listed(engine, life, id).available, id);
    life = engine.act(life, id);
    life = ageTo(engine, life, life.age + 1);
  }
  return ageTo(engine, life, 18);
}

function earnStage(engine: LifeEngine, life: LifeState, plan: Plan, stage: Stage): LifeState {
  while (life.age <= 60 && !has(life, achievementId(plan, stage))) {
    const activity = listed(engine, life, activityId(plan, stage));
    if (activity.available) life = settle(engine, engine.act(life, activity.id));
    if (!has(life, achievementId(plan, stage))) life = ageTo(engine, life, life.age + 1);
  }
  assert.ok(has(life, achievementId(plan, stage)), `${plan.id}/${stage} must be reachable through actual commands.`);
  return life;
}

function earnedRoute(plan: Plan, prefix: string) {
  const engine = createEngine(fixture(plan.origin));
  let life = prepared(engine, plan, prefix);
  for (const stage of stages) {
    const route = getLegacyRoutes(engine.world, life).find(route => route.id === plan.id)!;
    assert.equal(route.next!.id, achievementId(plan, stage), "Route progress points to the next unearned duty.");
    if (stage === "title") {
      const id = activityId(plan, stage);
      life = nextAvailable(engine, life, id);
      const recognition = listed(engine, life, id);
      assert.ok(recognition.outcomes.every(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId(plan, stage))),
        "Completing the final requirements guarantees earned recognition.");
      life = engine.act(life, id);
      assert.ok(has(life, achievementId(plan, stage)));
    } else life = earnStage(engine, life, plan, stage);
  }
  return { engine, life };
}

function treasuryCost(activity: CharacterActivity): number {
  return Math.max(0, ...activity.outcomes.map(outcome => -outcome.effects.reduce((sum, effect) =>
    sum + ((effect.type === "royal" || effect.type === "aristocrat") && effect.metric === "treasury" ? effect.delta : 0), 0)));
}

function treasury(life: LifeState, plan: Plan): number {
  return plan.audience === "royal" ? life.royalty!.treasury : life.aristocracy!.treasury;
}

function nextAvailable(engine: LifeEngine, life: LifeState, id: string): LifeState {
  while (life.age <= 60 && !listed(engine, life, id).available) life = ageTo(engine, life, life.age + 1);
  assert.ok(listed(engine, life, id).available, `${id} should become available after its waiting period.`);
  return life;
}

test("high-born titles require completed household work rather than birth or high metrics", () => {
  for (const origin of ["royal-household", "estate-household"]) {
    const engine = createEngine(fixture(origin));
    const newborn = birthFor(engine, origin, `unearned-${origin}`);
    assert.equal(newborn.accomplishments!.length, 0);
    const adult = ageTo(engine, newborn, 40);
    for (const plan of plans.filter(plan => plan.origin === origin)) {
      for (const stage of stages) {
        const id = activityId(plan, stage);
        assert.equal(listed(engine, adult, id).available, false, id);
        assert.throws(() => engine.act(adult, id), /unavailable/i, id);
        assert.equal(has(adult, achievementId(plan, stage)), false);
      }
    }
    assert.equal(adult.accomplishments!.length, 0, "Class identity and decades of maximum metrics create no earned title.");
  }
});

test("title projects stay within their own household audience, including direct commands", () => {
  const common = current.origins.find(origin => !["royal-household", "estate-household"].includes(origin.id))!.id;
  for (const origin of [common, "royal-household", "estate-household"]) {
    const engine = createEngine(fixture(origin)), adult = ageTo(engine, birthFor(engine, origin, `isolation-${origin}`), 40);
    const ids = engine.getActivities(adult).map(activity => activity.id);
    for (const plan of plans) for (const stage of stages) {
      const id = activityId(plan, stage);
      assert.equal(ids.includes(id), origin === plan.origin, id);
      if (origin !== plan.origin) assert.throws(() => engine.act(adult, id), /unavailable|household|royal|aristocrat/i, id);
    }
  }
});

test("household service begins in adulthood and still uses the year's major activity", () => {
  for (const plan of plans) {
    const engine = createEngine(fixture(plan.origin));
    let life = ageTo(engine, birthFor(engine, plan.origin, `adult-service-${plan.id}`), 16);
    for (const [index, service] of plan.services.entries()) {
      life = engine.act(life, service);
      assert.equal(listed(engine, life, activityId(plan, "first-service")).available, false);
      if (index < plan.services.length - 1) life = ageTo(engine, life, life.age + 1);
    }
    assert.ok(life.age < 18);
    assert.equal(has(life, achievementId(plan, "first-service")), false);
    life = ageTo(engine, life, 18);
    assert.ok(listed(engine, life, activityId(plan, "first-service")).available, plan.id);
    const before = structuredClone(life);
    const after = engine.act(life, activityId(plan, "first-service"));
    assert.deepEqual(life, before, "Accepting service keeps the previous snapshot immutable.");
    assert.throws(() => engine.act(after, plan.services[0]), /year|activity/i);
  }
});

test("all six household titles are earned through dated projects and preserve the full record", () => {
  for (const plan of plans) {
    const { engine, life } = earnedRoute(plan, `earned-${plan.id}`);
    const records = life.accomplishments!.filter(record => record.routeId === plan.id);
    assert.deepEqual(records.map(record => record.achievementId), stages.map(stage => achievementId(plan, stage)), plan.id);
    assert.ok(records[0].age >= 18);
    assert.ok(records[1].age - records[0].age >= 1);
    assert.ok(records[2].age - records[1].age >= 2);
    assert.ok(records[3].age - records[2].age >= 2);
    assert.ok(records[3].age >= plan.finalAge, "Recognition follows years of adult responsibility.");
    for (const [index, record] of records.entries()) {
      assert.equal(record.sourceId, activityId(plan, stages[index]));
      assert.ok(life.commands.some(command => command.type === "act" && command.activity === record.sourceId));
      assert.ok(life.journal.some(entry => entry.id === record.outcomeId));
      assert.ok(record.name.includes(life.character!.name!));
    }
    const route = getLegacyRoutes(engine.world, life).find(route => route.id === plan.id)!;
    assert.equal(route.next, undefined); assert.equal(route.earned.length, 4);
    const collection = collectLegacyEntries(engine.world, life, []);
    assert.equal(collection.filter(entry => entry.accomplishment.routeId === plan.id).length, 4);
    assert.equal(collection.find(entry => entry.accomplishment.achievementId === achievementId(plan, "title"))!.accomplishment.kind, "ultimate");
    assert.deepEqual(collectLegacyEntries(engine.world, life, collection), collection, "Collecting a completed title twice creates no duplicates.");
    assert.deepEqual(engine.replay(life.seed, life.commands), life);
    assert.deepEqual(engine.load(engine.save(life)), life);
    const later = ageTo(engine, life, life.age + 1);
    assert.equal(treasury(later, plan) - treasury(life, plan), 5, "Earned recognition adds five drachmas in annual household receipts.");
    assert.equal(treasury(ageTo(engine, later, later.age + 1), plan) - treasury(later, plan), 5, "The title benefit recurs each year.");
    assert.equal(listed(engine, later, activityId(plan, "title")).available, false, "Earned recognition cannot be repeated.");
    assert.throws(() => engine.act(later, activityId(plan, "title")), /unavailable/i);
  }
});

test("a new earned project cannot skip the waiting period or spend two annual actions", () => {
  for (const plan of plans) {
    const engine = createEngine(fixture(plan.origin));
    let life = prepared(engine, plan, `dated-${plan.id}`);
    const first = activityId(plan, "first-service"), second = activityId(plan, "tested-project");
    life = earnStage(engine, life, plan, "first-service");
    assert.equal(listed(engine, life, second).available, false);
    assert.equal(matchesCondition(engine.world.character!.activities.find(activity => activity.id === second)!.when, life), false,
      "The proof must age for a year independently of the annual action gate.");
    assert.throws(() => engine.act(life, second), /year|activity/i);
    const next = ageTo(engine, life, life.age + 1);
    assert.equal(listed(engine, next, first).available, false, "Completed first service cannot be farmed.");
    assert.throws(() => engine.act(next, first), /unavailable/i);
    assert.equal(listed(engine, next, activityId(plan, "completed-duty")).available, false, "Elapsed time cannot substitute for the intermediate project.");
    assert.equal(listed(engine, next, activityId(plan, "title")).available, false);
  }
});

test("projects spend their household treasury and cannot proceed with a depleted project budget", () => {
  for (const plan of plans) {
    const world = fixture(plan.origin), definitions = world.character!.activities;
    const first = definitions.find(activity => activity.id === activityId(plan, "first-service"))!;
    const tested = definitions.find(activity => activity.id === activityId(plan, "tested-project"))!;
    assert.ok(first); assert.ok(tested);
    const projectCost = treasuryCost(tested);
    assert.ok(projectCost > 0, `${plan.id} has a funded project rather than free recognition.`);
    const serviceCost = plan.services.reduce((sum, id) => sum + treasuryCost(definitions.find(activity => activity.id === id)!), 0);
    const poorEngine = createEngine(fixture(plan.origin, serviceCost + treasuryCost(first) + projectCost - 1));
    let poor = prepared(poorEngine, plan, `unfunded-${plan.id}`);
    poor = earnStage(poorEngine, poor, plan, "first-service");
    poor = ageTo(poorEngine, poor, poor.age + 2);
    assert.ok(treasury(poor, plan) < projectCost);
    assert.equal(listed(poorEngine, poor, tested.id).available, false, "Earlier service does not provide credit for an unfunded project.");
    const snapshot = structuredClone(poor);
    assert.throws(() => poorEngine.act(poor, tested.id), /unavailable|treasury|fund/i);
    assert.deepEqual(poor, snapshot);

    const engine = createEngine(world);
    let funded = earnStage(engine, prepared(engine, plan, `funded-${plan.id}`), plan, "first-service");
    funded = nextAvailable(engine, funded, tested.id);
    const after = engine.act(funded, tested.id);
    assert.equal(treasury(after, plan), treasury(funded, plan) - projectCost);
    assert.deepEqual(after.economy, funded.economy, "Estate and royal projects spend management funds, not the ordinary household ledger.");
  }
});

test("unsuccessful projects retain earlier work, award nothing and require the authored retry delay", () => {
  for (const plan of plans) {
    const engine = createEngine(fixture(plan.origin));
    const id = activityId(plan, "tested-project");
    let failed: { before: LifeState; after: LifeState } | undefined;
    for (let seed = 0; seed < 64 && !failed; seed++) {
      let before = earnStage(engine, prepared(engine, plan, `failed-project-${plan.id}-${seed}`), plan, "first-service");
      before = nextAvailable(engine, before, id);
      const after = engine.act(before, id);
      if (!has(after, achievementId(plan, "tested-project"))) failed = { before, after };
    }
    assert.ok(failed, `${plan.id} must retain a genuine unsuccessful project outcome.`);
    assert.ok(has(failed.after, achievementId(plan, "first-service")));
    assert.deepEqual(failed.after.accomplishments, failed.before.accomplishments);
    assert.ok(treasury(failed.after, plan) < treasury(failed.before, plan), "An unsuccessful attempt still spends its project funds.");
    const oneYear = ageTo(engine, failed.after, failed.after.age + 1);
    assert.equal(listed(engine, oneYear, id).available, false);
    assert.match(listed(engine, oneYear, id).reason!, /again|age/i);
    assert.throws(() => engine.act(oneYear, id), /unavailable|again/i);
    assert.equal(listed(engine, oneYear, activityId(plan, "completed-duty")).available, false);
    assert.equal(listed(engine, oneYear, activityId(plan, "title")).available, false);
    const twoYears = ageTo(engine, oneYear, oneYear.age + 1);
    assert.ok(listed(engine, twoYears, id).available, "Retrying becomes possible two years after the failed attempt.");
    assert.deepEqual(engine.replay(failed.after.seed, failed.after.commands), failed.after);
    assert.deepEqual(engine.load(engine.save(failed.after)), failed.after);
  }
});

test("household paths project the three class routes and render actual completed-work counts without mutation", () => {
  for (const plan of [plans[0], plans[3]]) {
    const engine = createEngine(fixture(plan.origin));
    let life = prepared(engine, plan, `path-view-${plan.id}`);
    let activities = engine.getActivities(life);
    const snapshot = JSON.stringify({ world: engine.world, life, activities });
    const paths = buildHouseholdTitlePaths(engine.world, life, activities);
    assert.deepEqual(paths.map(path => path.id), plans.filter(item => item.origin === plan.origin).map(item => item.id));
    assert.ok(paths.every(path => isHouseholdTitleRoute(path) && path.steps.length === 4 && path.completed === 0));
    const path = paths.find(path => path.id === plan.id)!;
    assert.equal(path.next!.achievement.id, achievementId(plan, "first-service"));
    assert.equal(path.next!.state, "ready");
    const initialHtml = renderToStaticMarkup(createElement(HouseholdTitlePaths, {
      world: engine.world, life, activities, onActivity() { assert.fail("Rendering cannot act."); },
    }));
    assert.match(initialHtml, /Service &amp; titles/);
    assert.match(initialHtml, /0 \/ 4 completed/);
    assert.match(initialHtml, /this year’s major activity/);
    assert.match(initialHtml, /adds 5 drachmas/);
    assert.equal(JSON.stringify({ world: engine.world, life, activities }), snapshot);

    life = engine.act(life, activityId(plan, "first-service"));
    activities = engine.getActivities(life);
    const progressed = buildHouseholdTitlePaths(engine.world, life, activities).find(path => path.id === plan.id)!;
    assert.equal(progressed.completed, 1);
    assert.equal(progressed.steps[0].state, "earned");
    assert.equal(progressed.next!.achievement.id, achievementId(plan, "tested-project"));
    const progressedHtml = renderToStaticMarkup(createElement(HouseholdTitlePaths, {
      world: engine.world, life, activities, onActivity() { assert.fail("Rendering cannot act."); },
    }));
    assert.match(progressedHtml, /1 \/ 4 completed/);
    assert.match(progressedHtml, /Project cooldown: 2 years/);
    assert.match(progressedHtml, /completed 1\+ years ago/);
    assert.match(progressedHtml, /Age 20\+/);

    const completed = earnedRoute(plan, `complete-view-${plan.id}`);
    const completedPath = buildHouseholdTitlePaths(completed.engine.world, completed.life, completed.engine.getActivities(completed.life)).find(path => path.id === plan.id)!;
    assert.equal(completedPath.completed, 4); assert.equal(completedPath.next, undefined);
    assert.equal(completedPath.titleNode!.state, "earned");
    const completedHtml = renderToStaticMarkup(createElement(HouseholdTitlePaths, {
      world: completed.engine.world, life: completed.life, activities: completed.engine.getActivities(completed.life), onActivity() { assert.fail("Rendering cannot act."); },
    }));
    assert.match(completedHtml, /Title earned/);
    assert.match(completedHtml, /Its card is recorded in your collection/);
  }
  const common = current.origins.find(origin => !["royal-household", "estate-household"].includes(origin.id))!.id;
  const engine = createEngine(fixture(common)), life = birthFor(engine, common, "common-path-view");
  assert.deepEqual(buildHouseholdTitlePaths(engine.world, life, engine.getActivities(life)), []);
  assert.equal(renderToStaticMarkup(createElement(HouseholdTitlePaths, { world: engine.world, life, activities: engine.getActivities(life), onActivity() {} })), "");
  assert.equal(isHouseholdTitleRoute({ id: "sculpture" }), false);
});

test("card previews use current conditional odds, distinguish guaranteed recognition and omit earned cards", () => {
  const plan = plans[0];
  for (const [initialInfluence, expectedProbability] of [[60, .75], [100, 9 / 11]]) {
    const world = fixture(plan.origin);
    world.royalty!.metrics.influence.initial = initialInfluence;
    const engine = createEngine(world);
    let life = earnStage(engine, prepared(engine, plan, `card-preview-${initialInfluence}`), plan, "first-service");
    life = nextAvailable(engine, life, activityId(plan, "tested-project"));
    const project = listed(engine, life, activityId(plan, "tested-project"));
    const before = JSON.stringify({ world: engine.world, life, project });
    const previews = getAccomplishmentPreviews(project, life, engine.world);
    assert.equal(previews.length, 1);
    assert.equal(previews[0].id, achievementId(plan, "tested-project"));
    assert.ok(Math.abs(previews[0].probability - expectedProbability) < 1e-12, "Stronger influence changes the accepted-work odds.");
    const html = renderToStaticMarkup(createElement(ChoiceImpact, { world: engine.world, life, choice: project }));
    assert.match(html, /Work card:/);
    assert.ok(html.includes(`${Number((expectedProbability * 100).toPrecision(3))}% chance`));
    assert.equal(JSON.stringify({ world: engine.world, life, project }), before, "Reading reward previews cannot consume RNG or award a card.");
    assert.deepEqual(getAccomplishmentPreviews(listed(engine, life, activityId(plan, "first-service")), life, engine.world), []);
    assert.match(householdProjectCooldown(project, life), /Uses this year’s major activity\. Project cooldown: 2 years\./);
  }
  const { engine, life } = earnedRoute(plan, "guaranteed-title-preview");
  const title = engine.world.character!.activities.find(activity => activity.id === activityId(plan, "title"))!;
  const precedingCommand = life.commands.slice(0, -1);
  const beforeRecognition = engine.replay(life.seed, precedingCommand);
  const preview = getAccomplishmentPreviews(title, beforeRecognition, engine.world);
  assert.equal(preview[0].kind, "ultimate"); assert.equal(preview[0].probability, 1);
  const html = renderToStaticMarkup(createElement(ChoiceImpact, { world: engine.world, life: beforeRecognition, choice: title }));
  assert.match(html, /Title card: Ambassador of the House/);
  assert.match(html, /Awarded on acceptance/);
  assert.deepEqual(getAccomplishmentPreviews(title, life, engine.world), []);
});

test("the retained title pack keeps its exact replay and remains registered on client and server", () => {
  const engine = createEngine(retained);
  const life = engine.advance(engine.start("retained-pre-household-title-route"));
  assert.equal(engine.world.version, "0.46.0");
  assert.equal(engine.world.legacy!.routes.some(route => plans.some(plan => plan.id === route.id)), false);
  assert.equal(engineForLife(life).fingerprint, engine.fingerprint);
  assert.deepEqual(loadAnyLife(engine.save(life)), life);
  const archived = getArchivedBuiltinWorld(`pack-${contentFingerprint(retained)}`)!;
  assert.ok(archived); assert.deepEqual(archived.pack, retained);
  assert.notEqual(createEngine(current).fingerprint, engine.fingerprint);
});
