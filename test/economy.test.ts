import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld } from "../src/index.ts";
import { financeActivityReason, getAssetValue, getNetWorth, previewEconomyEffects } from "../src/economy.ts";
import type { CharacterActivity, Effect, LifeState, WorldPack } from "../src/types.ts";
import legacy from "../worlds/alexandria-0.8.0.json" with { type: "json" };

function action(id: string, effects: Effect[]): CharacterActivity {
  return { id, text: id, category: "finance", outcomes: [{ id: "done", text: "Done.", weight: 1, effects }] };
}
function pack(): WorldPack {
  return { schemaVersion: 1, id: "economy-test", version: "1", title: "Money fixture", description: "Authored money example.", startYear: -20, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 10 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [], events: [],
    endings: [{ id: "end", title: "End", text: "Complete." }], defaultEnding: "end",
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, description: "Authored game prices.", assets: [
      { id: "tools", title: "Tool chest", description: "A chest.", value: 30, maxOwned: 1 },
      { id: "share", title: "Workshop share", description: "A workshop share.", value: 120, maxOwned: 1, yearlyIncome: 10 },
    ] },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [], childNames: ["Child"],
      deathCauseDescription: "Fictional causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: [
        action("buy-tools", [{ type: "cash", delta: -30 }, { type: "asset", asset: "tools", delta: 1 }]),
        action("sell-tools", [{ type: "asset", asset: "tools", delta: -1 }, { type: "cash", delta: 30 }]),
        action("buy-share", [{ type: "cash", delta: -120 }, { type: "asset", asset: "share", delta: 1 }]),
        action("repay", [{ type: "cash", delta: -10 }, { type: "debt", delta: -10 }]),
        action("borrow", [{ type: "cash", delta: 50 }, { type: "debt", delta: 50 }]),
        action("earn", [{ type: "stat", stat: "wealth", delta: 2 }]),
      ] },
  };
}
function availability(world: WorldPack, life: LifeState, id: string) {
  return createEngine(world).getActivities(life).find(item => item.id === id)!;
}

test("cash initializes after origin stat effects with zero assets and debt, without a random draw", () => {
  const world = pack(); world.origins[0].effects = [{ type: "stat", stat: "wealth", delta: 2 }];
  const noMoney = structuredClone(world); delete noMoney.economy;
  noMoney.character!.activities = [action("earn", [{ type: "stat", stat: "wealth", delta: 2 }])];
  const money = createEngine(world).start("birth"), old = createEngine(noMoney).start("birth");
  assert.deepEqual(money.economy, { cash: 120, debt: 0, assets: { tools: 0, share: 0 } });
  assert.equal(money.rngState, old.rngState); assert.deepEqual(money.stats, old.stats);
  assert.equal(Object.hasOwn(old, "economy"), false);
});

test("stat income remains full currency above the main stat display cap", () => {
  const world = pack(); world.stats.wealth.initial = 100;
  const engine = createEngine(world), start = engine.start("income"), next = engine.act(start, "earn");
  assert.equal(next.economy!.cash, 1020); assert.equal(next.stats.wealth, 100);
  assert.equal(getNetWorth(world, next), 1020); assert.equal(start.economy!.cash, 1000);
});

test("purchases transfer cash to assets without changing net worth and sales reverse it", () => {
  const world = pack(), engine = createEngine(world), start = engine.start("purchase");
  const bought = engine.act(start, "buy-tools");
  assert.equal(bought.economy!.cash, 70); assert.equal(bought.economy!.assets.tools, 1);
  assert.equal(getAssetValue(world, bought), 30); assert.equal(getNetWorth(world, bought), 100);
  const sold = engine.act(engine.advance(bought), "sell-tools");
  assert.equal(sold.economy!.cash, 100); assert.equal(sold.economy!.assets.tools, 0);
  assert.equal(getNetWorth(world, sold), 100);
  assert.match(availability(world, engine.advance(sold), "sell-tools").reason!, /do not own enough/);
});

