import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition } from "../src/index.ts";
import { applyEconomyEffect, financeActivityReason, getNetWorth, previewEconomyEffects, repayDebtAutomatically } from "../src/economy.ts";
import { loanCollectionEventId } from "../src/loans.ts";
import type { CharacterActivity, Choice, Effect, LifeEngine, LifeState, WorldPack } from "../src/types.ts";

const loan = (action: "borrow" | "repay" | "extend", amount?: number): Effect => ({ type: "loan", action, ...(amount === undefined ? {} : { amount }) });
const option = (id: string, effects: Effect[] = []): Choice => ({ id, text: id, outcomes: [{ id: `${id}-done`, text: `${id} is done.`, weight: 1, effects }] });
const action = (id: string, effects: Effect[]): CharacterActivity => ({ ...option(id, effects), category: "finance", minAge: 18, usesYearlyActivity: false, cooldownYears: 1 });

function fixture(paced = true): WorldPack {
  const world: WorldPack = {
    schemaVersion: 1, id: "dangerous-loan", version: "1", title: "Loan fixture", description: "Fictional loan balance and collection rules.", startYear: -66, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 10 }, health: { label: "Health", min: 0, max: 100, initial: 80 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [],
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, assets: [], description: "Authored amounts.", autoDebtRepayment: true,
      moneylender: { title: "Harbor lender", principal: 100, fee: 30, termYears: 3, threatAfterYears: 1, attackAfterYears: 3, extensionYears: 2, extensionFee: 20, maxExtensions: 1,
        events: { due: "due", threat: "threat", attack: "attack" } } },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [], childNames: ["Child"], deathCauseDescription: "Fictional consequences.",
      deathCauses: [{ id: "illness", title: "Illness", text: "An illness.", weight: 1 }, { id: "stab", title: "Stab wound to the chest", text: "A collector stabs you in the chest.", weight: 1, choiceOnly: true }],
      activities: [action("borrow", [loan("borrow")]), action("pay", [loan("repay")]), action("pay-ten", [loan("repay", 10)]), action("extend", [loan("extend")]),
        action("spend", [{ type: "cash", delta: -150 }]), action("ordinary-payment", [{ type: "cash", delta: -10 }, { type: "debt", delta: -10 }])] },
    events: [
      ...["due", "threat", "attack"].map(id => ({ id, title: id, text: `The ${id} collection.`, trigger: { type: "random" as const, weight: 1 }, maxOccurrences: 80,
        choices: [option(`${id}-pay`, [loan("repay")]), option(`${id}-ten`, [loan("repay", 10)]), option(`${id}-extend`, [loan("extend")]), option(`${id}-wait`)] })),
      { id: "plans", title: "Ordinary plans", text: "Make ordinary plans.", trigger: { type: "age", at: 21 }, choices: [option("plans-wait")] },
      { id: "history", title: "History", text: "News arrives.", trigger: { type: "age", at: 21 }, mode: "automatic", choices: [], effects: [] },
      { id: "background", title: "A usual day", text: "A routine day passes.", trigger: { type: "random", weight: 1 }, mode: "automatic", choices: [], effects: [],
        when: { type: "age", op: "gte", value: 21 }, maxOccurrences: 80, cooldownYears: 1 },
    ],
    endings: [{ id: "death", title: "Died", text: "Life ended.", kind: "death" }, { id: "record", title: "Record complete", text: "Record complete.", kind: "chapter" }], defaultEnding: "record",
    ...(paced ? { eventPacing: { minChoiceGapYears: 2, maxChoiceGapYears: 3 } } : {}),
  };
  return world;
}
function toAge(engine: LifeEngine, state: LifeState, age: number): LifeState {
  let life = state;
  while (life.age < age) {
    if (life.phase === "choice") life = engine.choose(life, `${life.pendingEventId}-wait`);
    else life = engine.advance(life);
  }
  return life;
}
function borrowed(paced = true) {
  const engine = createEngine(fixture(paced));
  const before = toAge(engine, engine.start("loan-route"), 18);
  return { engine, before, life: engine.act(before, "borrow") };
}

test("borrowing is adult-only, creates one explicit contract and charges only its fee to net worth", () => {
  const engine = createEngine(fixture()), child = toAge(engine, engine.start("loan-route"), 17);
  assert.throws(() => engine.act(child, "borrow"), /age 18/);
  const before = engine.advance(child), life = engine.act(before, "borrow");
  assert.deepEqual(life.economy, { cash: 200, debt: 130, assets: {}, loan: { balance: 130, borrowedAge: 18, dueAge: 21, extensions: 0 } });
  assert.equal(getNetWorth(engine.world, life), getNetWorth(engine.world, before) - 30);
  assert.equal(before.economy!.loan, undefined);
  assert.equal(matchesCondition({ type: "loan", status: "active" }, life), true);
  assert.equal(matchesCondition({ type: "loan", status: "due" }, life), false);
  assert.equal(matchesCondition({ type: "loan", status: "none" }, before), true);
  assert.match(financeActivityReason(engine.world, life, option("another", [loan("borrow")]))!, /existing/);
  assert.equal(life.character!.lastActivityAge, null, "The contract does not spend a major training/work action.");
  assert.deepEqual(engine.load(engine.save(life)), life);
});

