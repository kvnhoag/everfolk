import { withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { advanceToDecisionWithFocus, advanceYearWithFocus, focusStatus, normalizeYearlyFocus, persistYearlyFocus, readYearlyFocus, selectAutomaticChoice, yearlyFocusStorageKey } from "../client/yearly-focus.ts";

function controlledWorld(): WorldPack {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  world.events = world.events.filter(event => event.id === world.health!.careDecision);
  delete world.eventPacing;
  delete world.character!.encounterPacing;
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = [];
  world.yearlyRules = [];
  world.stats.wealth.initialRange = { min: 50, max: 50 };
  world.origins.forEach(origin => { origin.effects = []; origin.statRanges = { ...origin.statRanges, wealth: { min: 50, max: 50 } }; });
  return world;
}

function ageTo(engine: LifeEngine, target: number, seed = "yearly-focus-test"): LifeState {
  let life = engine.start(seed);
  while (life.age < target && life.phase === "ready") life = engine.advance(life);
  assert.equal(life.age, target);
  return life;
}

test("selecting or storing a focus cannot act, reroll, or leak into another life", () => {
  const engine = createEngine(controlledWorld()), life = ageTo(engine, 6);
  const before = engine.save(life), rows = new Map<string, string>();
  const storage = { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } };
  persistYearlyFocus(storage, life, "study");
  assert.equal(readYearlyFocus(storage, life, engine.world), "study");
  assert.equal(engine.save(life), before);
  assert.equal(readYearlyFocus(storage, engine.start("another-seed"), engine.world), "everyday");
  assert.equal(readYearlyFocus(storage, { ...life, worldFingerprint: "another-world" }, engine.world), "everyday");
  storage.setItem(yearlyFocusStorageKey(life), "unknown-focus");
  assert.equal(readYearlyFocus(storage, life, engine.world), "everyday");
  assert.equal(readYearlyFocus({ getItem() { throw Error("blocked"); }, setItem() {} }, life, engine.world), "everyday");
  const withoutStudy = structuredClone(engine.world);
  withoutStudy.character!.activities = withoutStudy.character!.activities.filter(activity => activity.id !== "train-literacy");
  assert.equal(normalizeYearlyFocus("study", withoutStudy), "everyday");
});

test("a paid yearly focus accepts one normal activity before advancing and replays exactly", () => {
  const engine = createEngine(controlledWorld()), life = ageTo(engine, 6);
  const next = advanceYearWithFocus(engine, life, "study");
  assert.deepEqual(next, engine.advance(engine.act(life, "train-literacy")));
  assert.deepEqual(next.commands.slice(life.commands.length), [{ type: "act", activity: "train-literacy" }, { type: "advance" }]);
  assert.equal(next.character!.skills.literacy, 6);
  assert.equal(next.economy!.cash, life.economy!.cash - 20);
  assert.deepEqual(engine.load(engine.save(next)), next);
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
});

test("birth and everyday focus never spend an activity or pre-simulate childhood", () => {
  const engine = createEngine(controlledWorld()), birth = engine.start("focus-birth");
  assert.equal(birth.age, 0);
  assert.deepEqual(advanceYearWithFocus(engine, birth, "study"), engine.advance(birth));
  const adult = ageTo(engine, 20);
  assert.deepEqual(advanceYearWithFocus(engine, adult, "everyday"), engine.advance(adult));
});

test("an explicitly chosen activity wins over the automatic focus", () => {
  const engine = createEngine(controlledWorld());
  const life = engine.act(ageTo(engine, 12), "take-an-easy-walk");
  const next = advanceYearWithFocus(engine, life, "study");
  assert.deepEqual(next, engine.advance(life));
  assert.equal(next.character!.skills.literacy, 0);
  assert.match(focusStatus(life, engine.world, "study", engine.getActivities(life)), /already chose an activity/);
});

test("an unaffordable focus is skipped without borrowing, substitution, or failure", () => {
  const world = controlledWorld();
  world.stats.wealth.initialRange = { min: 0, max: 0 };
  world.origins.forEach(origin => { origin.statRanges!.wealth = { min: 0, max: 0 }; });
  const engine = createEngine(world), life = ageTo(engine, 8);
  const next = advanceYearWithFocus(engine, life, "study");
  assert.deepEqual(next, engine.advance(life));
  assert.equal(next.economy!.cash, 0);
  assert.equal(next.economy!.debt, 0);
  assert.equal(next.character!.lastActivityAge, null);
  assert.match(focusStatus(life, engine.world, "study", engine.getActivities(life)), /Skipped this year:/);
});

