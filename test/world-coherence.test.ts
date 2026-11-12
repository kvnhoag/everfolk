import fixturePack from "../worlds/alexandria-0.37.0.json" with { type: "json" };
import { withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, yearAtAge } from "../src/index.ts";
import type { Condition, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import namedCatalog from "../worlds/alexandria-0.28.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.11.0.json" with { type: "json" };
import timelineRelease from "../worlds/alexandria-0.13.0.json" with { type: "json" };

function fixture(eventIds: string[] = [], source = fixturePack): LifeEngine {
  const world = withoutMoneylender(structuredClone(source) as WorldPack);
  world.events = world.events.filter(event => eventIds.includes(event.id) || event.id === world.health!.careDecision);
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = [];
  world.yearlyRules = [];
  return createEngine(world);
}

/** Isolate requirements from the random route that led to an adult situation. */
function adult(engine: LifeEngine, age = 30): LifeState {
  const life = structuredClone(engine.start("coherence-fixture"));
  life.age = age;
  life.year = yearAtAge(engine.world.startYear, age);
  life.stats = { health: 70, knowledge: 50, wealth: 50, bonds: 50 };
  life.character!.skills = Object.fromEntries(Object.keys(engine.world.character!.skills).map(id => [id, 50]));
  life.character!.knownPartnerIds = engine.world.character!.partners.map(partner => partner.id);
  life.character!.relationships!.partners = Object.fromEntries(engine.world.character!.partners.map(partner => [partner.id, { closeness: engine.world.relationships!.initialCloseness, lastContactAge: age }]));
  life.economy = { cash: 500, debt: 0, assets: {} };
  life.phase = "ready";
  life.pendingEventId = null;
  return life;
}

test("career offers preserve an established occupation and do not offer the same job twice", () => {
  for (const [eventId, keepId, repeatedId] of [
    ["the-first-wages", "keep-first-job", "steady-work"],
    ["a-place-on-the-manifest", "keep-regular-job", "stay"],
  ]) {
    const engine = fixture([eventId]);
    const life = adult(engine, 18);
    life.character!.jobId = "porter";
    life.phase = "choice";
    life.pendingEventId = eventId;
    life.eventCounts[eventId] = 1;
    const choices = engine.getChoices(life);
    assert.ok(choices.some(choice => choice.id === keepId));
    assert.equal(choices.some(choice => choice.id === repeatedId), false);
    const kept = engine.choose(life, keepId);
    assert.equal(kept.character!.jobId, "porter");
    assert.deepEqual(kept.stats, life.stats, "Keeping a job has no invented reward or penalty.");

    life.character!.jobId = "potter";
    assert.equal(engine.choose(life, keepId).character!.jobId, "potter");
    life.character!.jobId = null;
    assert.equal(engine.getChoices(life).some(choice => choice.id === keepId), false);
  }
});

test("late work events check employment and heavy-work events check the actual trade", () => {
  const engine = fixture();
  const life = adult(engine, 60);
  const heavy = pack.events.find(event => event.id === "a-different-kind-of-work")!;
  const rest = pack.events.find(event => event.id === "the-cost-of-rest")!;
  const retire = pack.events.find(event => event.id === "stepping-back")!;
  assert.equal(matchesCondition(heavy.when as Condition, life), false);
  assert.equal(matchesCondition(rest.when as Condition, life), false);
  assert.equal(matchesCondition(retire.when as Condition, life), false);
  life.character!.jobId = "copyist";
  assert.equal(matchesCondition(heavy.when as Condition, life), false);
  assert.equal(matchesCondition(rest.when as Condition, life), true);
  assert.equal(matchesCondition(retire.when as Condition, life), true);
  life.character!.jobId = "porter";
  assert.equal(matchesCondition(heavy.when as Condition, life), true);
});

test("family discussions are automatic notes that respect existing relationships", () => {
  const engine = fixture();
  const life = adult(engine);
  const marriage = pack.events.find(event => event.id === "a-shared-household")!;
  const child = pack.events.find(event => event.id === "a-new-generation")!;
  for (const event of [marriage, child]) {
    assert.equal(event.mode, "automatic");
    assert.deepEqual(event.choices, []);
    assert.deepEqual(event.effects, []);
    assert.doesNotMatch(event.text, /Open Your life|this conversation does not|not started a courtship/);
  }
  assert.equal(matchesCondition(marriage.when as Condition, life), true);
  life.character!.relationshipStatus = "courting";
  life.character!.partnerId = "demetria";
  assert.equal(matchesCondition(marriage.when as Condition, life), false);
  assert.equal(matchesCondition(child.when as Condition, life), false);
  life.character!.relationshipStatus = "married";
  assert.equal(matchesCondition(child.when as Condition, life), true);
  life.character!.children.push({ id: "child-1", name: "Dion", birthAge: 29, otherParentId: "demetria" });
  assert.equal(matchesCondition(child.when as Condition, life), false);
});

test("a second courtship requires an explicit breakup before another person can be pursued", () => {
  const engine = fixture([], namedCatalog);
  const life = adult(engine);
  life.character!.partnerId = "demetria";
  life.character!.relationshipStatus = "courting";
  assert.equal(engine.getActivities(life).find(activity => activity.id === "court-thais")!.available, false);
  const ended = engine.act(life, "end-courtship");
  assert.equal(ended.character!.partnerId, null);
  assert.equal(ended.character!.relationshipStatus, "single");
  const followingYear = engine.advance(ended);
  assert.equal(engine.getActivities(followingYear).find(activity => activity.id === "court-thais")!.available, true);
});

test("cash-funded lessons remain affordable when debt reduces net worth to zero", () => {
  const engine = fixture();
  const life = adult(engine);
  life.economy!.debt = life.economy!.cash;
  life.stats.wealth = 0;
  const lesson = engine.getActivities(life).find(activity => activity.id === "train-literacy")!;
  assert.equal(lesson.available, true, lesson.reason);
  const learned = engine.act(life, lesson.id);
  assert.equal(learned.economy!.cash, 480);
  assert.equal(learned.economy!.debt, 500);
  assert.equal(learned.character!.skills.literacy, 53, "The paid lesson remains usable; its high-level reward follows the stricter curve.");

  const visit = (condition: Condition | undefined): void => {
    if (!condition) return;
    assert.ok(condition.type !== "stat" || condition.stat !== "wealth", "Paid requirements must use cash rather than the hidden wealth index.");
    if (condition.type === "all" || condition.type === "any") condition.conditions.forEach(visit);
    if (condition.type === "not") visit(condition.condition);
  };
  engine.world.character!.activities.forEach(activity => visit(activity.when));
  engine.world.events.forEach(event => { visit(event.when); event.choices.forEach(choice => visit(choice.when)); });
});

test("a tool chest unlocks paid repair work without rewarding repeated purchases", () => {
  const engine = fixture();
  const life = adult(engine);
  life.character!.skills.craft = 15;
  assert.equal(engine.getActivities(life).find(activity => activity.id === "take-small-repair-jobs")!.available, false);
  life.economy!.assets["tool-chest"] = 1;
  const repair = engine.getActivities(life).find(activity => activity.id === "take-small-repair-jobs")!;
  assert.equal(repair.available, true, repair.reason);
  const repaired = engine.act(life, repair.id);
  assert.equal(repaired.economy!.cash, 520);
  assert.equal(repaired.character!.skills.craft, 17);
  const buy = engine.world.character!.activities.find(activity => activity.id === "buy-tool-chest")!;
  assert.ok(buy.outcomes.every(outcome => outcome.effects.every(effect => effect.type !== "skill")), "Purchasing and reselling tools must not farm skill gains.");
});

test("attributes unlock forgiving specialist opportunities while basic practice and recovery stay open", () => {
  const engine = fixture();
  const life = adult(engine);
  life.character!.jobId = "porter";
  const available = (id: string) => engine.getActivities(life).find(activity => activity.id === id)!;
  life.stats.health = 19;
  assert.equal(available("take-day-cargo-work").available, false);
  assert.match(available("take-day-cargo-work").reason!, /Health/);
  life.stats.health = 20;
  assert.equal(available("take-day-cargo-work").available, true);
  life.stats.knowledge = 14;
  assert.equal(available("train-philosophy").available, false);
  assert.match(available("train-philosophy").reason!, /Knowledge/);
  life.stats.knowledge = 15;
  assert.equal(available("train-philosophy").available, true);
  life.stats.bonds = 19;
  assert.equal(available("seek-court-appointment").available, false);
  assert.match(available("seek-court-appointment").reason!, /Bonds/);
  life.stats.bonds = 20;
  assert.equal(available("seek-court-appointment").available, true);
  life.stats.health = life.stats.knowledge = life.stats.bonds = 0;
  assert.equal(available("train-literacy").available, true);
  assert.equal(available("take-an-easy-walk").available, true);
  assert.equal(available("visit-a-friend").available, true);
});

test("timeline changes preserve source records and fatal odds, and their retained release keeps its death rates", () => {
  assert.deepEqual(pack.sources.slice(0, previous.sources.length), previous.sources);
  assert.deepEqual(timelineRelease.sources.slice(previous.sources.length).map(source => source.id), ["diodorus-childhood-work", "alexandrian-minor-apprentice"]);
  assert.deepEqual(timelineRelease.mortality.bands, previous.mortality.bands);
  assert.deepEqual(pack.mortality.sourceIds, previous.mortality.sourceIds);
  assert.match(pack.mortality.description, /comparison|legacy/);
  const fatalOdds = (world: WorldPack) => [
    ...world.events.flatMap(event => event.choices), ...world.character!.activities,
  ].filter(choice => choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "end")))
    .map(choice => ({ id: choice.id, weights: choice.outcomes.map(outcome => outcome.weight) }));
  assert.deepEqual(fatalOdds(timelineRelease as WorldPack), fatalOdds(previous as WorldPack));
});