test("ordinary auto-pay and debt effects never silently pay or forgive the dangerous loan", () => {
  const { engine, life } = borrowed();
  const state = structuredClone(life);
  applyEconomyEffect(engine.world, state, { type: "cash", delta: -250 });
  applyEconomyEffect(engine.world, state, { type: "cash", delta: 70 });
  const worth = getNetWorth(engine.world, state);
  assert.equal(state.economy!.debt, 180);
  assert.equal(repayDebtAutomatically(engine.world, state), 50);
  assert.equal(state.economy!.cash, 20);
  assert.equal(state.economy!.debt, 130);
  assert.equal(state.economy!.loan!.balance, 130);
  assert.equal(getNetWorth(engine.world, state), worth);
  assert.equal(repayDebtAutomatically(engine.world, state), 0);
  const before = structuredClone(state);
  assert.throws(() => applyEconomyEffect(engine.world, state, { type: "debt", delta: -10 }), /loan payment/);
  assert.deepEqual(state, before);
  assert.match(financeActivityReason(engine.world, state, option("ordinary", [{ type: "cash", delta: -10 }, { type: "debt", delta: -10 }]))!, /household debt only/);
});

test("partial and full repayment reduce both ledgers, remove the contract at zero, and preserve net worth", () => {
  const { engine, life } = borrowed();
  const partial = engine.act(life, "pay-ten");
  assert.equal(partial.economy!.cash, 190);
  assert.equal(partial.economy!.debt, 120);
  assert.equal(partial.economy!.loan!.balance, 120);
  assert.equal(life.economy!.loan!.balance, 130, "A public snapshot is immutable.");
  const paid = engine.act(partial, "pay");
  assert.equal(paid.economy!.cash, 70);
  assert.equal(paid.economy!.debt, 0);
  assert.equal(paid.economy!.loan, undefined);
  assert.equal(getNetWorth(engine.world, paid), getNetWorth(engine.world, life));
  const older = toAge(engine, paid, 26);
  assert.equal(older.journal.some(entry => ["due", "threat", "attack"].includes(entry.id)), false);
  assert.deepEqual(engine.replay(older.seed, older.commands), older);
});

test("previews are detached and apply sequential loan and ordinary money effects exactly", () => {
  const { engine, life } = borrowed();
  const before = structuredClone(life);
  const projected = previewEconomyEffects(engine.world, life, [loan("repay", 10)])!;
  assert.equal(projected.loan!.balance, 120);
  assert.equal(projected.debt, 120);
  assert.equal(projected.cash, 190);
  assert.deepEqual(life, before);
  const sequential = option("funded-payment", [{ type: "cash", delta: 20 }, loan("repay")]);
  const poor = structuredClone(life); poor.economy!.cash = 110;
  assert.equal(financeActivityReason(engine.world, poor, sequential), undefined);
  assert.equal(previewEconomyEffects(engine.world, poor, sequential.outcomes[0].effects)!.loan, undefined);
  assert.equal(poor.economy!.loan!.balance, 130);
});

test("ledger ceilings reject borrowing and extensions before any balance changes", () => {
  const { engine, before, life } = borrowed();
  const overflowingCash = structuredClone(before);
  overflowingCash.economy!.cash = 1_000_000_000_000 - 50;
  const unchanged = structuredClone(overflowingCash);
  assert.throws(() => applyEconomyEffect(engine.world, overflowingCash, loan("borrow")), /ledger limit/);
  assert.deepEqual(overflowingCash, unchanged);
  const late = structuredClone(life);
  late.age = 21;
  late.economy!.debt = 1_000_000_000_000 - 10;
  const prior = structuredClone(late);
  assert.throws(() => applyEconomyEffect(engine.world, late, loan("extend")), /ledger limit/);
  assert.deepEqual(late, prior);
});

test("unaffordable loan event payments are unavailable and cannot mint ordinary debt", () => {
  const { engine, life } = borrowed();
  const spent = engine.act(life, "spend"), due = toAge(engine, spent, 21);
  assert.equal(due.pendingEventId, "due");
  assert.equal(due.economy!.cash, 50);
  assert.equal(engine.getChoices(due).some(choice => choice.id === "due-pay"), false);
  assert.throws(() => engine.choose(due, "due-pay"), /unavailable/);
  const partial = engine.choose(due, "due-ten");
  assert.equal(partial.economy!.debt, 120);
  assert.equal(partial.economy!.loan!.balance, 120);
  assert.equal(partial.economy!.cash, 40);
  assert.equal(due.economy!.loan!.balance, 130);
  assert.deepEqual(engine.load(engine.save(partial)), partial);
});