test("a repeating focus respects its real cooldown instead of inventing yearly effects", () => {
  const engine = createEngine(controlledWorld()), life = ageTo(engine, 8);
  const age9 = advanceYearWithFocus(engine, life, "health");
  assert.equal(age9.age, 9);
  assert.equal(age9.character!.lastActivityAges["take-an-easy-walk"], 8);
  const age10 = advanceYearWithFocus(engine, age9, "health");
  assert.deepEqual(age10, engine.advance(age9));
  assert.match(focusStatus(age9, engine.world, "health", engine.getActivities(age9)), /Skipped this year:.*age 10/);
  assert.equal(advanceYearWithFocus(engine, age10, "health").character!.lastActivityAges["take-an-easy-walk"], 10);
});

test("fast-forward and timed years share exactly the same accepted focus commands", () => {
  const world = controlledWorld();
  world.events.push({ id: "test-decision", title: "A question", text: "Choose.", trigger: { type: "age", at: 8 }, choices: [
    { id: "answer", text: "Answer", outcomes: [{ id: "answered", text: "Done.", weight: 1, effects: [] }] },
  ] });
  const engine = createEngine(world), life = ageTo(engine, 6);
  const expected = advanceYearWithFocus(engine, advanceYearWithFocus(engine, life, "study"), "study");
  const skipped = advanceToDecisionWithFocus(engine, life, "study");
  assert.deepEqual(skipped, expected);
  assert.equal(skipped.phase, "choice");
  assert.equal(skipped.age, 8);
  assert.equal(advanceYearWithFocus(engine, skipped, "study"), skipped);
  assert.equal(advanceToDecisionWithFocus(engine, skipped, "study"), skipped);
  assert.deepEqual(engine.replay(skipped.seed, skipped.commands), skipped);
});

test("a fatal focused activity ends at the current age without a second advance", () => {
  const world = controlledWorld();
  world.character!.activities.find(activity => activity.id === "train-craft")!.outcomes = [{
    id: "fatal-test-outcome", text: "The test life ends.", weight: 1, effects: [{ type: "skill", skill: "craft", delta: 1 }, { type: "end", ending: "death-in-childhood", deathCause: "cargo-crush" }],
  }];
  const engine = createEngine(world), life = ageTo(engine, 10);
  const ended = advanceYearWithFocus(engine, life, "craft");
  assert.equal(ended.phase, "ended");
  assert.equal(ended.age, 10);
  assert.deepEqual(ended.commands.slice(life.commands.length), [{ type: "act", activity: "train-craft" }]);
  assert.equal(advanceToDecisionWithFocus(engine, ended, "craft"), ended);
  assert.deepEqual(engine.replay(ended.seed, ended.commands), ended);
});

function riskChoice(id: string, dead: number, alive: number): Choice {
  return { id, text: id, outcomes: [
    ...(dead ? [{ id: `${id}-fatal`, text: "A fatal result.", weight: dead, effects: [{ type: "end" as const, ending: "death" }] }] : []),
    { id: `${id}-safe`, text: "A safe result.", weight: alive, effects: [] },
  ] };
}

test("Auto mode picks the first safe option, otherwise the lowest normalized fatal risk", () => {
  const choices = [riskChoice("dangerous", 1, 1), riskChoice("safe", 0, 1), riskChoice("also-safe", 0, 1)];
  const before = structuredClone(choices);
  assert.equal(selectAutomaticChoice(choices)?.id, "safe");
  assert.deepEqual(choices, before);
  assert.equal(selectAutomaticChoice([riskChoice("quarter", 1, 3), riskChoice("tenth", 1, 9)])?.id, "tenth");
  assert.equal(selectAutomaticChoice([riskChoice("first", 1, 9), riskChoice("second", 2, 18)])?.id, "first");
  assert.equal(selectAutomaticChoice([]), undefined);
  const chapter = riskChoice("chapter", 1, 1);
  assert.equal(selectAutomaticChoice([chapter, choices[1]], { endings: [{ id: "death", kind: "chapter", title: "Chapter", text: "Done." }] } as WorldPack)?.id, "chapter");
});

test("a bounded focused Auto-mode life finishes through replayable ordinary commands", () => {
  const engine = createEngine(pack);
  let life = engine.start("focused-auto-full-life");
  for (let step = 0; step < 600 && life.phase !== "ended"; step++) {
    if (life.phase === "choice") {
      const choice = selectAutomaticChoice(engine.getChoices(life), engine.world);
      assert.ok(choice);
      life = engine.choose(life, choice.id);
    } else life = advanceToDecisionWithFocus(engine, life, "study");
  }
  assert.equal(life.phase, "ended");
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
