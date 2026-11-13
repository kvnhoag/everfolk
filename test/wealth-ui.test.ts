import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import legacy from "../worlds/alexandria-0.8.0.json" with { type: "json" };
import beforeMarket from "../worlds/alexandria-0.36.0.json" with { type: "json" };
import { marketQuote } from "../src/market.ts";
import { formatMoney, getMoneyImpact, getWealthSummary } from "../client/models/wealth.ts";
import { getBirthRollStats, getCosmeticBirthValue } from "../client/models/birth-stat-roll.ts";

const world = pack as WorldPack;
const engine = createEngine(world);
function ready(cash = 140, definition = world): LifeState {
  const life = structuredClone(createEngine(definition).start("wealth-ui"));
  life.phase = "ready"; life.pendingEventId = null; life.age = 20; life.year = -46;
  life.economy!.cash = cash; life.economy!.debt = 0; life.stats.wealth = cash / 10;
  // These projections control cash and inventory independently of birth rolls.
  life.economy!.assets = Object.fromEntries(definition.economy!.assets.map(asset => [asset.id, 0]));
  return life;
}
const simple = (effects: Choice["outcomes"][number]["effects"]): Choice => ({ id: "display", text: "Display", outcomes: [{ id: "outcome", weight: 1, text: "Outcome", effects }] });

test("money uses explicit units, grouping, singular/plural and negative net worth", () => {
  assert.equal(formatMoney(1250, world), "1,250 dr");
  assert.equal(formatMoney(1, world, true), "1 drachma");
  assert.equal(formatMoney(0, world, true), "0 drachmas");
  assert.equal(formatMoney(-20, world), "-20 dr");
});

test("wealth amounts round to the nearest whole currency unit", () => {
  assert.equal(formatMoney(1250.49, world), "1,250 dr");
  assert.equal(formatMoney(1250.5, world), "1,251 dr");
  assert.equal(formatMoney(-20.6, world), "-21 dr");
  assert.equal(formatMoney(0.6, world, true), "1 drachma");
  assert.equal(formatMoney(1.6, world, true), "2 drachmas");
  assert.equal(formatMoney(-0.4, world, true), "0 drachmas");
});

test("wealth separates available cash from assets and debt, not a capped score", () => {
  const life = ready(2000); life.economy!.assets["tool-chest"] = 1; life.economy!.debt = 50;
  const before = structuredClone(life);
  const summary = getWealthSummary(world, life)!;
  const toolsValue = marketQuote(world, life, "tool-chest").sell;
  assert.equal(summary.cash, 2000); assert.equal(summary.assetTotal, toolsValue); assert.equal(summary.debt, 50); assert.equal(summary.netWorth, 1950 + toolsValue);
  assert.equal(summary.assets.length, 1);
  assert.equal(summary.affordableLessons, 400);
  assert.deepEqual(life, before);
});

test("annual display reports actual work, held asset income and costs at current age", () => {
  const life = ready(); life.character!.jobId = "wood-carver"; life.economy!.assets["workshop-share"] = 1;
  const summary = getWealthSummary(world, life)!;
  assert.equal(summary.jobCash, 0, "Material production earns by selling its goods."); assert.ok(summary.job?.production); assert.equal(summary.assetIncome, 10); assert.equal(summary.currentCosts, 10);
  life.age = 65; assert.equal(getWealthSummary(world, life)!.currentCosts, 20);
  life.age = 5; assert.equal(getWealthSummary(world, life)!.currentCosts, 0);
});

test("paid-practice examples are taken from outcomes and share the yearly activity limit", () => {
  const summary = getWealthSummary(world, ready(25))!;
  assert.deepEqual(summary.lessonPrices, [5, 10, 20]); assert.equal(summary.affordableLessons, 5);
  const practice = world.character!.activities.find(activity => activity.id === "train-pottery")!;
  assert.deepEqual(getMoneyImpact(practice, ready(25), world), [{ id: "cash", label: "Cash", min: -10, max: -10, inverse: false }]);
});

