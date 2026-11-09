import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { CharacterActivity, Choice, Effect, LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { activityLoanOffer, borrowAndAct, isBorrowChoice, requiredCash } from "../client/loan-access.ts";

const option = (id: string, effects: Effect[] = []): Choice => ({ id, text: id, outcomes: [{ id: `${id}-done`, text: `${id} is done.`, weight: 1, effects }] });
const action = (id: string, effects: Effect[], category: CharacterActivity["category"] = "finance"): CharacterActivity => ({ ...option(id, effects), category, minAge: 18, cooldownYears: 1, ...(category === "finance" ? { usesYearlyActivity: false } : {}) });

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "loan-access", version: "1", title: "Loan access fixture", description: "Fictional borrowing and practice.", startYear: -66, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 1 }, health: { label: "Health", min: 0, max: 100, initial: 80 } },
    flags: { invited: { label: "Invited", initial: false } },
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }], yearlyEffects: [],
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, assets: [], description: "Authored amounts.", autoDebtRepayment: false,
      moneylender: { title: "Harbor lender", principal: 100, fee: 30, termYears: 3, threatAfterYears: 1, attackAfterYears: 3, extensionYears: 2, extensionFee: 20, maxExtensions: 1,
        events: { due: "due", threat: "threat", attack: "attack" } } },
    character: { skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 }, carving: { label: "Carving", min: 0, max: 100, initial: 0, prerequisites: { craft: 10 } } },
      jobs: [], partners: [], childNames: ["Child"], deathCauseDescription: "Fictional consequences.", deathCauses: [{ id: "illness", title: "Illness", text: "An illness.", weight: 1 }],
      activities: [action("borrow", [{ type: "loan", action: "borrow" }]), action("lesson", [{ type: "cash", delta: -40 }, { type: "skill", skill: "craft", delta: 6 }], "training"),
        action("carving-lesson", [{ type: "cash", delta: -40 }, { type: "skill", skill: "carving", delta: 6 }], "training")] },
    events: ["due", "threat", "attack"].map(id => ({ id, title: id, text: `${id} collection.`, trigger: { type: "random", weight: 1 }, maxOccurrences: 80,
      choices: [option(`${id}-wait`)] })),
    endings: [{ id: "death", title: "Died", text: "Life ended.", kind: "death" }, { id: "record", title: "Record complete", text: "Record complete.", kind: "chapter" }], defaultEnding: "record",
  };
}
function adult(engine: LifeEngine, targetAge = 18): LifeState {
  let life = engine.start("loan-access");
  while (life.age < targetAge) life = engine.advance(life);
  return life;
}
function sample(world = fixture()) {
  const engine = createEngine(world), life = adult(engine);
  return { engine, life, activity: engine.world.character!.activities.find(action => action.id === "lesson")! };
}

test("cash-only offers project the real contract without mutating state, RNG, commands or world", () => {
  const { engine, life, activity } = sample(), beforeLife = structuredClone(life), beforeWorld = structuredClone(engine.world);
  assert.deepEqual(activityLoanOffer(engine.world, life, activity), { borrowActivityId: "borrow", cost: 40, shortfall: 30 });
  assert.deepEqual(activityLoanOffer(engine.world, life, activity), { borrowActivityId: "borrow", cost: 40, shortfall: 30 });
  assert.deepEqual(life, beforeLife);
  assert.deepEqual(engine.world, beforeWorld);
});

test("cash quotes respect sequential payments, rewards, wealth conversion, every branch and end", () => {
  const world = fixture();
  const choice = option("sequence", [{ type: "cash", delta: -20 }, { type: "cash", delta: 30 }, { type: "cash", delta: -50 }]);
  choice.outcomes.push({ id: "other-sequence", text: "Other.", weight: 1, effects: [{ type: "stat", stat: "wealth", delta: -6 }, { type: "cash", delta: 100 }] });
  assert.equal(requiredCash(choice, world), 60, "A later reward does not pay an earlier price.");
  assert.equal(requiredCash(option("paid-upfront", [{ type: "cash", delta: 50 }, { type: "cash", delta: -40 }]), world), 0);
  assert.equal(requiredCash(option("ends", [{ type: "cash", delta: -20 }, { type: "end", ending: "record" }, { type: "cash", delta: -200 }]), world), 20);
  delete world.economy;
  assert.equal(requiredCash(choice, world), 0);
});

test("a cash reason cannot conceal another requirement or supply an unrelated debt gate", () => {
  const { engine, life, activity } = sample();
  const carving = engine.world.character!.activities.find(action => action.id === "carving-lesson")!;
  assert.equal(activityLoanOffer(engine.world, life, carving), undefined, "Carving still needs Craft 10.");
  const gated = { ...activity, when: { type: "flag" as const, flag: "invited", value: true } };
  assert.equal(activityLoanOffer(engine.world, life, gated), undefined);
  assert.equal(activityLoanOffer(engine.world, life, { ...activity, when: { type: "loan", status: "active" } }), undefined);
  assert.equal(activityLoanOffer(engine.world, life, { ...activity, when: { type: "debt", op: "gte", value: 130 } }), undefined);
});

