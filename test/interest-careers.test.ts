import { withoutMarketSignals, withoutMoneylender } from "./fixture-features.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, yearAtAge } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import previous from "../worlds/alexandria-0.13.0.json" with { type: "json" };
import interestRelease from "../worlds/alexandria-0.14.0.json" with { type: "json" };

const commissionIds = ["small-pottery-order", "small-carving-order", "small-figure-order", "teach-a-reading-lesson", "copy-a-sky-table", "prepare-a-chart-reading"];
function controlledWorld(): WorldPack {
  const world = withoutMoneylender(structuredClone(pack) as WorldPack);
  // Isolate ordinary commission mechanics while retaining all sampled birth origins.
  if (world.royalty) world.royalty.originId = "fixture-unselected-royal-origin";
  if (world.aristocracy) world.aristocracy.originId = "fixture-unselected-estate-origin";
  withoutMarketSignals(world);
  world.events = world.events.filter(event => ["the-first-household", world.health!.careDecision].includes(event.id));
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = [];
  world.yearlyRules = [];
  // This work-income fixture excludes possessions and passive household income.
  for (const asset of world.economy!.assets) asset.initialRange = { min: 0, max: 0 };
  for (const origin of world.origins) delete origin.assetRanges;
  world.stats.wealth.initialRange = { min: 80, max: 80 };
  for (const origin of world.origins) origin.statRanges!.wealth = { min: 80, max: 80 };
  return world;
}
function ageTo(engine: LifeEngine, life: LifeState, target: number): LifeState {
  while (life.age < target) life = engine.advance(life);
  return life;
}
function availability(engine: LifeEngine, life: LifeState, id: string) {
  const activity = engine.getActivities(life).find(activity => activity.id === id);
  assert.ok(activity, `Missing ${id}`);
  return activity;
}

