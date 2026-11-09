import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { Choice, WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { advanceToDecisionWithFocus, advanceYearWithFocus, selectAutomaticChoice } from "../client/yearly-focus.ts";
import { loanDeadlineWarning } from "../client/loan-summary.ts";

test("fast-forward stops a normal borrowed life before its repayment deadline", () => {
  const world = structuredClone(pack) as WorldPack;
  const interrupts = new Set([...Object.values(world.economy!.moneylender!.events), world.health!.careDecision]);
  world.events = world.events.filter(event => interrupts.has(event.id));
  delete world.eventPacing;
  delete world.character!.encounterPacing;
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  world.health!.incidenceBands.forEach(band => { band.annualProbability = 0; });
  world.health!.declineBands.forEach(band => { band.healthLoss = 0; });
  world.yearlyEffects = [];
  world.yearlyRules = [];
  const engine = createEngine(world);
  let life = engine.start("loan-clock");
  while (life.age < 18) life = engine.advance(life);
  life = engine.act(life, "borrow-moneylender");
  const before = engine.save(life);
  const warning = advanceToDecisionWithFocus(engine, life, "everyday");
  assert.equal(warning.age, 20);
  assert.equal(warning.phase, "ready");
  assert.equal(loanDeadlineWarning(world, warning)?.urgency, "soon");
  assert.equal(engine.save(life), before);
  assert.deepEqual(engine.replay(warning.seed, warning.commands), warning);
  const due = advanceYearWithFocus(engine, warning, "everyday");
  assert.equal(due.age, 21);
  assert.equal(due.pendingEventId, world.economy!.moneylender!.events.due);
});

test("Auto never accepts a loan, even if borrowing is listed first", () => {
  const borrow: Choice = { id: "borrow", text: "Borrow", outcomes: [{ id: "borrowed", weight: 1, text: "Borrowed", effects: [{ type: "loan", action: "borrow" }] }] };
  const decline: Choice = { id: "decline", text: "Decline", outcomes: [{ id: "declined", weight: 1, text: "Declined", effects: [] }] };
  assert.equal(selectAutomaticChoice([borrow, decline])?.id, "decline");
  assert.equal(selectAutomaticChoice([borrow]), undefined);
});
