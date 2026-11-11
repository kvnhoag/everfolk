import { withoutMarketSignals, withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import legacy from "../worlds/alexandria-0.15.0.json" with { type: "json" };
import { advanceYearWithFocus } from "../client/models/yearly-focus.ts";
import { persistYearlyFocus } from "../client/mutations/yearly-focus.ts";

/** Keep current care/state rules, isolating retention from unrelated incidents. */
function fixture(knowledge = 80): WorldPack {
  const world = withoutMoneylender(structuredClone(current) as WorldPack);
  withoutMarketSignals(world);
  // Retention tests isolate forgetting and timing from the separate gain curve.
  for (const stat of Object.values(world.stats)) delete stat.gainCurve;
  for (const skill of Object.values(world.character!.skills)) delete skill.gainCurve;
  world.events = world.events.filter(event => event.id === world.health!.careDecision);
  delete world.eventPacing;
  delete world.character!.encounterPacing;
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.yearlyEffects = [{ type: "cash", delta: 100 }];
  world.yearlyRules = [];
  // Retention and lesson-affordability fixtures supply all cash explicitly.
  for (const asset of world.economy!.assets) asset.initialRange = { min: 0, max: 0 };
  for (const origin of world.origins) delete origin.assetRanges;
  for (const origin of world.origins) {
    origin.effects = [];
    origin.statRanges = { ...origin.statRanges, health: { min: 100, max: 100 }, knowledge: { min: knowledge, max: knowledge }, wealth: { min: 50, max: 50 } };
  }
  return world;
}
function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.age < target) life = engine.advance(life);
  return life;
}

test("completed years lose Knowledge after inactivity grace, with an exact save and immutable earlier snapshots", () => {
  const engine = createEngine(fixture()), initial = engine.start("retention-interval");
  assert.deepEqual(initial.knowledge, { lastPracticeAge: null });
  const protectedLife = ageTo(engine, initial, 14);
  assert.equal(protectedLife.stats.knowledge, 80);
  const firstLoss = engine.advance(protectedLife), secondLoss = engine.advance(firstLoss);
  assert.equal(firstLoss.stats.knowledge, 79);
  assert.equal(secondLoss.stats.knowledge, 78);
  assert.deepEqual(secondLoss.journal.filter(entry => entry.id === "knowledge-idle-decline").map(entry => entry.age), [14, 15]);
  assert.equal(protectedLife.stats.knowledge, 80);
  assert.deepEqual(protectedLife.knowledge, { lastPracticeAge: null });
  assert.deepEqual(engine.replay(secondLoss.seed, secondLoss.commands), secondLoss);
  assert.deepEqual(engine.load(engine.save(secondLoss)), secondLoss);
});

test("actual lessons refresh practice at capped Knowledge and protect only the grace interval", () => {
  const engine = createEngine(fixture(100)), before = ageTo(engine, engine.start("capped-lessons"), 12);
  const learned = engine.act(before, "train-literacy");
  assert.equal(learned.stats.knowledge, 100);
  assert.equal(learned.knowledge!.lastPracticeAge, 12);
  assert.equal(before.knowledge!.lastPracticeAge, null);
  const age14 = engine.advance(engine.advance(learned));
  assert.equal(age14.stats.knowledge, 100);
  assert.equal(engine.advance(age14).stats.knowledge, 99);
  assert.deepEqual(engine.replay(age14.seed, age14.commands), age14);
});

test("selecting Study and skipping an unaffordable lesson cannot create practice", () => {
  const world = fixture();
  world.yearlyEffects = [];
  world.origins.forEach(origin => { origin.statRanges!.wealth = { min: 0, max: 0 }; });
  const engine = createEngine(world), before = ageTo(engine, engine.start("unaffordable-practice"), 14);
  const saved = engine.save(before), rows = new Map<string, string>();
  persistYearlyFocus({ getItem: key => rows.get(key) ?? null, setItem: (key, value) => { rows.set(key, value); } }, before, "study");
  assert.equal(engine.save(before), saved);
  const next = advanceYearWithFocus(engine, before, "study");
  assert.deepEqual(next.commands.slice(before.commands.length), [{ type: "advance" }]);
  assert.equal(next.knowledge!.lastPracticeAge, null);
  assert.equal(next.stats.knowledge, 79);
  assert.equal(next.economy!.debt, 0);
  assert.deepEqual(engine.load(engine.save(next)), next);
});

test("incoming-year scholarly work cannot retroactively remove the prior year's neglect", () => {
  const world = fixture();
  world.character!.jobs.push({ id: "retention-scholar", title: "Scholar", description: "An authored test occupation.", minAge: 0, yearlyEffects: [{ type: "stat", stat: "knowledge", delta: 2 }] });
  world.character!.activities.push({ id: "become-retention-scholar", text: "Start scholarly work", category: "career", minAge: 0, outcomes: [{ id: "retention-scholar-result", text: "You arrange scholarly work.", weight: 1, effects: [{ type: "job", job: "retention-scholar" }] }] });
  const engine = createEngine(world), before = engine.act(ageTo(engine, engine.start("job-retention-order"), 20), "become-retention-scholar");
  assert.equal(before.knowledge!.lastPracticeAge, null);
  const next = engine.advance(before);
  assert.equal(next.stats.knowledge, before.stats.knowledge + 1, "Prior-year neglect costs 1 before the new year's work adds 2.");
  assert.equal(next.knowledge!.lastPracticeAge, 21);
  const lossIndex = next.journal.findIndex(entry => entry.id === "knowledge-idle-decline" && entry.age === 20);
  const workIndex = next.journal.findIndex(entry => entry.id === "retention-scholar" && entry.age === 21);
  assert.ok(lossIndex >= 0 && workIndex > lossIndex);
  assert.equal(engine.advance(next).stats.knowledge, next.stats.knowledge + 2);
  assert.deepEqual(engine.load(engine.save(next)), next);
});

test("continued study limits forgetting but does not cancel advanced-age loss", () => {
  const engine = createEngine(fixture(100));
  let studying = engine.start("aged-study"), idle = engine.start("aged-study");
  while (studying.age < 81) studying = advanceYearWithFocus(engine, studying, "study");
  idle = ageTo(engine, idle, 81);
  assert.ok(studying.stats.knowledge > idle.stats.knowledge);
  const next = advanceYearWithFocus(engine, studying, "study");
  assert.equal(next.stats.knowledge, studying.stats.knowledge - 0.5, "Lesson gain 1 is followed by age loss 1.5.");
  assert.equal(next.knowledge!.lastPracticeAge, 81);
  assert.equal(next.journal.some(entry => entry.age === 81 && entry.id === "knowledge-idle-decline"), false);
  assert.equal(next.stats.health, 100, "Knowledge rules do not invent a separate Health penalty.");
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
});

test("new packs remove passive blanket gains while older lives keep their original rules", () => {
  assert.ok(current.knowledge);
  assert.equal(current.version, "0.42.0");
  assert.equal(current.yearlyRules.some(rule => rule.id === "practical-experience" || rule.id === "learning-through-words"), false);
  const engine = createEngine(legacy);
  let life = engine.start("legacy-retention-replay");
  while (life.age < 4 && life.phase !== "ended") life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  assert.equal(life.knowledge, undefined);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