test("buying is gated by cash rather than assets or the wealth index", () => {
  const world = pack(); world.stats.wealth.initial = 3;
  const engine = createEngine(world); let life = engine.act(engine.start("liquidity"), "buy-tools");
  life = engine.advance(life);
  assert.equal(life.stats.wealth, 3); assert.equal(life.economy!.cash, 0);
  assert.match(availability(world, life, "buy-share").reason!, /Needs 120 dr in cash/);
  assert.throws(() => engine.act(life, "buy-share"), /Needs 120 dr/);
  assert.equal(life.economy!.assets.tools, 1); assert.equal(life.commands.length, 2);
});

test("ownership limits block repeated purchases with an accurate reason", () => {
  const world = pack(), engine = createEngine(world);
  const state = engine.advance(engine.act(engine.start("limits"), "buy-tools"));
  assert.match(availability(world, state, "buy-tools").reason!, /at most 1/);
});

test("mandatory expenses record unpaid debt; future income does not secretly repay it", () => {
  const world = pack(); world.stats.wealth.initial = 1;
  world.yearlyEffects = [{ type: "cash", delta: -30 }];
  const engine = createEngine(world); const expense = engine.advance(engine.start("debt"));
  assert.equal(expense.economy!.cash, 0); assert.equal(expense.economy!.debt, 20);
  assert.equal(getNetWorth(world, expense), -20); assert.equal(expense.stats.wealth, 0);
  const paid = engine.act(expense, "earn");
  assert.equal(paid.economy!.cash, 20); assert.equal(paid.economy!.debt, 20);
  assert.equal(getNetWorth(world, paid), 0);
});

test("borrowing and explicit repayment preserve net worth and enforce outstanding debt", () => {
  const world = pack(), engine = createEngine(world), start = engine.start("loan");
  assert.match(availability(world, start, "repay").reason!, /do not owe/);
  const borrowed = engine.act(start, "borrow");
  assert.equal(borrowed.economy!.cash, 150); assert.equal(borrowed.economy!.debt, 50);
  assert.equal(getNetWorth(world, borrowed), 100);
  const repaid = engine.act(engine.advance(borrowed), "repay");
  assert.equal(repaid.economy!.cash, 140); assert.equal(repaid.economy!.debt, 40);
  assert.equal(getNetWorth(world, repaid), 100);
});

test("cash, debt and ownership conditions evaluate against the real ledger", () => {
  const world = pack(), engine = createEngine(world), start = engine.start("conditions");
  const life = engine.act(start, "buy-tools");
  assert.equal(matchesCondition({ type: "cash", op: "gte", value: 80 }, life), false);
  assert.equal(matchesCondition({ type: "cash", op: "eq", value: 70 }, life), true);
  assert.equal(matchesCondition({ type: "asset", asset: "tools", op: "gte", value: 1 }, life), true);
  assert.equal(matchesCondition({ type: "debt", op: "eq", value: 0 }, life), true);
});

test("every possible outcome must be affordable and effect ordering is respected", () => {
  const world = pack(), engine = createEngine(world), life = engine.start("outcomes");
  const risky = action("risky", [{ type: "cash", delta: -20 }]);
  risky.outcomes.push({ id: "costly", text: "Costly.", weight: 1, effects: [{ type: "cash", delta: -101 }] });
  assert.match(financeActivityReason(world, life, risky)!, /Needs 101 dr/);
  assert.equal(financeActivityReason(world, life, action("income-first", [{ type: "cash", delta: 20 }, { type: "cash", delta: -120 }])), undefined);
  assert.match(financeActivityReason(world, life, action("cost-first", [{ type: "cash", delta: -120 }, { type: "cash", delta: 20 }]))!, /Needs 120/);
});

test("skill-cost effects use currency in affordability checks, without index clamping", () => {
  const world = pack(), engine = createEngine(world), life = engine.start("skill-cost");
  const activity = action("train", [{ type: "stat", stat: "wealth", delta: -11 }]);
  assert.match(financeActivityReason(world, life, activity)!, /Needs 110 dr/);
  const preview = previewEconomyEffects(world, life, activity.outcomes[0].effects)!;
  assert.equal(preview.cash, 0); assert.equal(preview.debt, 10);
});

