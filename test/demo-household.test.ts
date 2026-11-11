import { test } from "node:test";
import assert from "node:assert/strict";
import { demoEngine, liveUntil } from "./fixtures/demo/world.ts";
import { demoContext } from "../src/demo/state.ts";
import {
  advanceFamily, applyPlan, feedHousehold, harvest, householdView, labourUnits, mouths, payRent, spoilAndSpin,
} from "../src/demo/household.ts";
import { applyDemoEffect } from "../src/demo/effects.ts";
import type { DemoContext, DemoState } from "../src/demo/types.ts";
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
import type { Effect, LifeState } from "../src/types.ts";

const engine = demoEngine();
const world = engine.world;
const def = world.demo!;
const h = def.household;
const base = engine.start("household-base") as LifeStateWithDemo;

interface Draft { life: LifeStateWithDemo; ctx: DemoContext; applied: Effect[]; lines: { id: string; text: string }[] }

/** A private draft of a real demo life, shaped by `shape`, with a context that records effects and journal lines. */
function draft(shape: (life: LifeStateWithDemo, demo: DemoState) => void = () => {}): Draft {
  const life = structuredClone(base) as LifeStateWithDemo;
  shape(life, life.demo);
  const applied: Effect[] = [], lines: { id: string; text: string }[] = [];
  const ctx = demoContext(world, life, effects => {
    for (const effect of effects) {
      applied.push(effect);
      if (effect.type === "stat") life.stats[effect.stat] = Math.max(0, life.stats[effect.stat] + effect.delta);
      if (effect.type === "cash") life.economy!.cash = Math.max(0, life.economy!.cash + effect.delta);
    }
  }, (id, text) => lines.push({ id, text }));
  return { life, ctx, applied, lines };
}

/** Adult head of the plot: tenant farmer, married, parents gone, `kids` children of the given ages. */
function adultHousehold(life: LifeStateWithDemo, demo: DemoState, kids: number[] = [], job: string | null = "tenant-farmer"): void {
  life.age = 30;
  life.character!.jobId = job;
  life.character!.relationshipStatus = "married";
  life.character!.partnerId = "spouse";
  life.character!.skills.farming = 20;
  life.character!.children = kids.map((age, i) => ({ id: `child-${i + 1}`, name: `Child ${i + 1}`, birthAge: life.age - age, otherParentId: "spouse" }));
  demo.household.parents = "gone";
  demo.household.headSinceAge = 20;
}

function settleFarm(ctx: DemoContext): void {
  harvest(ctx);
  payRent(ctx);
  feedHousehold(ctx);
}

const healthStat = world.health?.stat ?? "health";

test("a normal year: two adults on two plots feed a household of five with a modest surplus", () => {
  const { life, ctx, lines } = draft((life, demo) => { adultHousehold(life, demo, [6, 4, 2]); demo.household.grain = 200; });
  assert.equal(mouths(def, life), 5);
  settleFarm(ctx);
  const surplus = life.demo.household.grain - 200;
  assert.ok(surplus > 0, `expected a surplus, got ${surplus}`);
  assert.ok(surplus < 600, `expected a modest surplus, got ${surplus}`);
  assert.equal(life.demo.household.lastShortfallBps, 0);
  assert.ok(lines.some(line => /harvest/i.test(line.text)));
  assert.ok(lines.some(line => /rent/i.test(line.text)));
  assert.ok(lines.some(line => /eat/i.test(line.text)));
  for (const line of lines) assert.doesNotMatch(line.text, /token|chain|wallet|crypto|nft/i);
});

test("a low flood with an empty store and no cash leaves the household hungry, within the health cap", () => {
  const { life, ctx, applied, lines } = draft((life, demo) => {
    adultHousehold(life, demo, [6, 4, 2]);
    demo.year.flood = "low";
    demo.household.grain = 0;
    life.economy!.cash = 0;
    demo.town.merchant.grain = 0;
  });
  const before = life.stats[healthStat];
  settleFarm(ctx);
  assert.ok(life.demo.household.lastShortfallBps > 0);
  const loss = before - life.stats[healthStat];
  assert.ok(loss > 0 && loss <= h.hungerHealthCap, `health loss ${loss}`);
  assert.ok(applied.every(effect => effect.type !== "stat" || effect.delta >= -h.hungerHealthCap));
  assert.ok(lines.some(line => /hungry|short/i.test(line.text)));
  assert.equal(life.demo.household.grain, 0);
});

