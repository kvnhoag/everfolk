import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, getLegacyRoutes, matchesCondition, validateWorld } from "../src/index.ts";
import type { Choice, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.44.0.json" with { type: "json" };
import previousEstates from "../worlds/alexandria-0.45.0.json" with { type: "json" };
import previousTitles from "../worlds/alexandria-0.46.0.json" with { type: "json" };
import { historicalTitlePlans } from "../scripts/alexandria-historical-titles.mjs";
import { withoutMarketSignals } from "./fixture-features.ts";
import { contentFingerprint } from "../src/random.ts";
import { getArchivedBuiltinWorld } from "../server/content.ts";
import { engineForLife, loadAnyLife } from "../client/lib/world-session.ts";

type Plan = (typeof historicalTitlePlans)[number];
const awards = (choice: Choice, id: string) => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === id));
const has = (life: LifeState, id: string) => life.accomplishments!.some(record => record.achievementId === id);
const lastYear = (plan: Plan) => plan.untilYear ?? current.startYear + 90;

/** Remove unrelated annual incidents, not the accepted-choice requirements. */
function fixture(plan: Plan): WorldPack {
  const world = withoutMarketSignals(structuredClone(current) as WorldPack);
  if (world.royalty) world.royalty.originId = "fixture-unselected-royal-origin";
  if (world.aristocracy) world.aristocracy.originId = "fixture-unselected-estate-origin";
  delete world.health!.mortalityCalibration;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.yearlyEffects = []; world.yearlyRules = []; delete world.knowledge;
  const required = [world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)];
  world.events = world.events.filter(event => required.includes(event.id) || event.id.startsWith(`historical-${plan.id}-`));
  for (const origin of world.origins) {
    origin.effects = [];
    origin.statRanges = Object.fromEntries(Object.keys(world.stats).map(id => [id, { min: 80, max: 80 }]));
    delete origin.assetRanges;
  }
  for (const asset of world.economy!.assets) asset.initialRange = { min: 0, max: 0 };
  for (const definition of Object.values(world.character!.skills)) definition.initial = 100;
  return world;
}

function reachFinal(engine: LifeEngine, plan: Plan, seed: string): LifeState | undefined {
  let life = engine.start(seed);
  for (let guard = 0; guard < 250 && life.phase !== "ended" && life.year <= lastYear(plan); guard++) {
    if (life.phase === "ready") { life = engine.advance(life); continue; }
    const choices = engine.getChoices(life);
    if (choices.some(choice => awards(choice, plan.id))) return life;
    const attempt = choices.find(choice => choice.id.startsWith(`attempt-${plan.id}-`));
    assert.ok(attempt, `Expected an available ${plan.id} task at ${life.pendingEventId}.`);
    life = engine.choose(life, attempt.id);
  }
  return undefined;
}

function acceptedTitle(engine: LifeEngine, plan: Plan): { before: LifeState; after: LifeState } {
  for (let seed = 0; seed < 64; seed++) {
    const before = reachFinal(engine, plan, `title-${plan.id}-${seed}`);
    if (!before) continue;
    const choice = engine.getChoices(before).find(choice => awards(choice, plan.id))!;
    const after = engine.choose(before, choice.id);
    if (has(after, plan.id)) return { before, after };
  }
  assert.fail(`No accepted ${plan.id} title found within the bounded deterministic seed sample.`);
}