test("a practiced interest earns alongside a day job and can become the regular occupation", () => {
  const engine = createEngine(controlledWorld());
  let life = ageTo(engine, engine.start("pottery-from-an-interest"), 10);
  life = engine.act(life, "train-craft");
  life = engine.act(ageTo(engine, life, 11), "train-craft");
  life = engine.act(ageTo(engine, life, 12), "train-craft");
  for (const age of [13, 14, 15, 16]) life = engine.act(ageTo(engine, life, age), "train-pottery");
  life = engine.act(ageTo(engine, life, 17), "work-porter");
  life = ageTo(engine, life, 18);
  const before = life.economy!.cash;
  const pottery = life.character!.skills.pottery;
  assert.equal(availability(engine, life, "small-pottery-order").available, true);
  life = engine.act(life, "small-pottery-order");
  assert.equal(life.economy!.cash, before + 20, "Payment less materials is spendable cash.");
  assert.equal(life.character!.skills.pottery, pottery + 2);
  assert.equal(life.character!.jobId, "porter", "A commission does not silently replace the main job.");
  assert.throws(() => engine.act(life, "small-carving-order"), /activity.*year|already/i);
  assert.equal(availability(engine, ageTo(engine, life, 19), "small-pottery-order").available, false, "The two-year commission cooldown remains in force.");
  life = engine.act(ageTo(engine, life, 19), "work-ceramic-decorator");
  assert.equal(life.character!.jobId, "ceramic-decorator");
  life = engine.orderMarket(life, { side: "buy", asset: "clay", quantity: 4 });
  const startCash = life.economy!.cash;
  life = engine.advance(life);
  assert.equal(life.economy!.cash, startCash, "Independent craft creates stock for sale rather than an automatic salary.");
  assert.ok(life.economy!.assets["pottery-goods"] > 0, "The purchased clay supplies the first year of regular craft work.");
  assert.ok(life.character!.skills.pottery > pottery + 2);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("every new commission pays without changing employment or granting an appointment", () => {
  const engine = createEngine(controlledWorld());
  for (const id of commissionIds) {
    let life = structuredClone(ageTo(engine, engine.start(`cross-job-${id}`), 40));
    for (const skill of Object.keys(life.character!.skills)) life.character!.skills[skill] = 100;
    life.character!.jobId = "porter";
    const before = life.economy!.cash;
    assert.equal(availability(engine, life, id).available, true, availability(engine, life, id).reason);
    life = engine.act(life, id);
    assert.equal(life.character!.jobId, "porter");
    assert.ok(life.economy!.cash > before, id);
    assert.equal(life.character!.lastActivityAge, 40);
    assert.equal(life.flags["court-appointed"], false);
  }
});

test("commissions enforce training, material cash and age while sky-omen work uses its revised period", () => {
  const engine = createEngine(controlledWorld());
  const life = structuredClone(ageTo(engine, engine.start("commission-requirements"), 14));
  assert.equal(availability(engine, life, "small-pottery-order").available, false);
  life.character!.skills.pottery = 20;
  life.character!.skills.craft = 15;
  assert.equal(availability(engine, life, "small-pottery-order").available, true);
  life.economy!.cash = 9;
  assert.equal(availability(engine, life, "small-pottery-order").available, false);
  assert.throws(() => engine.act(life, "small-pottery-order"), /unavailable|requires/i);
  life.economy!.cash = 10;
  assert.equal(availability(engine, life, "small-pottery-order").available, true);
  life.age = 13;
  life.year = yearAtAge(pack.startYear, 13);
  assert.equal(availability(engine, life, "small-pottery-order").available, false);
  life.age = 17;
  life.year = yearAtAge(pack.startYear, 17);
  life.economy!.cash = 100;
  for (const skill of Object.keys(life.character!.skills)) life.character!.skills[skill] = 100;
  assert.equal(availability(engine, life, "prepare-a-chart-reading").available, false);
  life.age = 18;
  life.year = yearAtAge(pack.startYear, 18);
  assert.equal(availability(engine, life, "prepare-a-chart-reading").available, true);
});

test("qualified specialist interests appear in the existing career decision", () => {
  const engine = createEngine(pack);
  const life = structuredClone(engine.start("specialist-job-offers"));
  life.age = 16;
  life.year = yearAtAge(pack.startYear, 16);
  life.phase = "choice";
  life.pendingEventId = "a-place-on-the-manifest";
  life.character!.jobId = "porter";
  let choices = engine.getChoices(life);
  assert.equal(choices.some(choice => choice.id === "interest-career-ceramic-decorator"), false);
  life.character!.skills.craft = 15;
  life.character!.skills.pottery = 20;
  choices = engine.getChoices(life);
  assert.equal(choices.some(choice => choice.id === "interest-career-ceramic-decorator"), true);
  assert.equal(choices.some(choice => choice.id === "keep-regular-job"), true);
  assert.equal(engine.choose(life, "keep-regular-job").character!.jobId, "porter");
  assert.equal(engine.choose(life, "interest-career-ceramic-decorator").character!.jobId, "ceramic-decorator");
  life.character!.skills.philosophy = 100;
  life.character!.skills.literacy = 100;
  life.character!.skills.oratory = 100;
  assert.equal(engine.getChoices(life).some(choice => choice.id === "interest-career-philosophy-tutor"), false, "Skill does not bypass the occupation's age requirement.");
});

test("interest careers retain the earlier training, job, mortality and historical rules", () => {
  // Compare the original interest-career release; causal health deliberately
  // updates medical effects and descriptions in the current world.
  assert.deepEqual(interestRelease.character.skills, previous.character.skills);
  assert.deepEqual(interestRelease.character.jobs, previous.character.jobs);
  assert.deepEqual(interestRelease.mortality, previous.mortality);
  assert.deepEqual(interestRelease.sources, previous.sources);
  for (const activity of previous.character.activities) {
    assert.deepEqual(interestRelease.character.activities.find(candidate => candidate.id === activity.id), activity);
  }
  const historic = (world: WorldPack) => world.events.filter(event => event.trigger.type === "year");
  assert.deepEqual(historic(interestRelease as WorldPack), historic(previous as WorldPack));
});