test("the same low flood with 1000 measures stored causes no hunger", () => {
  const { life, ctx } = draft((life, demo) => { adultHousehold(life, demo, [6, 4, 2]); demo.year.flood = "low"; demo.household.grain = 1000; });
  const before = life.stats[healthStat];
  settleFarm(ctx);
  assert.equal(life.demo.household.lastShortfallBps, 0);
  assert.equal(life.stats[healthStat], before);
});

test("zero grain, zero cash and an empty merchant never crash or go negative", () => {
  const { life, ctx } = draft((life, demo) => {
    adultHousehold(life, demo, [6, 4], "soldier");
    life.character!.relationshipStatus = "single";
    demo.year.flood = "low";
    demo.household.grain = 0; demo.household.animals.ox = 1; demo.household.animals.donkey = 1;
    life.economy!.cash = 0;
    demo.town.merchant.grain = 0; demo.town.merchant.cash = 0;
  });
  settleFarm(ctx);
  spoilAndSpin(ctx);
  advanceFamily(ctx);
  const hh = life.demo.household;
  for (const value of [hh.grain, hh.flax, hh.animals.ox, hh.animals.donkey, hh.lastShortfallBps, life.economy!.cash]) {
    assert.ok(Number.isSafeInteger(value) && value >= 0, `bad amount ${value}`);
  }
  assert.ok(hh.lastShortfallBps <= 10_000);
});

test("a soldier's labour is absent from the harvest and the soldier eats army rations", () => {
  const farmer = draft((life, demo) => adultHousehold(life, demo, [6]));
  const soldier = draft((life, demo) => adultHousehold(life, demo, [6], "soldier"));
  assert.equal(labourUnits(def, farmer.life) - labourUnits(def, soldier.life), 100);
  assert.equal(mouths(def, farmer.life) - mouths(def, soldier.life), 1);
  harvest(farmer.ctx); harvest(soldier.ctx);
  assert.ok(soldier.life.demo.household.grain < farmer.life.demo.household.grain);
});

test("a child helps from childHelpAge while the parents run the plot", () => {
  const young = draft(life => { life.age = h.childHelpAge - 1; });
  const helper = draft(life => { life.age = h.childHelpAge; });
  assert.equal(labourUnits(def, young.life), 200);
  assert.equal(labourUnits(def, helper.life), 240);
  const farmhand = draft(life => { life.age = 12; life.character!.jobId = "farmhand"; });
  assert.equal(labourUnits(def, farmhand.life), 300);
  const head = draft((life, demo) => { life.age = 25; demo.household.parents = "retired"; demo.household.headSinceAge = 20; });
  assert.equal(labourUnits(def, head.life), 100 + 2 * Math.floor(100 * (h.retiredParentLabourBps ?? 0) / 10000), "the head works the plot with the parents' remaining help");
});

test("children eat childRationBps of an adult ration and help from childHelpAge, fully from childWorkAge", () => {
  const none = draft((life, demo) => adultHousehold(life, demo, []));
  const small = draft((life, demo) => adultHousehold(life, demo, [h.childHelpAge - 1]));
  const helping = draft((life, demo) => adultHousehold(life, demo, [h.childHelpAge]));
  const working = draft((life, demo) => adultHousehold(life, demo, [h.childWorkAge]));
  assert.equal(labourUnits(def, small.life), labourUnits(def, none.life));
  assert.equal(labourUnits(def, helping.life) - labourUnits(def, none.life), 40);
  assert.equal(labourUnits(def, working.life) - labourUnits(def, none.life), 100);
  const eat = (d: Draft) => householdView(def, d.life).expectedEating;
  assert.equal(eat(small) - eat(none), Math.floor(h.adultRation * h.childRationBps / 10_000));
  assert.equal(eat(working) - eat(none), h.adultRation);
});