test("historical cards cover seven figures with distinct earned affiliation titles and real story chains", () => {
  const world = current as WorldPack;
  validateWorld(world);
  assert.equal(new Set(historicalTitlePlans.map(plan => plan.figure.id)).size, 7);
  assert.ok(historicalTitlePlans.some(plan => plan.id === "right-hand-of-alexander"));
  assert.ok(historicalTitlePlans.some(plan => plan.id === "general-of-alexander"));
  const commonRoutes = world.legacy!.routes.filter(route => previous.legacy.routes.some(item => item.id === route.id));
  assert.equal(commonRoutes.length, previous.legacy.routes.length, "Affiliations extend the seven existing careers; household titles have separate routes.");
  for (const plan of historicalTitlePlans) {
    const title = world.legacy!.achievements.find(item => item.id === plan.id)!;
    assert.ok(title, plan.id);
    assert.equal(title.kind, "prestige");
    assert.deepEqual(title.figure, plan.figure);
    assert.ok(plan.steps.length >= 3, `${plan.id} needs completed tasks before recognition.`);
    const events = world.events.filter(event => event.id.startsWith(`historical-${plan.id}-`));
    assert.equal(events.length, plan.steps.length, plan.id);
    assert.ok(events.every(event => event.trigger.type === "year" && event.evidence === "fictional"));
    assert.ok(events.every(event => event.choices.some(choice => !awards(choice, title.id))), "Every story offers a refusal.");
  }
  assert.equal(previous.legacy.achievements.some(item => Object.hasOwn(item, "figure")), false);
  assert.equal(previous.events.some(event => event.id.startsWith("historical-")), false, "The retained world keeps its original content.");
});

test("every historical title is reachable through accepted, dated tasks and survives exact replay", () => {
  for (const plan of historicalTitlePlans) {
    const engine = createEngine(fixture(plan));
    const { before, after } = acceptedTitle(engine, plan);
    assert.equal(has(before, plan.id), false);
    const finalEvent = engine.world.events.find(event => event.id === before.pendingEventId)!;
    const finalChoice = engine.getChoices(before).find(choice => awards(choice, plan.id))!;
    const unprepared = structuredClone(before);
    for (const skill of Object.keys(unprepared.character!.skills)) unprepared.character!.skills[skill] = 0;
    assert.equal(matchesCondition(finalEvent.when, unprepared) && matchesCondition(finalChoice.when, unprepared), false,
      "Earlier duties cannot bypass the recognition's current skill requirements.");
    const record = after.accomplishments!.find(item => item.achievementId === plan.id)!;
    assert.deepEqual(record.figure, plan.figure);
    assert.ok(record.name.startsWith(after.character!.name!), "The player retains ownership and identity on the title card.");
    assert.ok(record.year >= plan.fromYear && (plan.untilYear === undefined || record.year <= plan.untilYear), plan.id);
    assert.equal(record.sourceId, before.pendingEventId);
    assert.ok(after.journal.some(entry => entry.id === record.outcomeId));
    const milestones = after.accomplishments!.filter(item => item.figure?.id === plan.figure.id);
    assert.equal(milestones.length, plan.steps.length, plan.id);
    for (let i = 1; i < milestones.length; i++) assert.ok(milestones[i].age > milestones[i - 1].age, `${plan.id} must record sustained work, not one encounter.`);
    assert.equal(new Set(milestones.map(item => item.achievementId)).size, milestones.length);
    const career = getLegacyRoutes(engine.world, after).find(route => route.id === plan.routeId)!;
    assert.equal(career.next!.id, career.achievementIds[0], "Historical duties do not substitute for an unrelated career's first work.");
    assert.deepEqual(engine.replay(after.seed, after.commands), after);
    assert.deepEqual(engine.load(engine.save(after)), after);
  }
});