for (const paced of [true, false]) test(`deadline interrupts escalate after warnings, preserve annual narration and never repeat within an age (${paced ? "paced" : "unpaced"})`, () => {
  const { engine, life } = borrowed(paced);
  const due = toAge(engine, life, 21);
  assert.equal(due.pendingEventId, "due");
  assert.equal(due.economy!.loan!.lastCollectionAge, 21);
  const yearEntries = due.journal.filter(entry => entry.age === 21);
  const dueIndex = yearEntries.findIndex(entry => entry.id === "due");
  for (const id of ["history", "background"]) assert.ok(yearEntries.findIndex(entry => entry.id === id) < dueIndex && yearEntries.some(entry => entry.id === id), `${id} is narrated before collection`);
  let next = engine.choose(due, "due-wait");
  assert.notEqual(next.pendingEventId, "due");
  assert.equal(loanCollectionEventId(engine.world, next), undefined);
  assert.equal(matchesCondition({ type: "loan", status: "due" }, next), true);
  assert.equal(matchesCondition({ type: "loan", status: "overdue" }, next), false);
  next = toAge(engine, next, 22);
  assert.equal(next.pendingEventId, "threat");
  assert.equal(matchesCondition({ type: "loan-overdue", op: "eq", value: 1 }, next), true);
  next = toAge(engine, engine.choose(next, "threat-wait"), 24);
  assert.equal(next.pendingEventId, "attack");
  assert.equal(next.age, 24);
  assert.equal(next.phase, "choice", "Advancing time alone never draws a fatal attack.");
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
});

test("an extension costs a disclosed fee, moves a late deadline from today and obeys its hard limit", () => {
  const { engine, life } = borrowed();
  const due = toAge(engine, life, 21);
  const extended = engine.choose(due, "due-extend");
  assert.equal(extended.economy!.loan!.dueAge, 23);
  assert.equal(extended.economy!.loan!.balance, 150);
  assert.equal(extended.economy!.debt, 150);
  assert.equal(extended.economy!.loan!.extensions, 1);
  assert.equal(extended.economy!.cash, due.economy!.cash);
  assert.equal(due.economy!.loan!.balance, 130, "An extension never mutates the earlier public state.");
  const later = toAge(engine, extended, 23);
  assert.equal(later.pendingEventId, "due");
  assert.equal(engine.getChoices(later).some(choice => choice.id === "due-extend"), false);
  const late = structuredClone(later); late.age = 27; late.economy!.loan!.extensions = 0;
  const preview = previewEconomyEffects(engine.world, late, [loan("extend")])!;
  assert.equal(preview.loan!.dueAge, 29, "A late extension provides actual future time.");
  assert.equal(late.economy!.loan!.dueAge, 23);
});

test("household debt and an unaccepted lender contract never summon collectors", () => {
  const engine = createEngine(fixture());
  let life = toAge(engine, engine.start("no-loan"), 18);
  const state = structuredClone(life); applyEconomyEffect(engine.world, state, { type: "cash", delta: -150 });
  assert.equal(state.economy!.debt, 50);
  assert.equal(loanCollectionEventId(engine.world, state), undefined);
  life = toAge(engine, life, 30);
  assert.equal(life.journal.some(entry => ["due", "threat", "attack"].includes(entry.id)), false);
});

test("a care interrupt resolves before the due collection without erasing the loan warning", () => {
  const world = fixture();
  world.health = { description: "Authored test health.", sourceIds: [], stat: "health", criticalHealth: 10, declineCondition: "decline", careDecision: "care", supportRecoveryBonus: 0,
    incidenceBands: [{ minAge: 0, maxAge: 79, annualProbability: 0 }], declineBands: [{ minAge: 0, maxAge: 79, healthLoss: 0 }], conditions: [
      { id: "pneumonia", title: "Pneumonia", deathCause: "illness", kind: "illness", weight: 1, healthLoss: 2, recoveryChance: 1, careRecoveryBonus: 0, fatalHealthThreshold: 5 },
      { id: "decline", title: "Physical decline", deathCause: "illness", kind: "frailty", weight: 0, healthLoss: 1, recoveryChance: 0, careRecoveryBonus: 0, fatalHealthThreshold: 0 },
    ] };
  world.yearlyRules = [{ id: "exposure", when: { type: "age", op: "eq", value: 21 }, effects: [{ type: "condition", condition: "pneumonia" }] }];
  world.events.push({ id: "care", title: "Care", text: "Arrange care.", trigger: { type: "random", weight: 1 }, choices: [option("care-rest", [{ type: "care", amount: .55 }])] });
  const engine = createEngine(world);
  let life = toAge(engine, engine.start("care-and-debt"), 18);
  life = engine.act(life, "borrow");
  life = toAge(engine, life, 21);
  assert.equal(life.pendingEventId, "care");
  assert.equal(life.economy!.loan!.lastCollectionAge, undefined);
  life = engine.choose(life, "care-rest");
  assert.equal(life.pendingEventId, "due");
  assert.equal(life.economy!.loan!.lastCollectionAge, 21);
  assert.deepEqual(engine.load(engine.save(life)), life);
});