test("parents hand over at marriage, retire, and stop eating after parentsStopEatingAfterYears", () => {
  const married = draft(life => { life.age = 17; life.character!.relationshipStatus = "married"; life.character!.partnerId = "spouse"; });
  advanceFamily(married.ctx);
  assert.equal(married.life.demo.household.parents, "retired");
  assert.equal(married.life.demo.household.headSinceAge, 17);
  assert.ok(married.lines.some(line => /plot/i.test(line.text)));

  const single = draft(life => { life.age = h.handOverAge - 1; });
  advanceFamily(single.ctx);
  assert.equal(single.life.demo.household.parents, "working");
  single.life.age = h.handOverAge;
  advanceFamily(single.ctx);
  assert.equal(single.life.demo.household.parents, "retired");
  assert.equal(single.life.demo.household.headSinceAge, h.handOverAge);
  const retiredMouths = mouths(def, single.life);
  single.life.age = h.handOverAge + h.parentsStopEatingAfterYears - 1;
  advanceFamily(single.ctx);
  assert.equal(single.life.demo.household.parents, "retired");
  single.life.age = h.handOverAge + h.parentsStopEatingAfterYears;
  advanceFamily(single.ctx);
  assert.equal(single.life.demo.household.parents, "gone");
  assert.equal(retiredMouths - mouths(def, single.life), 2);
  assert.ok(single.lines.length >= 2);
});

test("the marriage gift arrives once", () => {
  const { life, ctx, lines } = draft(life => { life.age = 22; life.character!.relationshipStatus = "married"; life.character!.partnerId = "spouse"; });
  const gift = h.marriageGift;
  const before = gift.item === "grain" ? life.demo.household.grain : life.demo.goods[gift.item];
  advanceFamily(ctx);
  // The engine records journal lines on the life; mirror that so the next call sees the earlier gift.
  for (const line of lines) life.journal.push({ type: "event", id: line.id, text: line.text, age: life.age, year: life.year });
  life.age += 1;
  advanceFamily(ctx);
  const after = gift.item === "grain" ? life.demo.household.grain : life.demo.goods[gift.item];
  assert.equal(after - before, gift.quantity);
  assert.equal(lines.filter(line => /gift/i.test(line.text)).length, 1);
});

test("applyPlan rejects more flax plots than plots and keeps valid plans", () => {
  const { life, ctx } = draft();
  assert.throws(() => applyPlan(ctx, { type: "plan", flaxPlots: life.demo.household.plots + 1 }), /flax/i);
  assert.equal(life.demo.household.flaxPlots, 0);
  applyPlan(ctx, { type: "plan", flaxPlots: 1 });
  assert.equal(life.demo.household.flaxPlots, 1);
  const engineLife = engine.demo(engine.start("plan-seed"), { type: "plan", flaxPlots: 1 });
  assert.equal(engineLife.demo!.household.flaxPlots, 1);
  assert.throws(() => engine.demo(engine.start("plan-seed"), { type: "plan", flaxPlots: 9 }), /flax/i);
});

test("flax plots reduce the grain harvest and add flax", () => {
  const grainOnly = draft((life, demo) => adultHousehold(life, demo, []));
  const withFlax = draft((life, demo) => { adultHousehold(life, demo, []); demo.household.flaxPlots = 1; });
  harvest(grainOnly.ctx); harvest(withFlax.ctx);
  assert.ok(withFlax.life.demo.household.grain < grainOnly.life.demo.household.grain);
  assert.ok(withFlax.life.demo.household.flax > 0);
  assert.equal(grainOnly.life.demo.household.flax, 0);
});

test("spare household labour spins flax into linen", () => {
  const { life, ctx, lines } = draft((life, demo) => { adultHousehold(life, demo, [15, 15]); demo.household.flax = 40; });
  assert.ok(labourUnits(def, life) > 100 * life.demo.household.plots);
  spoilAndSpin(ctx);
  assert.ok(life.demo.goods.linen > 0);
  assert.equal(life.demo.household.flax, 40 - life.demo.goods.linen * h.flaxPerLinen);
  assert.ok(lines.some(line => /linen/i.test(line.text)));
  const busy = draft((life, demo) => { adultHousehold(life, demo, []); demo.household.flax = 40; });
  spoilAndSpin(busy.ctx);
  assert.equal(busy.life.demo.goods.linen, 0);
});

test("animals are fed before people and an unfed animal dies", () => {
  const fed = draft((life, demo) => { adultHousehold(life, demo, []); demo.household.grain = h.animalFeed.ox + 10; demo.household.animals.ox = 1; life.economy!.cash = 0; demo.town.merchant.grain = 0; });
  feedHousehold(fed.ctx);
  assert.equal(fed.life.demo.household.animals.ox, 1);
  assert.ok(fed.life.demo.household.lastShortfallBps > 0);
  const starving = draft((life, demo) => { adultHousehold(life, demo, []); demo.household.grain = h.animalFeed.ox - 1; demo.household.animals.ox = 1; life.economy!.cash = 0; demo.town.merchant.grain = 0; });
  feedHousehold(starving.ctx);
  assert.equal(starving.life.demo.household.animals.ox, 0);
  assert.ok(starving.lines.some(line => /ox/i.test(line.text)));
});

