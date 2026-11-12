import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import { buildDeepSkillWorld } from "../src/deep-capabilities/world.ts";
import { capabilityRewards, quoteCapabilityProduction } from "../src/deep-capabilities/rewards.ts";
import { deepInventory } from "../src/deep-capabilities/actions.ts";
import base from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import type { WorldPack, LifeState } from "../src/types.ts";

// Generous authored resources and high scores isolate proof reachability, not normal-life balance.
function route(starter: "garment" | "vessel" | "clay-model") {
  const world = buildDeepSkillWorld(base as unknown as WorldPack);
  delete world.knowledge; delete world.demo!.startingResources; delete world.health!.mortalityCalibration;
  for (const band of world.health!.incidenceBands) band.annualProbability = 0;
  for (const band of world.health!.declineBands) band.healthLoss = 0;
  for (const band of world.mortality!.bands) band.annualProbability = 0;
  const interrupts = new Set([world.health!.careDecision, ...Object.values(world.economy!.moneylender!.events)]);
  world.events = world.events.filter(event => interrupts.has(event.id)); world.yearlyRules = []; world.yearlyEffects = [];
  for (const definition of Object.values(world.stats)) delete definition.initialRange;
  for (const definition of Object.values(world.character!.skills)) definition.initial = 100;
  world.stats.health.initial = 100; world.stats.wealth.initial = 100; world.economy!.unitsPerPoint = 1000;
  world.demo!.household.startingGrain = 15000; world.demo!.household.storeCapacity = 1000000; world.demo!.household.spoilageBps = 0;
  world.origins = [{ id: "artisan-route", title: "Established workshop", text: "Mechanics fixture with explicit funding.", weight: 1, effects: [] }];
  const engine = createEngine(world);
  let life = engine.start("artisan-" + starter);
  const ready = () => { while (life.phase === "choice") life = engine.choose(life, engine.getChoices(life)[0].id); };
  const next = () => { life = engine.advance(life); ready(); };
  const act = (id: string) => { life = engine.act(life, "v-" + id); };
  const ensure = (item: string, quantity: number) => {
    const entry = Object.entries(world.vocations!.actions).find(([, action]) => action.kind === "buy" && action.item === item);
    assert.ok(entry, "No supplier for " + item);
    while ((deepInventory(life)[item] ?? 0) < quantity) {
      const available = engine.getActivities(life).find(activity => activity.id === "v-" + entry[0])!;
      if (!available.available) { assert.match(available.reason ?? "", /age|again|year/i); next(); }
      act(entry[0]);
    }
  };
  const make = (recipe: string, quantity?: number, inspected = false) => {
    const quote = quoteCapabilityProduction(capabilityRewards(Object.keys(life.deepCapabilities!.learned)), world.vocations!.recipes[recipe], { recipeId: recipe, quantity, inspected });
    assert.ok(quote.allowed, quote.reason);
    for (const [item, count] of Object.entries(quote.inputs)) ensure(item, count);
    const id = "make-" + recipe + (quantity ? "-" + quantity : "") + (inspected ? "-inspected" : "");
    for (let year = 0; year < quote.workYears; year++) { act(id); if (year + 1 < quote.workYears) next(); }
  };
  while (life.age < 18) next();
  act("cap-tool-practice"); next(); act("cap-measurement-exercise");
  const material = starter === "garment" ? "flax" : "clay";
  for (let year = 0; year < 2; year++) { next(); ensure(material, 1); act("cap-prepare-" + (starter === "garment" ? "textiles" : "clay")); }
  for (let year = 0; year < 2; year++) { next(); make(starter); }
  assert.ok(life.deepCapabilities!.learned.A4);
  return { world, engine, next, act, ensure, make, get life() { return life; } };
}

