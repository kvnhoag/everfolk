import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createEngine } from "../src/index.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import { householdView } from "../src/demo/household.ts";
import { sowableFlaxPlots } from "../src/capabilities/farming.ts";
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
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

function withCropAllocation(life: LifeState): LifeState {
  const copy = structuredClone(life);
  copy.capabilities!.learned.FC8 = { age: copy.age, year: copy.year };
  return copy;
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

test("mixing crops opens with Crop allocation, and the check says so in agreement with the game", () => {
  const life = liveTo("plant-mixed", 4);
  assert.equal(plantingCheck(engine, life, 0).mixedUnlocked, false, "before Crop allocation only single-crop plans are offered");
  const learned = withCropAllocation(life);
  const check = plantingCheck(engine, learned, 1);
  assert.equal(check.mixedUnlocked, true);
  assert.equal(check.reason, null);
  assert.doesNotThrow(() => engine.demo(learned, { type: "plan", flaxPlots: 1 }));
});

test("all-flax with no flax seed says in one plain sentence that the fields grow grain, and when seed can be bought", () => {
  const life = liveTo("plant-flax", 4);
  const plots = life.demo!.household.plots;
  const check = plantingCheck(engine, life, plots);
  assert.equal(check.reason, null, "a single-crop plan can be set");
  assert.ok(check.warnings.includes("You have no flax seed, so these flax plots will grow grain this year. Flax seed can be bought as a yearly action from age 12."), check.warnings.join(" | "));
  assert.ok(!check.warnings.some(line => /no new grain comes in/.test(line)), "without flax seed the plots grow grain, so grain still comes in");
  assert.equal(flaxSeedAge(world), 12);
});

test("once flax seed can be bought, the seed sentence says how to get it; one flax plot reads in the singular", () => {
  const life = liveTo("plant-flax", 13);
  assert.notEqual(life.phase, "ended", "the life reaches the age under test");
  const learned = withCropAllocation(life);
  const one = plantingCheck(engine, learned, 1);
  const seedLine = one.warnings.find(line => /flax seed/.test(line)) ?? "";
  assert.equal(seedLine, "You have no flax seed, so the flax plot will grow grain this year. Buy flax seed with a yearly action to grow flax.");
  assert.doesNotMatch(one.warnings.join(" "), /plot need\b/, "no broken plural");
});

test("some flax seed covers only some plots: the sentence counts what is sown and what grows grain", () => {
  const life = withCropAllocation(liveTo("plant-flax", 13));
  assert.notEqual(life.phase, "ended", "the life reaches the age under test");
  life.demo!.household.plots = 3;
  life.vocations!.inventory["flax-seed"] = 2;
  const check = plantingCheck(engine, life, 3);
  assert.ok(check.warnings.includes("You have 2 flax seed, enough for 1 of the 3 flax plots, so the other 2 will grow grain this year. Buy flax seed with a yearly action to grow flax."), check.warnings.join(" | "));
});

test("an all-grain plan with seed in the store has no warnings", () => {
  const life = liveTo("plant-grain", 4);
  const check = plantingCheck(engine, life, 0);
  assert.equal(check.reason, null);
  if (life.demo!.household.grain >= life.demo!.household.plots * 10) assert.deepEqual(check.warnings, []);
});

test("each plan carries the game's own forecast and seed needs, the same numbers the store ledger shows", () => {
  const life = liveTo("plant-grain", 13);
  assert.notEqual(life.phase, "ended", "the life reaches the age under test");
  const plots = life.demo!.household.plots;
  const current = plantingCheck(engine, life, life.demo!.household.flaxPlots);
  const view = householdView(world.demo!, life as LifeStateWithDemo, world);
  const sown = sowableFlaxPlots(world, life);
  assert.deepEqual(current.forecast, { grainPlots: plots - sown, flaxPlots: sown, grain: view.expectedHarvest, flax: view.expectedFlax });
  const allFlax = plantingCheck(engine, life, plots);
  assert.equal(allFlax.seed?.flaxNeed, plots * 2);
  assert.equal(allFlax.forecast?.flaxPlots, 0, "without flax seed no plot is sown with flax");
  assert.equal(allFlax.forecast?.grainPlots, plots);
  assert.equal(plantingCheck(engine, life, 0).seed?.grainNeed, plots * 10);
});

test("a plan the game refuses has no forecast", () => {
  const life = liveTo("plant-mixed", 4);
  assert.equal(plantingCheck(engine, life, 1).forecast, null);
});

/** The trap from a playtest: all flax planned, no flax seed, no money, and no Crop allocation. */
function trapped(): LifeState {
  const life = structuredClone(engine.demo(liveTo("plant-trap", 20), { type: "plan", flaxPlots: 2 }));
  life.economy!.cash = 0;
  life.vocations!.inventory["flax-seed"] = 0;
  return life;
}

test("no flax seed and no money to buy it: the check recommends All grain in one sentence", () => {
  const life = trapped();
  assert.equal(life.demo!.household.flaxPlots, life.demo!.household.plots);
  assert.equal(life.capabilities?.learned.FC8, undefined);
  const check = plantingCheck(engine, life, life.demo!.household.plots);
  assert.ok(check.warnings.includes("No flax seed and no money to buy it: switch to All grain so these fields feed the household."), check.warnings.join(" | "));
  assert.equal(check.warnings.filter(line => /flax seed/.test(line)).length, 1, "one sentence, not two");
});

test("trapped in all flax, the All grain choice is one valid plan away, and setting it plants every plot with grain", () => {
  const life = trapped();
  const plots = life.demo!.household.plots;
  const allGrain = plantingCheck(engine, life, 0);
  assert.equal(allGrain.reason, null, "nothing blocks the way back to grain");
  const after = engine.demo(life, { type: "plan", flaxPlots: 0 });
  assert.equal(after.demo!.household.flaxPlots, 0);
  assert.equal(plantingCheck(engine, after, 0).forecast?.grainPlots, plots);
});

test("after Crop allocation the same recommendation names grain on every plot, since there is no All grain button", () => {
  const life = withCropAllocation(trapped());
  const line = plantingCheck(engine, life, life.demo!.household.plots).warnings.find(text => /flax seed/.test(text));
  assert.equal(line, "No flax seed and no money to buy it: plant grain on every plot so these fields feed the household.");
});