test("maximum skills cannot substitute for completed work or reopen service contact windows", () => {
  for (const plan of historicalTitlePlans) {
    const engine = createEngine(fixture(plan));
    const newborn = engine.start(`unearned-${plan.id}`);
    const final = engine.world.events.find(event => event.choices.some(choice => awards(choice, plan.id)))!;
    const eligibleAge = Math.max(plan.minAge, plan.fromYear - engine.world.startYear);
    const unearned = { ...newborn, age: eligibleAge, year: engine.world.startYear + eligibleAge };
    assert.equal(matchesCondition(final.when, unearned), false, `${plan.id}: skills alone cannot award recognition.`);
    assert.equal(has(unearned, plan.id), false);
    const first = engine.world.events.find(event => event.id === `historical-${plan.id}-${plan.steps[0].id}`)!;
    assert.equal(matchesCondition(first.when, { ...unearned, year: plan.fromYear - 1 }), false, `${plan.id}: no early contact.`);
    if (plan.untilYear !== undefined) {
      assert.equal(matchesCondition(first.when, { ...unearned, age: plan.untilYear - engine.world.startYear + 1, year: plan.untilYear + 1 }), false, `${plan.id}: no late contact.`);
    } else {
      assert.equal(matchesCondition(first.when, { ...unearned, age: 70, year: -280 }), true, `${plan.id}: independent study stays open after the figure's teaching window.`);
    }
  }
});

test("declining an invitation closes its chain and never creates a title card", () => {
  for (const plan of historicalTitlePlans) {
    const engine = createEngine(fixture(plan));
    let life = engine.start(`decline-${plan.id}`);
    while (life.phase === "ready" && life.year <= lastYear(plan)) life = engine.advance(life);
    assert.equal(life.phase, "choice", plan.id);
    const decline = engine.getChoices(life).find(choice => choice.id.startsWith(`decline-${plan.id}-`))!;
    assert.ok(decline, plan.id);
    life = engine.choose(life, decline.id);
    while (life.phase === "ready" && life.year <= lastYear(plan)) life = engine.advance(life);
    assert.equal(life.phase, "ready", `${plan.id}: refusal should not immediately reoffer the same route.`);
    assert.equal(life.accomplishments!.filter(record => record.figure?.id === plan.figure.id).length, 0);
    assert.equal(has(life, plan.id), false);
  }
});

test("an unsuccessful final review retains earlier work and does not award or retry a title", () => {
  const plan = historicalTitlePlans.find(plan => plan.id === "right-hand-of-alexander")!;
  const engine = createEngine(fixture(plan));
  let failed: LifeState | undefined;
  for (let seed = 0; seed < 64 && !failed; seed++) {
    const before = reachFinal(engine, plan, `failed-final-${seed}`);
    if (!before) continue;
    const final = engine.getChoices(before).find(choice => awards(choice, plan.id))!;
    const after = engine.choose(before, final.id);
    if (!has(after, plan.id)) {
      assert.equal(after.accomplishments!.length, before.accomplishments!.length);
      failed = after;
    }
  }
  assert.ok(failed, "The final review must retain a genuine unsuccessful outcome.");
  while (failed.phase === "ready" && failed.year <= lastYear(plan)) failed = engine.advance(failed);
  assert.equal(failed.phase, "ready");
  assert.equal(has(failed, plan.id), false);
  assert.deepEqual(engine.load(engine.save(failed)), failed);
});

test("an unfinished historical duty waits a full year before its next bounded attempt", () => {
  const plan = historicalTitlePlans.find(plan => plan.id === "right-hand-of-alexander")!;
  const engine = createEngine(fixture(plan));
  let failure: { before: LifeState; after: LifeState } | undefined;
  for (let seed = 0; seed < 32 && !failure; seed++) {
    let life = engine.start(`duty-correction-${seed}`);
    for (let guard = 0; guard < 150 && life.phase !== "ended" && life.year < lastYear(plan); guard++) {
      if (life.phase === "ready") { life = engine.advance(life); continue; }
      const choice = engine.getChoices(life).find(choice => choice.id.startsWith(`attempt-${plan.id}-`))!;
      if (awards(choice, plan.id)) break;
      const achievement = choice.outcomes.flatMap(outcome => outcome.effects).find(effect => effect.type === "accomplishment");
      assert.ok(achievement && achievement.type === "accomplishment");
      const after = engine.choose(life, choice.id);
      if (!has(after, achievement.achievement)) { failure = { before: life, after }; break; }
      life = after;
    }
  }
  assert.ok(failure, "The bounded seed sample must contain an unfinished duty.");
  assert.equal(failure.after.phase, "ready", "Failure cannot immediately offer the same duty again in its acceptance year.");
  assert.equal(failure.after.pendingEventId, null);
  assert.equal(failure.after.age, failure.before.age);
  const retry = engine.advance(failure.after);
  assert.equal(retry.age, failure.before.age + 1);
  assert.equal(retry.pendingEventId, failure.before.pendingEventId);
  assert.equal(retry.eventCounts[retry.pendingEventId!], 2, "The later retry counts against the three-opportunity limit.");
});