test("owned assets pay yearly income exactly once per survived year", () => {
  const world = pack(); world.stats.wealth.initial = 12;
  const engine = createEngine(world), bought = engine.act(engine.start("rent"), "buy-share");
  assert.equal(bought.economy!.cash, 0);
  const first = engine.advance(bought), second = engine.advance(first);
  assert.equal(first.economy!.cash, 10); assert.equal(second.economy!.cash, 20);
  assert.equal(first.journal.filter(entry => entry.id === "asset-income").length, 1);
});

test("annual wages and asset income settle before costs, avoiding artificial bridge debt", () => {
  const world = pack(); world.stats.wealth.initial = 12;
  world.character!.jobs = [{ id: "worker", title: "Worker", description: "Work.", minAge: 0, yearlyEffects: [{ type: "cash", delta: 20 }] }];
  world.character!.activities.push(action("work", [{ type: "job", job: "worker" }]));
  world.yearlyRules = [{ id: "cost", when: { type: "age", op: "gte", value: 2 }, effects: [{ type: "cash", delta: -30 }] }];
  const engine = createEngine(world);
  let life = engine.act(engine.start("annual-order"), "buy-share");
  life = engine.advance(life); life = engine.act(life, "work");
  assert.equal(life.economy!.cash, 10);
  life = engine.advance(life);
  assert.equal(life.economy!.cash, 10); assert.equal(life.economy!.debt, 0);
  assert.equal(life.journal.filter(entry => entry.age === 2 && entry.id === "asset-income").length, 1);
});

test("a fatal mortality interval does not pay asset income", () => {
  const world = pack(); world.stats.wealth.initial = 12; world.endings[0].kind = "death";
  world.sources = [{ id: "fixture-source", title: "Fixture", url: "https://example.com/source", publisher: "Fixture", kind: "scholarship", period: "Fictional", geography: "Fictional", summary: "Fixture.", limitations: "Fictional.", accessed: "2026-11-06" }];
  world.mortality = { description: "Fictional.", sourceIds: ["fixture-source"], bands: [{ minAge: 0, maxAge: 79, annualProbability: 1, ending: "end" }] };
  const engine = createEngine(world), bought = engine.act(engine.start("death"), "buy-share"), died = engine.advance(bought);
  assert.equal(died.age, 0); assert.equal(died.phase, "ended"); assert.equal(died.economy!.cash, 0);
  assert.equal(died.journal.some(entry => entry.id === "asset-income"), false);
});

test("previews stop at ending, clone nested ownership and leave RNG and annual budget untouched", () => {
  const world = pack(), engine = createEngine(world), life = engine.start("preview");
  const before = structuredClone(life);
  const result = previewEconomyEffects(world, life, [{ type: "cash", delta: -30 }, { type: "asset", asset: "tools", delta: 1 }, { type: "end", ending: "end" }, { type: "cash", delta: -100 }])!;
  assert.equal(result.cash, 70); assert.equal(result.assets.tools, 1); assert.equal(result.debt, 0);
  assert.deepEqual(life, before); result.assets.tools = 0; assert.equal(life.economy!.assets.tools, 0);
  assert.equal(financeActivityReason(world, life, action("end", [{ type: "end", ending: "end" }, { type: "cash", delta: -1000 }])), undefined);
});

test("invalid asset/debt removals and overflowing updates fail without mutating the snapshot", () => {
  const world = pack(), engine = createEngine(world), life = engine.start("invalid"), before = structuredClone(life);
  assert.throws(() => previewEconomyEffects(world, life, [{ type: "asset", asset: "tools", delta: -1 }]), /must stay/);
  assert.throws(() => previewEconomyEffects(world, life, [{ type: "debt", delta: -1 }]), /must stay/);
  const huge = { ...life, economy: { ...life.economy!, cash: 1_000_000_000_000 } };
  assert.throws(() => previewEconomyEffects(world, huge, [{ type: "cash", delta: 1 }]), /must stay/);
  assert.deepEqual(life, before);
});