test("spoilage over capacity uses overCapacitySpoilageBps", () => {
  const within = draft((life, demo) => { adultHousehold(life, demo, []); life.character!.skills.reckoning = 0; demo.household.grain = 1000; });
  spoilAndSpin(within.ctx);
  assert.equal(within.life.demo.household.grain, 1000 - Math.floor(1000 * h.spoilageBps / 10_000));
  const over = draft((life, demo) => { adultHousehold(life, demo, []); life.character!.skills.reckoning = 0; demo.household.grain = demo.household.capacity + 1000; });
  const cap = over.life.demo.household.capacity;
  spoilAndSpin(over.ctx);
  const expected = Math.floor(cap * h.spoilageBps / 10_000) + Math.floor(1000 * h.overCapacitySpoilageBps / 10_000);
  assert.equal(over.life.demo.household.grain, cap + 1000 - expected);
  assert.ok(over.lines.some(line => /spoil/i.test(line.text)));
});

test("a deed harvest bonus raises the next harvest once", () => {
  const plain = draft((life, demo) => adultHousehold(life, demo, []));
  const boosted = draft((life, demo) => adultHousehold(life, demo, []));
  applyDemoEffect(boosted.ctx, { kind: "harvest-bonus", bps: 2000 });
  harvest(plain.ctx); harvest(boosted.ctx);
  const plainGain = plain.life.demo.household.grain, boostedGain = boosted.life.demo.household.grain;
  assert.ok(boostedGain > plainGain);
  assert.equal(boosted.life.demo.household.harvestBonusBps, 0);
  const startAgain = boosted.life.demo.household.grain;
  harvest(boosted.ctx);
  assert.equal(boosted.life.demo.household.grain - startAgain, plainGain - base.demo.household.grain);
});

test("views never change the life or draw randomness, and predict the harvest", () => {
  const { life, ctx } = draft((life, demo) => { adultHousehold(life, demo, [6, 2]); demo.household.flaxPlots = 1; demo.household.animals.ox = 1; });
  life.age -= 1; // the view looks at the coming settlement, which runs at the next age
  const snapshot = JSON.stringify(life);
  const view = householdView(def, life);
  assert.equal(JSON.stringify(life), snapshot);
  assert.equal(view.labour, labourUnits(def, { ...life, age: life.age + 1 }));
  assert.ok(view.expectedHarvest > 0 && view.expectedRent > 0 && view.expectedEating > 0);
  life.age += 1;
  const before = life.demo.household.grain;
  harvest(ctx);
  assert.equal(life.demo.household.grain - before, view.expectedHarvest);
  const frozen = engine.start("view-seed");
  assert.doesNotThrow(() => householdView(def, frozen as LifeStateWithDemo));
});

test("the farming activities are in the world and train farming through the engine", () => {
  const ids = world.character!.activities.map(activity => activity.id);
  for (const id of ["work-farmhand", "work-tenant-farmer", "work-grain-dealer", "train-farming"]) assert.ok(ids.includes(id), id);
  assert.equal(world.character!.skills.farming.trainingActivity, "train-farming");
  const life = liveUntil(engine, "farm-activity-seed", state => state.age >= 12 && state.phase === "ready");
  assert.equal(life.phase, "ready");
  const hired = engine.act(life, "work-farmhand");
  assert.equal(hired.character!.jobId, "farmhand");
  const later = liveUntil(engine, "farm-train-seed", state => state.age >= 12 && state.phase === "ready");
  const trained = engine.act(later, "train-farming");
  assert.ok(trained.character!.skills.farming > later.character!.skills.farming);
});

test("advancing a demo life moves household grain and writes plain journal lines", () => {
  const life = liveUntil(engine, "household-engine-seed", state => state.age >= 9 && state.phase === "ready") as LifeState;
  assert.equal(life.phase, "ready");
  const before = life.demo!.household.grain;
  const next = engine.advance(life);
  assert.notEqual(next.demo!.household.grain, before);
  const newLines = next.journal.slice(life.journal.length).map(entry => entry.text).join("\n");
  assert.match(newLines, /harvest/i);
  assert.match(newLines, /eat/i);
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
});