test("repeating scheduled duties require an explicit positive annual cooldown", () => {
  const plan = historicalTitlePlans[0];
  for (const cooldown of [undefined, 0, -1]) {
    const world = fixture(plan);
    const repeat = world.events.find(event => event.trigger.type === "year" && (event.maxOccurrences ?? 1) > 1)!;
    assert.ok(repeat);
    if (cooldown === undefined) delete repeat.cooldownYears;
    else repeat.cooldownYears = cooldown;
    assert.throws(() => validateWorld(world), /maxOccurrences:.*explicit annual cooldownYears/);
  }
});

test("previous royal, aristocratic and direct-instruction title revisions retain their original saves", () => {
  for (const retained of [previous, previousEstates, previousTitles]) {
    const world = retained as WorldPack;
    const archived = getArchivedBuiltinWorld(`pack-${contentFingerprint(world)}`);
    assert.ok(archived, `Missing archived world ${world.version}.`);
    assert.deepEqual(archived.pack, world);
    const engine = createEngine(world), life = engine.start(`retained-before-title-cards-${world.version}`);
    assert.equal(life.accomplishments!.some(record => record.figure), false);
    assert.deepEqual(createEngine(archived.pack).load(engine.save(life)), life);
    assert.equal(engineForLife(life).world.version, world.version);
    assert.deepEqual(loadAnyLife(engine.save(life)), life);
  }
});

test("independent Theophrastean study is available during the Athens school closure", () => {
  const plan = historicalTitlePlans.find(plan => plan.figure.id === "theophrastus")!;
  const engine = createEngine(fixture(plan));
  const life = engine.start("theophrastus-closure");
  const first = engine.world.events.find(event => event.id === `historical-${plan.id}-${plan.steps[0].id}`)!;
  assert.equal(matchesCondition(first.when, { ...life, age: 43, year: -307 }), true, "Independent local study does not require an open school in Athens.");
  assert.equal(matchesCondition(first.when, { ...life, age: 44, year: -306 }), true);
});

test("all scholarly titles can be earned without meeting their figures after the old teaching windows", () => {
  for (const plan of historicalTitlePlans.filter(plan => plan.independentStudy)) {
    const world = fixture(plan);
    const first = world.events.find(event => event.id === `historical-${plan.id}-${plan.steps[0].id}`)!;
    first.when = { type: "all", conditions: [first.when!, { type: "year", op: "gte", value: -280 }] };
    const engine = createEngine(world);
    const { before, after } = acceptedTitle(engine, plan);
    assert.ok(before.year > -280, `${plan.id}: the whole study path happens after the former teaching window.`);
    assert.equal(has(after, plan.id), true);
    assert.equal(after.flags["heard-aristotle"], false, "Independent study must not invent personal instruction.");
    const title = after.accomplishments!.find(record => record.achievementId === plan.id)!;
    assert.deepEqual(title.people, ["Damon", "Philista"]);
    assert.deepEqual(title.figure, plan.figure, "The title retains its intellectual tradition and collection filter.");
    assert.match(after.journal.find(entry => entry.id === title.outcomeId)!.text, /no personal instruction or approval/);
    assert.deepEqual(engine.replay(after.seed, after.commands), after);
    assert.deepEqual(engine.load(engine.save(after)), after);
  }
});
