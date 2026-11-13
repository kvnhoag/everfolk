import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
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
