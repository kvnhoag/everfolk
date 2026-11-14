import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { actionNudge, NUDGE_AT_PROGRESS } from "../client/models/action-nudge.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(world);

function liveTo(seed: string, age: number): LifeState {
  let life: LifeState = engine.start(seed);
  for (let step = 0; step < 300 && !(life.age >= age && life.phase === "ready") && life.phase !== "ended"; step++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

test("halfway through a year with its action unused, the pinned bar offers it; before that it stays quiet", () => {
  const life = liveTo("nudge-open", 9);
  const activities = engine.getActivities(life);
  assert.equal(actionNudge(world, life, activities, "everyday", NUDGE_AT_PROGRESS - 0.01), null, "too early in the year");
  const nudge = actionNudge(world, life, activities, "everyday", NUDGE_AT_PROGRESS);
  assert.ok(nudge, "half the year gone");
  assert.equal(nudge!.focusAction, null, "no focus, nothing recommended: the player picks");
});

test("with a focus, the nudge names the focus's own action for one click; it never runs it by itself", () => {
  const life = liveTo("nudge-focus", 9);
  const activities = engine.getActivities(life);
  const nudge = actionNudge(world, life, activities, "study", 0.8);
  const study = activities.find(activity => activity.id === "train-literacy");
  if (study?.available) assert.deepEqual(nudge?.focusAction, { id: "train-literacy", text: study.text });
});

test("no nudge once the action is spent, during a decision, or before the yearly action opens", () => {
  const life = liveTo("nudge-spent", 9);
  const spent = { ...life, character: { ...life.character!, lastActivityAge: life.age } };
  assert.equal(actionNudge(world, spent, engine.getActivities(spent), "everyday", 0.9), null);
  assert.equal(actionNudge(world, { ...life, phase: "choice" }, engine.getActivities(life), "everyday", 0.9), null);
  const young = liveTo("nudge-young", 3);
  assert.equal(actionNudge(world, young, engine.getActivities(young), "everyday", 0.9), null);
});
