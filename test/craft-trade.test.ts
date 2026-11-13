/** Lives-4 craft trade: a full-time craftsperson's year pays a living margin; older worlds keep their rules. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/engine.ts";
import { applyVocation, vocationReason } from "../src/vocations/engine.ts";
import { bid } from "../src/vocations/view.ts";
import { settleVocationYear } from "../src/vocations/trade.ts";
import { depthQuote } from "../src/demo/market-depth.ts";
import { liveUntil } from "./fixtures/demo/world.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import type { LifeStateWithDemo } from "../src/demo/contracts.ts";
import shipped from "../worlds/demo/alexandria-lives-8.json" with { type: "json" };
import retained from "../worlds/demo/alexandria-lives-3.json" with { type: "json" };

const lives4 = shipped as unknown as WorldPack;
const lives3 = retained as unknown as WorldPack;
const adults = new Map<WorldPack, LifeState>();
function adult(world: WorldPack): LifeState {
  if (!adults.has(world)) adults.set(world, liveUntil(createEngine(world), "craft-trade", state => state.age >= 20 && state.phase === "ready"));
  return adults.get(world)!;
}
/** A copy with the given skill-tree steps learned, craft skill 40, cash 5,000 and an empty workshop. */
function craftsperson(world: WorldPack, learned: string[]): LifeState {
  const life = structuredClone(adult(world));
  life.capabilities!.learned = Object.fromEntries(learned.map(id => [id, { age: 18, year: life.year - 2 }]));
  delete life.capabilities!.project;
  delete life.vocations!.project;
  life.character!.skills.craft = 40;
  life.character!.skills.pottery = 40;
  life.vocations!.inventory = {};
  life.vocations!.lots = [];
  life.vocations!.workedAge = null;
  life.economy!.cash = 5000;
  return life;
}
const accounts = (life: LifeState): number => Object.values(life.vocations!.accounts).reduce((sum, value) => sum + value, 0);
const held = (life: LifeState, item: string): number => item === "linen" ? (life.demo?.goods.linen ?? 0) : life.vocations!.inventory[item] ?? 0;

/** One work year: make the batch (buying what is missing) and sell the finished lot. Returns the year's net. */
function workYear(world: WorldPack, life: LifeState, make: string, product: string): number {
  const before = life.economy!.cash;
  applyVocation(world, life, make);
  assert.ok(held(life, product) > 0, `made ${product}`);
  applyVocation(world, life, `sell-${product}`);
  assert.equal(held(life, product), 0, "the whole lot sells at one market visit");
  return life.economy!.cash - before;
}

/** A hired farmhand keeps half the crop of one plot; valued at the merchant's price for a small sale. */
function farmhandYear(world: WorldPack): number {
  const life = structuredClone(adult(world)) as LifeStateWithDemo;
  life.demo.year = { flood: "normal", army: "quiet", road: "safe", fresh: [] };
  life.demo.town.merchant.grain = world.demo!.market.targetGrainStock;
  life.demo.town.pressure = {};
  const half = Math.floor(world.demo!.household.yieldPerPlot / 2);
  return Math.floor(half * depthQuote(world.demo!, life.demo, "grain").bid / 100);
}

test("lives-4: a journeyman weaver's and potter's year out-earns a hired farmhand", () => {
  const farmhand = farmhandYear(lives4);
  assert.ok(farmhand >= 300, `farmhand ${farmhand}`);
  const weaver = workYear(lives4, craftsperson(lives4, ["A1", "A2", "A3", "A4", "AT5"]), "make-garment-batch-4", "garment");
  const potter = workYear(lives4, craftsperson(lives4, ["A1", "A2", "A3", "A4", "AC5"]), "make-vessel-batch-6", "vessel");
  assert.ok(weaver > farmhand, `weaver ${weaver} > farmhand ${farmhand}`);
  assert.ok(potter > farmhand, `potter ${potter} > farmhand ${farmhand}`);
});

test("lives-4: buying inputs, making and selling conserve money and goods", () => {
  const life = craftsperson(lives4, ["A1", "A2", "A3", "A4", "AT5"]);
  const total = (): number => life.economy!.cash + accounts(life);
  const before = total(), stock = life.vocations!.stock.linen, own = held(life, "linen");
  applyVocation(lives4, life, "make-garment-batch-4");
  assert.equal(total(), before, "what the household pays the supplier and workshop they receive");
  assert.equal(stock - life.vocations!.stock.linen + own, 8, "the 8 bolts woven in came from the household's store and the supplier's stock");
  assert.equal(held(life, "linen"), 0);
  assert.equal(held(life, "garment"), 4);
  applyVocation(lives4, life, "sell-garment");
  assert.equal(total(), before, "what the buyer pays the household receives");
});

test("lives-4: the merchant pays more of a finished good's value", () => {
  assert.ok(bid(lives4, "garment", 1) >= Math.floor(lives4.vocations!.recipes.garment.baseAsk * 0.9));
  assert.ok(bid(lives4, "garment", 1) > bid(lives3, "garment", 1));
});

test("lives-4: buyers return and the supplier restocks each year, paid from its finite account", () => {
  const life = craftsperson(lives4, ["A1", "A2", "A3", "A4", "AT5"]);
  const def = lives4.vocations!;
  life.vocations!.demand.garment = 0;
  life.vocations!.stock.linen = 10;
  const account = life.vocations!.accounts.merchant, stock = { ...life.vocations!.stock };
  const lines: string[] = [];
  settleVocationYear(lives4, life, (_id, text) => lines.push(text));
  assert.equal(life.vocations!.demand.garment, def.trade!.yearlyDemand.garment);
  assert.equal(life.vocations!.stock.linen, def.materials.linen.stock);
  const restocked = Object.entries(def.materials).reduce((sum, [id, material]) => sum + (life.vocations!.stock[id] - stock[id]) * material.price, 0);
  assert.ok(restocked >= 190 * def.materials.linen.price);
  assert.equal(account - life.vocations!.accounts.merchant, restocked, "the merchant pays outside suppliers exactly for what arrives");
  assert.ok(lines.length > 0);
});

test("older worlds keep one-at-a-time sales, bought inputs and their bid prices", () => {
  assert.equal(lives3.vocations!.trade, undefined);
  assert.equal(bid(lives3, "garment", 1), 80);
  const life = craftsperson(lives3, ["A1", "A2", "A3", "A4", "AT5"]);
  assert.equal(vocationReason(lives3, life, "make-garment-batch-4"), "Buy or make all the required materials first.");
  life.vocations!.inventory.garment = 3;
  life.vocations!.lots = [{ item: "garment", quality: 1, quantity: 3 }];
  applyVocation(lives3, life, "sell-garment");
  assert.equal(life.vocations!.inventory.garment, 2);
  const before = structuredClone(life.vocations);
  settleVocationYear(lives3, life, () => assert.fail("no yearly craft settlement"));
  assert.deepEqual(life.vocations, before);
});