test("clothing reaches a registered AT10 masterwork through actual paid inspected production", () => {
  const run = route("garment");
  for (let year = 0; year < 2; year++) { run.next(); run.make("garment", undefined, true); }
  assert.ok(run.life.deepCapabilities!.learned.AT6);
  for (let year = 0; year < 2; year++) {
    run.next(); run.act("cap-commission-garment"); run.make("garment", undefined, true); run.act("cap-deliver-commission");
  }
  assert.ok(run.life.deepCapabilities!.learned.AT7);
  for (let year = 0; year < 2; year++) { run.next(); run.make("garment", 4, true); }
  assert.ok(run.life.deepCapabilities!.learned.AT8);
  for (let year = 0; year < 2 && !run.life.deepCapabilities!.learned.AT9; year++) {
    run.next(); run.act("cap-commission-garment"); run.make("garment", undefined, true); run.act("cap-deliver-commission");
  }
  assert.ok(run.life.deepCapabilities!.learned.AT9);
  run.act("cap-register-at10");
  for (let year = 0; year < 2; year++) { run.next(); run.make("ceremonial-garment", 4, true); }
  run.act("cap-submit-at10");
  assert.ok(run.life.deepCapabilities!.learned.AT10);
  assert.deepEqual(run.engine.replay(run.life.seed, run.life.commands), run.life);
  run.next(); run.ensure("linen", 1); run.ensure("thread", 1);
  const before = run.life.economy!.cash; run.act("cap-service-garment-repair");
  assert.equal(run.life.economy!.cash, before + 22);
});

test("ceramics reaches AC10 through matched commissions and two assessed decorated batches", () => {
  const run = route("vessel");
  for (let year = 0; year < 2; year++) { run.next(); run.make("vessel", undefined, true); }
  assert.ok(run.life.deepCapabilities!.learned.AC6);
  for (let year = 0; year < 2; year++) {
    run.next(); run.act("cap-commission-vessel"); run.make("vessel", 4, true); run.act("cap-deliver-commission");
  }
  assert.ok(run.life.deepCapabilities!.learned.AC7);
  for (let year = 0; year < 2; year++) { run.next(); run.make("vessel", 8, true); }
  assert.ok(run.life.deepCapabilities!.learned.AC9);
  run.act("cap-register-ac10");
  for (let year = 0; year < 2; year++) { run.next(); run.make("decorated-vessel", 8, true); }
  run.act("cap-submit-ac10");
  assert.ok(run.life.deepCapabilities!.learned.AC10);
  assert.deepEqual(run.engine.load(run.engine.save(run.life)), run.life);
});

test("sculpture reaches AS10 through reserved multi-year projects and a registered monument", () => {
  const run = route("clay-model");
  run.next(); run.make("clay-model");
  run.next(); run.ensure("timber", 1); run.act("cap-wood-relief-practice");
  assert.ok(run.life.deepCapabilities!.learned.AS5);
  for (let year = 0; year < 2; year++) { run.next(); run.make("small-relief", undefined, true); }
  assert.ok(run.life.deepCapabilities!.learned.AS6);
  for (let year = 0; year < 2; year++) { run.next(); run.make("stone-figure", undefined, true); }
  assert.ok(run.life.deepCapabilities!.learned.AS7);
  run.next(); run.make("bust", undefined, true);
  run.next(); run.act("cap-project-budget");
  assert.ok(run.life.deepCapabilities!.learned.AS8);
  run.next(); run.act("cap-commission-large-relief"); run.make("large-relief", undefined, true); run.act("cap-deliver-commission");
  assert.ok(run.life.deepCapabilities!.learned.AS9);
  run.act("cap-register-as10"); run.next(); run.make("monument", undefined, true); run.act("cap-submit-as10");
  assert.ok(run.life.deepCapabilities!.learned.AS10);
  assert.deepEqual(run.engine.replay(run.life.seed, run.life.commands), run.life);
  run.next(); run.ensure("stone", 1); run.ensure("pigment", 1);
  const cash = run.life.economy!.cash; run.act("cap-service-restoration");
  assert.equal(run.life.economy!.cash, cash - 5);
  run.next(); const continuingCash = run.life.economy!.cash; run.act("cap-service-restoration");
  assert.equal(run.life.economy!.cash, continuingCash + 80);
});
