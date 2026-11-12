import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/engine.ts";
import { demoContext } from "../src/demo/state.ts";
import { feedHousehold, harvest, spoilAndSpin } from "../src/demo/household.ts";
import { orderValue } from "../src/demo/market-depth.ts";
import { validateWorld } from "../src/validate.ts";
import type { DemoContext } from "../src/demo/types.ts";
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const SEED_PER_PLOT = 10;

/** lives-4 with the survival rules on or off, so each rule is compared against its own absence. */
function worldWith(rules: boolean): WorldPack {
  const world = structuredClone(shipped) as unknown as WorldPack;
  const household = world.demo!.household as typeof world.demo.household & { buySeedWhenShort?: boolean; leaseUnworkedBps?: number };
  if (rules) Object.assign(household, { buySeedWhenShort: true, leaseUnworkedBps: 5000 });
  else { delete household.buySeedWhenShort; delete household.leaseUnworkedBps; }
  return world;
}
const on = worldWith(true), off = worldWith(false);
const base = createEngine(on).start("household-survival") as LifeStateWithDemo;

interface Draft { life: LifeStateWithDemo; ctx: DemoContext; lines: { id: string; text: string }[] }

/** A single adult heading the plot: parents gone, unmarried, no children, no job. */
function draft(world: WorldPack, shape: (life: LifeStateWithDemo) => void): Draft {
  const life = structuredClone(base);
  life.age = 30;
  life.character!.jobId = null;
  life.character!.relationshipStatus = "single";
  life.character!.children = [];
  life.demo.household.parents = "gone";
  life.demo.household.headSinceAge = 20;
  life.demo.household.flaxPlots = 0;
  shape(life);
  const lines: { id: string; text: string }[] = [];
  const ctx = demoContext(world, life, effects => {
    for (const effect of effects) {
      if (effect.type === "cash") life.economy!.cash = Math.max(0, life.economy!.cash + effect.delta);
      if (effect.type === "stat") life.stats[effect.stat] = Math.max(0, life.stats[effect.stat] + effect.delta);
    }
  }, (id, text) => lines.push({ id, text }));
  return { life, ctx, lines };
}

const seedFor = (life: LifeState & LifeStateWithDemo) => (life.demo.household.plots - life.demo.household.flaxPlots) * SEED_PER_PLOT;

test("a short store buys next year's seed together with the food", () => {
  const shape = (life: LifeStateWithDemo) => { life.demo.household.grain = 0; life.economy!.cash = 10_000; };
  const withRule = draft(on, shape);
  feedHousehold(withRule.ctx);
  assert.ok(withRule.life.demo.household.grain >= seedFor(withRule.life), "seed (with room for spoilage) stays in the store after eating");
  assert.ok(withRule.lines.some(line => line.id === "household-bought-seed"), withRule.lines.map(line => line.id).join(", "));
  const without = draft(off, shape);
  feedHousehold(without.ctx);
  assert.equal(without.life.demo.household.grain, 0, "older rules buy only what is eaten");
});

test("food comes before seed when money is short", () => {
  const withRule = draft(on, life => { life.demo.household.grain = 0; life.economy!.cash = 0; });
  // Exactly one adult ration at the merchant's price (lives-4 prices the order as it fills).
  withRule.life.economy!.cash = orderValue(on.demo!, withRule.life.demo, "grain", "buy", 240).total;
  feedHousehold(withRule.ctx);
  assert.equal(withRule.life.demo.household.lastShortfallBps, 0, "nobody goes hungry");
  assert.equal(withRule.life.demo.household.grain, 0, "no seed could be afforded");
});

test("a plot with no seed in store lies fallow and the journal says why", () => {
  const shape = (life: LifeStateWithDemo) => { life.demo.household.grain = 0; life.vocations!.workedAge = 29; };
  const withRule = draft(on, shape);
  harvest(withRule.ctx);
  assert.match(withRule.lines.find(line => line.id === "household-harvest")!.text, /no seed/i);
  const without = draft(off, shape);
  harvest(without.ctx);
  assert.match(without.lines.find(line => line.id === "household-harvest")!.text, /No one could work the household plot/);
});

test("a household that cannot work its plot leases the unworked share for half the crop, and no grain is created", () => {
  const away = (life: LifeStateWithDemo) => { life.demo.household.grain = 1000; life.vocations!.workedAge = 29; };
  // The whole plot's crop at full labour: the old rules with enough hands (spouse and grown children).
  const full = draft(off, life => {
    away(life); life.vocations!.workedAge = undefined as unknown as number; life.character!.jobId = "tenant-farmer";
    life.character!.relationshipStatus = "married";
    life.character!.children = [0, 1, 2].map(i => ({ id: `child-${i}`, name: `Child ${i}`, birthAge: 10, otherParentId: "spouse" }));
  });
  const fullBefore = full.life.demo.household.grain;
  harvest(full.ctx);
  const fullCrop = full.life.demo.household.grain - fullBefore + seedFor(full.life);

  const leased = draft(on, away);
  const before = leased.life.demo.household.grain, growerBefore = leased.life.demo.town.grower.grain;
  harvest(leased.ctx);
  const householdShare = leased.life.demo.household.grain - before + seedFor(leased.life);
  const neighbourShare = leased.life.demo.town.grower.grain - growerBefore;
  assert.ok(householdShare > 0, "the household still harvests");
  assert.equal(householdShare + neighbourShare, fullCrop, "the two shares make exactly the worked plot's crop");
  assert.ok(Math.abs(householdShare - neighbourShare) <= 1, `${householdShare} vs ${neighbourShare}`);
  assert.match(leased.lines.find(line => line.id === "household-lease")?.text ?? "", /neighbour/i);

  const without = draft(off, away);
  const offBefore = without.life.demo.household.grain;
  harvest(without.ctx);
  assert.equal(without.life.demo.household.grain - offBefore + seedFor(without.life), 0, "older rules leave the plot fallow");
});

test("the new free-play world uses the survival rules and the retained world does not", () => {
  const household = (shipped as unknown as WorldPack).demo!.household as Record<string, unknown>;
  assert.equal(household.buySeedWhenShort, true);
  assert.equal(household.leaseUnworkedBps, 5000);
  const kept = (retained as unknown as WorldPack).demo!.household as Record<string, unknown>;
  assert.equal(kept.buySeedWhenShort, undefined);
  assert.equal(kept.leaseUnworkedBps, undefined);
});

test("survival rule values are validated", () => {
  for (const [key, value] of [["leaseUnworkedBps", 12_000], ["leaseUnworkedBps", -1], ["buySeedWhenShort", "yes"]] as const) {
    const world = worldWith(true);
    (world.demo!.household as Record<string, unknown>)[key] = value;
    assert.throws(() => validateWorld(world), new RegExp(key), `${key} = ${value}`);
  }
});

test("the seed bought for next year survives the year's spoilage", () => {
  const withRule = draft(on, life => { life.demo.household.grain = 0; life.economy!.cash = 10_000; });
  feedHousehold(withRule.ctx);
  spoilAndSpin(withRule.ctx);
  assert.ok(withRule.life.demo.household.grain >= seedFor(withRule.life), `${withRule.life.demo.household.grain} left for ${seedFor(withRule.life)} seed`);
});
