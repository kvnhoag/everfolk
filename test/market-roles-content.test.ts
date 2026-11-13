import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { withoutMoneylender } from "./fixture-features.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };
import retained from "../worlds/alexandria-0.39.0.json" with { type: "json" };

const world = current as WorldPack;
const broadRoles = ["trader", "shopkeeper", "merchant", "estate-steward", "quartermaster"];

function controlledWorld(): WorldPack {
  const pack = withoutMoneylender(structuredClone(world));
  // Occupation thresholds are tested independently of birth-route restrictions.
  if (pack.royalty) pack.royalty.originId = "fixture-unselected-royal-origin";
  if (pack.aristocracy) pack.aristocracy.originId = "fixture-unselected-estate-origin";
  pack.events = pack.events.filter(event => event.id === pack.health!.careDecision);
  pack.economy!.market!.shocks = [];
  pack.yearlyEffects = []; pack.yearlyRules = [];
  for (const band of pack.mortality!.bands) band.annualProbability = 0;
  for (const band of pack.health!.incidenceBands) band.annualProbability = 0;
  for (const band of pack.health!.declineBands) band.healthLoss = 0;
  for (const definition of Object.values(pack.character!.skills)) definition.initial = definition.max;
  for (const origin of pack.origins) {
    origin.statRanges!.health = { min: 90, max: 90 };
    origin.statRanges!.wealth = { min: 100, max: 100 };
    origin.assetRanges!.clay = { min: 5, max: 5 };
  }
  pack.character!.activities.push({ id: "fixture-clerk-post", text: "Accept the fixture clerk's post.", category: "career", minAge: 18, usesYearlyActivity: false,
    outcomes: [{ id: "fixture-clerk-accepted", text: "A clerk's post is accepted.", weight: 1, effects: [{ type: "job", job: "clerk" }] }] },
  { id: "fixture-supply-recommendation", text: "Receive the fixture supply recommendation.", category: "career", minAge: 18, usesYearlyActivity: false,
    outcomes: [{ id: "fixture-recommendation-earned", text: "Supply work earns a recommendation.", weight: 1, effects: [{ type: "flag", flag: "officer-recommendation", value: true }] }] });
  return pack;
}

function adult(engine: LifeEngine): LifeState {
  let life = engine.start("market-role-entry");
  for (let index = 0; ["estate-household", "royal-household"].includes(life.originId); index++) life = engine.start(`market-role-entry-${index}`);
  while (life.age < 18) life = engine.advance(life);
  return life;
}

test("broad catalogue access belongs to purchasing and resale roles", () => {
  validateWorld(world);
  assert.deepEqual(world.character!.jobs.filter(job => job.marketAccess === "full").map(job => job.id).sort(), [...broadRoles].sort());
  for (const id of broadRoles) assert.match(world.character!.jobs.find(job => job.id === id)!.description, /market/);
  for (const id of ["clerk", "soldier", "officer", "general", "court-adviser", "weaver", "pottery-workshop-lead"]) {
    assert.equal(world.character!.jobs.find(job => job.id === id)!.marketAccess, undefined, `${id} keeps a focused market`);
  }
  const merchant = world.character!.jobs.find(job => job.id === "merchant")!;
  assert.ok(merchant.yearlyEffects.every(effect => effect.type !== "cash" && !(effect.type === "stat" && effect.stat === "wealth")));
});

