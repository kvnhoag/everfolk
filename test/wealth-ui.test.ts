import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, LifeState, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import legacy from "../worlds/alexandria-0.8.0.json" with { type: "json" };
import { formatMoney, getMoneyImpact, getWealthSummary } from "../client/wealth.ts";
import { getBirthRollStats, getCosmeticBirthValue } from "../client/birth-stat-roll.ts";

const world = pack as WorldPack;
const engine = createEngine(world);
function ready(cash = 140): LifeState {
  const life = structuredClone(engine.start("wealth-ui"));
  life.phase = "ready"; life.pendingEventId = null; life.age = 20; life.year = -46;
  life.economy!.cash = cash; life.economy!.debt = 0; life.stats.wealth = cash / 10;
  return life;
}
const simple = (effects: Choice["outcomes"][number]["effects"]): Choice => ({ id: "display", text: "Display", outcomes: [{ id: "outcome", weight: 1, text: "Outcome", effects }] });

test("money uses explicit units, grouping, singular/plural and negative net worth", () => {
  assert.equal(formatMoney(1250, world), "1,250 dr");
  assert.equal(formatMoney(1, world, true), "1 drachma");
  assert.equal(formatMoney(0, world, true), "0 drachmas");
  assert.equal(formatMoney(-20, world), "-20 dr");
});

test("wealth separates available cash from assets and debt, not a capped score", () => {
  const life = ready(2000); life.economy!.assets["tool-chest"] = 1; life.economy!.debt = 50;
  const before = structuredClone(life);
  const summary = getWealthSummary(world, life)!;
  assert.equal(summary.cash, 2000); assert.equal(summary.assetTotal, 30); assert.equal(summary.debt, 50); assert.equal(summary.netWorth, 1980);
  assert.equal(summary.assets.length, 1);
  assert.equal(summary.affordableLessons, 400);
  assert.deepEqual(life, before);
});

test("annual display reports actual work, held asset income and costs at current age", () => {
  const life = ready(); life.character!.jobId = "wood-carver"; life.economy!.assets["workshop-share"] = 1;
  const summary = getWealthSummary(world, life)!;
  assert.equal(summary.jobCash, 30); assert.equal(summary.assetIncome, 10); assert.equal(summary.currentCosts, 10);
  life.age = 65; assert.equal(getWealthSummary(world, life)!.currentCosts, 20);
  life.age = 5; assert.equal(getWealthSummary(world, life)!.currentCosts, 0);
});

test("paid-practice examples are taken from outcomes and share the yearly activity limit", () => {
  const summary = getWealthSummary(world, ready(25))!;
  assert.deepEqual(summary.lessonPrices, [5, 10, 20]); assert.equal(summary.affordableLessons, 5);
  const practice = world.character!.activities.find(activity => activity.id === "train-pottery")!;
  assert.deepEqual(getMoneyImpact(practice, ready(25), world), [{ id: "cash", label: "Cash", min: -10, max: -10, inverse: false }]);
});

test("asset purchases show cash spent and value acquired, not false wealth loss", () => {
  const buy = world.character!.activities.find(activity => activity.id === "buy-tool-chest")!;
  assert.deepEqual(getMoneyImpact(buy, ready(), world), [
    { id: "cash", label: "Cash", min: -30, max: -30, inverse: false },
    { id: "assets", label: "Assets", min: 30, max: 30, inverse: false },
  ]);
});

test("unavailable finance actions show quoted terms without invalid ownership or implied credit", () => {
  const life = ready(0), before = structuredClone(life);
  const buy = world.character!.activities.find(activity => activity.id === "buy-tool-chest")!;
  const sell = world.character!.activities.find(activity => activity.id === "sell-tool-chest")!;
  const repayment = world.character!.activities.find(activity => activity.id === "repay-household-debt")!;
  assert.equal(getMoneyImpact(buy, life, world).find(item => item.id === "cash")!.min, -30);
  assert.equal(getMoneyImpact(buy, life, world).some(item => item.id === "debt"), false);
  assert.equal(getMoneyImpact(sell, life, world).find(item => item.id === "assets")!.min, -30);
  assert.equal(getMoneyImpact(repayment, life, world).find(item => item.id === "debt")!.inverse, true);
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
  assert.equal(wealth.value, life.economy!.cash); assert.equal(wealth.currency, "dr");
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
