import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
import { advanceToDecisionWithFocus, focusActivity } from "../client/models/yearly-focus.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { focusLabel, yearEndChoiceNeeded, yearEndKeyOf, yearEndOptions } from "../client/models/year-end-choice.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(world);

function liveTo(seed: string, age: number): LifeState {
  let life: LifeState = engine.start(seed);
  for (let step = 0; step < 300 && !(life.age >= age && life.phase === "ready") && life.phase !== "ended"; step++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

test("a year only waits for the player when its action could still be spent", () => {
  assert.equal(yearEndChoiceNeeded(engine, liveTo("year-end-young", 3)), false, "no yearly action before 6");
  const life = liveTo("year-end-open", 9);
  assert.equal(yearEndChoiceNeeded(engine, life), true);
  const option = yearEndOptions(world, engine.getActivities(life), "everyday")[0];
  const spent = engine.act(life, option.id);
  if (spent.phase === "ready" && spent.age === life.age) assert.equal(yearEndChoiceNeeded(engine, spent), false, "a spent action is not asked again");
  assert.notEqual(yearEndKeyOf(life), yearEndKeyOf({ ...life, age: life.age + 1 }));
});

test("the focus's own action comes first and is marked recommended; the list stays short and varied", () => {
  const life = liveTo("year-end-options", 12);
  const activities = engine.getActivities(life);
  const options = yearEndOptions(world, activities, "health");
  assert.ok(options.length >= 2 && options.length <= 4);
  const walk = activities.find(activity => activity.id === "take-an-easy-walk");
  if (walk?.available) {
    assert.equal(options[0].id, "take-an-easy-walk");
    assert.equal(options[0].recommended, true);
  }
  assert.equal(options.filter(option => option.recommended).length <= 1, true);
  assert.equal(new Set(options.map(option => option.id)).size, options.length, "no option twice");
  for (const option of options) assert.ok(activities.find(activity => activity.id === option.id)?.available, `${option.text} can be taken now`);
  assert.equal(yearEndOptions(world, activities, "everyday").some(option => option.recommended), false, "Everyday life recommends nothing");
  assert.equal(focusLabel("study"), "Study");
  assert.equal(focusLabel("everyday"), null);
});

test("every year-end option spends the yearly action, so picking one never brings the same question back", () => {
  for (const [seed, age] of [["year-end-spend-a", 9], ["year-end-spend-b", 20], ["year-end-spend-c", 30]] as const) {
    const life = liveTo(seed, age);
    if (life.phase !== "ready" || !yearEndChoiceNeeded(engine, life)) continue;
    const activities = engine.getActivities(life);
    for (const option of yearEndOptions(world, activities, "everyday")) {
      const activity = activities.find(entry => entry.id === option.id)!;
      assert.notEqual(activity.usesYearlyActivity, false, `${option.id} must use up the yearly action`);
    }
  }
});

test("without a focus action the player still gets a real pick of several actions", () => {
  const life = liveTo("year-end-many", 14);
  if (life.phase !== "ready" || !yearEndChoiceNeeded(engine, life)) return;
  const usable = engine.getActivities(life).filter(activity => activity.available && activity.usesYearlyActivity !== false
    && ["training", "relationship", "family", "career"].includes(activity.category ?? ""));
  const options = yearEndOptions(world, engine.getActivities(life), "everyday");
  assert.equal(options.length, Math.min(4, usable.length), "up to four options whenever that many exist");
});

test("free actions (ending a friendship, resting while ill) are never offered as this year's action", () => {
  const free = { id: "end-friendship-x", text: "End a friendship", category: "relationship", outcomes: [], available: true, usesYearlyActivity: false } as never;
  const paid = { id: "train-x", text: "Practise reading", category: "training", outcomes: [], available: true } as never;
  const options = yearEndOptions(world, [free, paid], "everyday");
  assert.deepEqual(options.map(option => option.id), ["train-x"]);
  const life = liveTo("year-end-free", 9);
  const onlyFree = { ...engine, getActivities: () => [free] };
  assert.equal(yearEndChoiceNeeded(onlyFree, life), false, "a year with only free actions left does not wait");
});


test("manual fast-forward waits before spending a funded focus action", () => {
  const life = liveTo("year-end-fast-forward-funded", 9);
  const activity = focusActivity(world, "study")!;
  assert.ok(engine.getActivities(life).some(item => item.id === activity.id && item.available), "the focus is affordable");
  const saved = engine.save(life);
  const next = advanceToDecisionWithFocus(engine, life, "study", state => yearEndChoiceNeeded(engine, state));
  assert.strictEqual(next, life, "manual play waits at this age");
  assert.equal(engine.save(next), saved, "no money, work or replay commands change without a choice");
});

test("fast-forward after an explicit action cannot spend the following year's action", () => {
  const life = liveTo("year-end-fast-forward-spent", 9);
  const action = yearEndOptions(world, engine.getActivities(life), "study")[0];
  const spent = engine.act(life, action.id);
  const next = advanceToDecisionWithFocus(engine, spent, "study", state => yearEndChoiceNeeded(engine, state));
  assert.ok(next.age > spent.age || next.phase !== "ready");
  if (next.phase === "ready") assert.ok(yearEndChoiceNeeded(engine, next));
  const commands = (state: LifeState) => JSON.parse(engine.save(state)).commands.filter((command: { type: string }) => command.type === "act").length;
  assert.equal(commands(next), commands(spent), "only the player's chosen action is spent");
});

test("fast-forward from birth stops at an ordinary decision or an unspent yearly action", () => {
  let life = engine.start("year-end-fast-forward-birth");
  for (let step = 0; step < 100; step++) {
    const next = advanceToDecisionWithFocus(engine, life, "study", state => yearEndChoiceNeeded(engine, state));
    if (next.phase === "ready") {
      assert.ok(yearEndChoiceNeeded(engine, next));
      assert.equal(next.age, 6, "the first unused yearly action is not skipped");
      return;
    }
    assert.notEqual(next.phase, "ended", "this regression seed survives childhood");
    life = engine.choose(next, engine.getChoices(next)[0].id);
  }
  assert.fail("fast-forward did not reach the yearly action boundary");
});
