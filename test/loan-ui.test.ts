import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeState } from "../src/types.ts";
import { getMoneyImpact, getWealthSummary } from "../client/models/wealth.ts";
import { getLoanSummary, loanEffectNotes } from "../client/models/loan-summary.ts";
import { selectAutomaticChoice } from "../client/models/yearly-focus.ts";
import current from "../worlds/alexandria-sample.json" with { type: "json" };

const engine = createEngine(current);
const action = (id: string) => engine.world.character!.activities.find(activity => activity.id === id)!;
function adult(): LifeState {
  const life = structuredClone(engine.start("loan-ui"));
  life.age = 18; life.year = engine.world.startYear + 18; life.phase = "ready"; life.pendingEventId = null;
  life.economy!.cash = 40; life.economy!.debt = 0;
  return life;
}

test("loan quotes show the actual cash and total debt while keeping the life immutable", () => {
  const life = adult(), before = structuredClone(life);
  assert.deepEqual(loanEffectNotes(action("borrow-moneylender"), life, engine.world), ["Due 329 BCE"]);
  assert.deepEqual(getMoneyImpact(action("borrow-moneylender"), life, engine.world), [
    { id: "cash", label: "Cash", min: 100, max: 100, inverse: false },
    { id: "debt", label: "Debt", min: 130, max: 130, inverse: true },
  ]);
  life.economy!.loan = { balance: 130, borrowedAge: 18, dueAge: 21, extensions: 0 };
  life.economy!.debt = 150;
  const activeBefore = structuredClone(life);
  const quoted = getMoneyImpact(action("repay-moneylender"), life, engine.world);
  assert.equal(quoted.find(item => item.id === "cash")!.min, -130, "An unaffordable full payment quotes its real cost.");
  assert.equal(quoted.find(item => item.id === "debt")!.min, -130);
  const partial = getMoneyImpact(action("repay-moneylender-part"), life, engine.world);
  assert.equal(partial.find(item => item.id === "debt")!.min, -10);
  assert.equal(getWealthSummary(engine.world, life)!.normalDebt, 20);
  assert.deepEqual(loanEffectNotes(action("repay-moneylender"), life, engine.world), ["Loan settled"]);
  assert.deepEqual(loanEffectNotes(action("extend-moneylender"), life, engine.world), ["New deadline 327 BCE"]);
  assert.deepEqual(life, activeBefore);
  assert.deepEqual(before.economy?.loan, undefined);
});

test("the loan reminder follows its exact deadline, escalation and settlement", () => {
  const life = adult();
  life.economy!.loan = { balance: 130, borrowedAge: 18, dueAge: 21, extensions: 0 };
  life.economy!.debt = 130;
  assert.equal(getLoanSummary(engine.world, life)!.status, "Due in 3 years");
  assert.equal(getLoanSummary(engine.world, life)!.dueYear, "329 BCE");
  life.age = 21;
  assert.equal(getLoanSummary(engine.world, life)!.status, "Payment due this year");
  life.age = 22;
  assert.equal(getLoanSummary(engine.world, life)!.threatened, true);
  assert.equal(getLoanSummary(engine.world, life)!.dangerous, false);
  life.age = 24;
  assert.equal(getLoanSummary(engine.world, life)!.dangerous, true);
  life.phase = "ended";
  assert.equal(getLoanSummary(engine.world, life)!.dangerous, false);
  assert.equal(getLoanSummary(engine.world, life)!.status, "Outstanding at life end");
  delete life.economy!.loan;
  assert.equal(getLoanSummary(engine.world, life), undefined);
});

test("Auto mode declines a dangerous loan unless the player deliberately borrows", () => {
  const life = adult(), offer = engine.world.events.find(event => event.id === "lender-offer")!;
  assert.equal(selectAutomaticChoice(offer.choices, engine.world, life)?.id, "decline-moneylender-offer");
  assert.equal(life.economy!.loan, undefined);
});