test("merchant entry requires earned trade experience and preserves existing orders", () => {
  const engine = createEngine(controlledWorld()); let life = adult(engine);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "work-merchant")!.available, false);
  assert.throws(() => engine.act(life, "work-merchant"), /unavailable/);
  for (let year = 0; year < 3; year++) {
    life = engine.act(life, "focus-market-trading");
    life = engine.orderMarket(life, { side: "sell", asset: "clay", quantity: 1 });
    life = engine.advance(life);
  }
  assert.equal(life.flags["trader-qualified"], true);
  life = engine.orderMarket(life, { side: "buy", asset: "grain", quantity: 2 });
  const before = life;
  life = engine.act(life, "work-merchant");
  assert.equal(life.character!.jobId, "merchant");
  assert.equal(life.economy!.cash, before.economy!.cash);
  assert.deepEqual(life.economy!.market!.orders, before.economy!.market!.orders);
  assert.deepEqual(life.economy!.assets, before.economy!.assets);
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("stewardship needs a household connection or clerk's work in addition to skills", () => {
  const engine = createEngine(controlledWorld()); let life = adult(engine);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "work-estate-steward")!.available, false);
  life = engine.act(life, "fixture-clerk-post");
  assert.equal(engine.getActivities(life).find(activity => activity.id === "work-estate-steward")!.available, true);
  life = engine.act(life, "work-estate-steward");
  assert.equal(life.character!.jobId, "estate-steward");
  const cash = life.economy!.cash;
  life = engine.advance(life);
  assert.ok(life.economy!.cash >= cash + 30, "Stewardship earns the authored wage, with no material purchase required for employer work.");
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("quartermaster entry cannot bypass a supply recommendation or previous command", () => {
  const engine = createEngine(controlledWorld()); let life = adult(engine);
  assert.equal(engine.getActivities(life).find(activity => activity.id === "work-quartermaster")!.available, false);
  assert.throws(() => engine.act(life, "work-quartermaster"), /unavailable/);
  life = engine.act(life, "fixture-supply-recommendation");
  assert.equal(engine.getActivities(life).find(activity => activity.id === "work-quartermaster")!.available, true);
  life = engine.act(life, "work-quartermaster");
  assert.equal(life.character!.jobId, "quartermaster");
  assert.notEqual(life.character!.jobId, "officer");
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("background and recommendation do not waive occupation skill thresholds", () => {
  const pack = controlledWorld();
  for (const definition of Object.values(pack.character!.skills)) definition.initial = definition.min;
  pack.character!.skills.literacy.initial = 20;
  pack.character!.skills.reckoning.initial = 20;
  for (const origin of pack.origins) origin.effects = origin.effects.filter(effect => effect.type !== "skill");
  const engine = createEngine(pack); let life = adult(engine);
  life = engine.act(life, "fixture-supply-recommendation");
  assert.equal(engine.getActivities(life).find(activity => activity.id === "work-quartermaster")!.available, false);
  life = engine.act(life, "fixture-clerk-post");
  assert.equal(engine.getActivities(life).find(activity => activity.id === "work-estate-steward")!.available, false);
  let connected = engine.start("estate-skill-threshold");
  for (let index = 0; connected.originId !== "estate-household"; index++) connected = engine.start(`estate-skill-threshold-${index}`);
  while (connected.age < 18) connected = engine.advance(connected);
  assert.equal(engine.getActivities(connected).find(activity => activity.id === "work-estate-steward")!.available, false, "An estate background still needs the full skill threshold.");
});

test("new purchasing roles have real supply tasks and the previous revision remains exact", async () => {
  for (const [id, taskId] of [["merchant", "fulfil-shop-parcel"], ["estate-steward", "check-estate-supply-order"], ["quartermaster", "repair-service-equipment"]]) {
    assert.ok(world.economy!.assets.some(asset => asset.context?.jobs?.includes(id)));
    const task = world.character!.activities.find(activity => activity.id === taskId)!;
    assert.match(JSON.stringify(task.when), new RegExp(`"job":"${id}"`));
    assert.ok(task.outcomes.every(outcome => outcome.effects.some(effect => effect.type === "asset" && effect.delta < 0)));
  }
  assert.equal(retained.version, "0.39.0");
  assert.equal(retained.character.jobs.length, 30);
  assert.ok(retained.character.jobs.every(job => !Object.hasOwn(job, "marketAccess")));
  const engine = createEngine(retained), life = engine.start("retained-resource-rules");
  const { engineForLife } = await import("../client/lib/world-session.ts");
  const { getArchivedBuiltinWorld } = await import("../server/content.ts");
  assert.equal(engineForLife(life).fingerprint, engine.fingerprint);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!.pack, retained);
});