test("ledger records are immutable and exact accepted actions survive save/load and replay", () => {
  const world = pack(), engine = createEngine(world); let life = engine.start("roundtrip");
  life = engine.act(life, "buy-tools"); life = engine.advance(life); life = engine.act(life, "borrow");
  assert.equal(Object.isFrozen(life.economy), true); assert.equal(Object.isFrozen(life.economy!.assets), true);
  assert.deepEqual(engine.load(engine.save(life)), life); assert.deepEqual(engine.replay(life.seed, life.commands), life);
  const forged = structuredClone(life); forged.economy!.cash++;
  assert.throws(() => engine.save(forged), /command history/);
});

test("no-economy worlds retain absent ledger and exact birth RNG across 40 historical seeds", () => {
  const old = structuredClone(legacy) as WorldPack;
  const world = structuredClone(old); world.economy = pack().economy;
  const older = createEngine(old), newer = createEngine(world);
  for (let i = 0; i < 40; i++) {
    const a = older.start(`legacy-${i}`), b = newer.start(`legacy-${i}`);
    assert.equal(Object.hasOwn(a, "economy"), false); assert.equal(a.rngState, b.rngState);
    assert.equal(a.character!.name, b.character!.name); assert.equal(a.originId, b.originId);
    assert.deepEqual(a.stats, b.stats); assert.deepEqual(a.journal, b.journal);
    assert.deepEqual(older.load(older.save(a)), a);
  }
});

test("fractional index deltas are permitted only when they resolve to whole currency", () => {
  const world = pack(); world.yearlyEffects = [{ type: "stat", stat: "wealth", delta: .1 }];
  const engine = createEngine(world); assert.equal(engine.advance(engine.start("fraction")).economy!.cash, 101);
  world.yearlyEffects[0] = { type: "stat", stat: "wealth", delta: .15 };
  assert.throws(() => validateWorld(world), /whole currency/);
});

test("origin fractional index arithmetic removes only binary rounding residue", () => {
  const world = pack(); world.stats.wealth.initial = .1;
  world.origins[0].effects = [{ type: "stat", stat: "wealth", delta: .2 }];
  assert.equal(createEngine(world).start("origin-fraction").economy!.cash, 3);
});

const invalid: [string, (world: WorldPack) => void, RegExp][] = [
  ["unknown economy stat", world => { world.economy!.stat = "missing"; }, /unknown stat/],
  ["fractional scale", world => { world.economy!.unitsPerPoint = 1.5; }, /safe integer/],
  ["negative starting wealth", world => { world.stats.wealth.min = -10; }, /nonnegative/],
  ["blank currency", world => { world.economy!.currency.short = ""; }, /string/],
  ["unknown source", world => { world.economy!.sourceIds = ["missing"]; }, /unknown source/],
  ["fractional asset price", world => { world.economy!.assets[0].value = 1.5; }, /safe integer/],
  ["duplicate asset", world => { world.economy!.assets.push(structuredClone(world.economy!.assets[0])); }, /duplicate/],
  ["zero ownership limit", world => { world.economy!.assets[0].maxOwned = 0; }, /safe integer/],
  ["huge combined asset values", world => { for (const asset of world.economy!.assets) { asset.value = 1_000_000_000; asset.maxOwned = 1_000_000; } }, /combined asset/],
  ["unknown asset effect", world => { world.yearlyEffects = [{ type: "asset", asset: "missing", delta: 1 }]; }, /unknown asset/],
  ["fractional cash", world => { world.yearlyEffects = [{ type: "cash", delta: .5 }]; }, /safe integer/],
  ["money origin effect", world => { world.origins[0].effects = [{ type: "cash", delta: 1 }]; }, /origin money/],
  ["cash condition without economy", world => { delete world.economy; world.character!.activities[0].when = { type: "cash", op: "gte", value: 1 }; }, /requires an economy/],
];
for (const [name, mutate, expected] of invalid) test(`economy validation rejects ${name}`, () => {
  const world = pack(); mutate(world); assert.throws(() => validateWorld(world), expected);
});
