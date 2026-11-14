import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { flaxSeedAge, plantingCheck } from "../client/models/planting-check.ts";

const world = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-9.json", import.meta.url), "utf8")) as WorldPack;
const engine = createEngine(world);

function liveTo(seed: string, age: number): LifeState {
  let life: LifeState = engine.start(seed);
  for (let step = 0; step < 300 && !(life.age >= age && life.phase === "ready") && life.phase !== "ended"; step++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

test("a mixed plan without Crop allocation is refused before Set planting, with the game's own reason", () => {
  const life = liveTo("plant-mixed", 4);
  const plots = life.demo!.household.plots;
  assert.ok(plots >= 2, "the household has room for a mixed plan");
  assert.equal(life.capabilities?.learned.FC8, undefined);
  const check = plantingCheck(engine, life, 1);
  assert.match(check.reason ?? "", /Learn Crop allocation/);
  assert.throws(() => engine.demo(life, { type: "plan", flaxPlots: 1 }), /Learn Crop allocation/, "the check agrees with Set planting");
  assert.equal(plantingCheck(engine, life, 0).reason, null);
});

test("all-flax with no flax seed warns that those plots will grow grain instead, and when flax seed can be bought", () => {
  const life = liveTo("plant-flax", 4);
  const plots = life.demo!.household.plots;
  const check = plantingCheck(engine, life, plots);
  assert.equal(check.reason, null, "a single-crop plan can be set");
  assert.ok(check.warnings.some(line => /sown with grain instead/.test(line) && /from age 12/.test(line)));
  assert.ok(!check.warnings.some(line => /no new grain comes in/.test(line)), "without flax seed the plots grow grain, so grain still comes in");
  assert.equal(flaxSeedAge(world), 12);
});

test("an all-grain plan with seed in the store has no warnings", () => {
  const life = liveTo("plant-grain", 4);
  const check = plantingCheck(engine, life, 0);
  assert.equal(check.reason, null);
  if (life.demo!.household.grain >= life.demo!.household.plots * 10) assert.deepEqual(check.warnings, []);
});