test("archived immediate purchases show cash spent and value acquired", () => {
  const definition = beforeMarket as WorldPack;
  const buy = definition.character!.activities.find(activity => activity.id === "buy-tool-chest")!;
  assert.deepEqual(getMoneyImpact(buy, ready(140, definition), definition), [
    { id: "cash", label: "Cash", min: -30, max: -30, inverse: false },
    { id: "assets", label: "Assets", min: 30, max: 30, inverse: false },
  ]);
});

test("archived unavailable finance actions show quoted terms without implied credit", () => {
  const definition = beforeMarket as WorldPack;
  const life = ready(0, definition), before = structuredClone(life);
  const buy = definition.character!.activities.find(activity => activity.id === "buy-tool-chest")!;
  const sell = definition.character!.activities.find(activity => activity.id === "sell-tool-chest")!;
  const repayment = definition.character!.activities.find(activity => activity.id === "repay-household-debt")!;
  assert.equal(getMoneyImpact(buy, life, definition).find(item => item.id === "cash")!.min, -30);
  assert.equal(getMoneyImpact(buy, life, definition).some(item => item.id === "debt"), false);
  assert.equal(getMoneyImpact(sell, life, definition).find(item => item.id === "assets")!.min, -30);
  assert.equal(getMoneyImpact(repayment, life, definition).find(item => item.id === "debt")!.inverse, true);
  assert.deepEqual(life, before);
});

test("unavoidable costs expose debt while debt repayments keep decrease direction", () => {
  assert.deepEqual(getMoneyImpact(simple([{ type: "stat", stat: "wealth", delta: -1 }]), ready(3), world), [
    { id: "cash", label: "Cash", min: -3, max: -3, inverse: false },
    { id: "debt", label: "Debt", min: 7, max: 7, inverse: true },
  ]);
  const life = ready(20); life.economy!.debt = 10;
  assert.deepEqual(getMoneyImpact(simple([{ type: "cash", delta: -10 }, { type: "debt", delta: -10 }]), life, world), [
    { id: "cash", label: "Cash", min: -10, max: -10, inverse: false },
    { id: "debt", label: "Debt", min: -10, max: -10, inverse: true },
  ]);
});

test("money previews preserve outcome ranges, effect order and fatal stop without RNG", () => {
  const life = ready(20), before = structuredClone(life);
  const choice: Choice = { id: "test", text: "Test", outcomes: [
    { id: "a", text: "a", weight: 1, effects: [{ type: "cash", delta: -10 }, { type: "end", ending: world.defaultEnding }, { type: "cash", delta: 1000 }] },
    { id: "b", text: "b", weight: 2, effects: [{ type: "cash", delta: 30 }] },
  ] };
  assert.deepEqual(getMoneyImpact(choice, life, world), [{ id: "cash", label: "Cash", min: -10, max: 30, inverse: false }]);
  assert.deepEqual(life, before);
});

test("birth reveals real money and scaled origin range, leaving old score reveals unchanged", () => {
  const life = engine.start("wealth-ui-birth"), before = structuredClone(life);
  const stats = getBirthRollStats(world, life), wealth = stats.find(item => item.id === "wealth")!;
  assert.equal(wealth.value, getWealthSummary(world, life)!.netWorth); assert.equal(wealth.currency, "dr");
  assert.ok(wealth.range && wealth.value >= wealth.range.min && wealth.value <= wealth.range.max);
  for (let frame = 0; frame < 50; frame++) {
    const value = getCosmeticBirthValue(wealth, life.seed, frame); assert.ok(value >= wealth.range!.min && value <= wealth.range!.max);
  }
  assert.deepEqual(life, before);
  const oldEngine = createEngine(legacy); const oldLife = oldEngine.start("wealth-ui-birth");
  const oldWealth = getBirthRollStats(oldEngine.world, oldLife).find(item => item.id === "wealth")!;
  assert.equal(oldWealth.value, oldLife.stats.wealth); assert.equal(oldWealth.currency, undefined);
  assert.equal(getWealthSummary(oldEngine.world, oldLife), null);
  assert.deepEqual(getMoneyImpact(simple([{ type: "stat", stat: "wealth", delta: 1 }]), oldLife, oldEngine.world), []);
});