test("loan fees can make a Wealth requirement fail even when cash becomes sufficient", () => {
  const world = fixture(); world.stats.wealth.initial = 5;
  const target = world.character!.activities.find(action => action.id === "lesson")!;
  target.outcomes[0].effects[0] = { type: "cash", delta: -80 };
  target.when = { type: "stat", stat: "wealth", op: "gte", value: 4 };
  const { engine, life, activity } = sample(world);
  assert.equal(life.stats.wealth, 5);
  assert.equal(activityLoanOffer(engine.world, life, activity), undefined, "The fee reduces net worth from 50 to 20.");
});

test("cash funding respects adulthood, affordability, the annual action, cooldowns and existing loans", () => {
  const { engine, life, activity } = sample();
  const altered = (change: (state: LifeState) => void): LifeState => { const result = structuredClone(life); change(result); return result; };
  for (const blocked of [
    altered(state => { state.age = 17; }),
    altered(state => { state.phase = "choice"; state.pendingEventId = "due"; }),
    altered(state => { state.phase = "ended"; state.endingId = "record"; }),
    altered(state => { state.economy!.cash = 40; }),
    altered(state => { state.character!.lastActivityAge = state.age; }),
    altered(state => { state.character!.lastActivityAges.lesson = state.age; }),
    altered(state => { state.character!.lastActivityAges.borrow = state.age; }),
    altered(state => { state.economy!.loan = { balance: 130, borrowedAge: 18, dueAge: 21, extensions: 0 }; state.economy!.debt = 130; }),
  ]) assert.equal(activityLoanOffer(engine.world, blocked, activity), undefined);
  assert.equal(activityLoanOffer(engine.world, life, { ...activity, minAge: 19 }), undefined);
  const tooCostly = { ...activity, outcomes: [{ ...activity.outcomes[0], effects: [{ type: "cash" as const, delta: -111 }] }] };
  assert.equal(activityLoanOffer(engine.world, life, tooCostly), undefined);
  assert.equal(activityLoanOffer(engine.world, life, { ...activity, outcomes: [option("pay-debt", [{ type: "cash", delta: -40 }, { type: "debt", delta: -40 }]).outcomes[0]] }), undefined);
});

test("only an actually available free, deterministic, pure borrowing action is supported", () => {
  const world = fixture();
  world.character!.activities[0].usesYearlyActivity = true;
  let result = sample(world);
  assert.equal(activityLoanOffer(result.engine.world, result.life, result.activity), undefined);
  world.character!.activities[0].usesYearlyActivity = false;
  world.character!.activities[0].outcomes[0].effects.push({ type: "stat", stat: "health", delta: -2 });
  result = sample(world);
  assert.equal(activityLoanOffer(result.engine.world, result.life, result.activity), undefined);
  world.character!.activities[0].outcomes[0].effects.pop();
  world.character!.activities[0].outcomes.push({ ...option("borrow-other", [{ type: "loan", action: "borrow" }]).outcomes[0] });
  result = sample(world);
  assert.equal(activityLoanOffer(result.engine.world, result.life, result.activity), undefined);
  delete world.economy!.moneylender;
  assert.equal(activityLoanOffer(world, result.life, result.activity), undefined);
});

test("accepted funding records two normal commands and replays, saves and loads exactly", () => {
  const { engine, life } = sample(), before = structuredClone(life);
  const funded = borrowAndAct(engine, life, "lesson");
  assert.equal(funded.economy!.cash, 70);
  assert.equal(funded.economy!.debt, 130);
  assert.equal(funded.economy!.loan!.dueAge, 21);
  assert.equal(funded.character!.skills.craft, 6);
  assert.equal(funded.character!.lastActivityAge, 18);
  assert.deepEqual(funded.commands.slice(-2), [{ type: "act", activity: "borrow" }, { type: "act", activity: "lesson" }]);
  assert.deepEqual(life, before);
  assert.deepEqual(engine.replay(funded.seed, funded.commands), funded);
  assert.deepEqual(engine.load(engine.save(funded)), funded);
  assert.throws(() => borrowAndAct(engine, funded, "lesson"), /No loan was accepted/);
  assert.throws(() => borrowAndAct(engine, life, "missing"), /No loan was accepted/);
});

test("a decision triggered by borrowing cancels the whole proposed sequence without any accepted loan", () => {
  const world = fixture();
  world.events.push({ id: "interruption", title: "An interruption", text: "A message arrives.", trigger: { type: "age", at: 18 }, when: { type: "loan", status: "active" }, choices: [option("later")] });
  const { engine, life } = sample(world), before = structuredClone(life);
  assert.equal(life.phase, "ready");
  assert.throws(() => borrowAndAct(engine, life, "lesson"), /No loan was accepted/);
  assert.deepEqual(life, before);
  assert.equal(life.economy!.loan, undefined);
  assert.deepEqual(engine.replay(life.seed, life.commands), life);
});

test("borrow detection includes combined event payments and excludes ordinary expenses", () => {
  assert.equal(isBorrowChoice(option("funded", [{ type: "loan", action: "borrow" }, { type: "cash", delta: -80 }])), true);
  assert.equal(isBorrowChoice(option("pay", [{ type: "loan", action: "repay" }])), false);
  assert.equal(isBorrowChoice(option("lesson", [{ type: "cash", delta: -40 }])), false);
});
