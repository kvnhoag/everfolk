import assert from "node:assert/strict";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";

function fixture(): any {
  const decision = (id: string) => ({
    id, title: id, text: "The collector asks for payment.", trigger: { type: "random", weight: 1 },
    when: { type: "loan", status: "due" },
    choices: [
      { id: "pay", text: "Pay the balance", outcomes: [{ id: "paid", text: "Paid.", weight: 1, effects: [{ type: "loan", action: "repay" }] }] },
      { id: "wait", text: "Ask for more time", outcomes: [{ id: "waited", text: "The collector leaves.", weight: 1, effects: [] }] },
    ],
  });
  return {
    schemaVersion: 1, id: "loan-validation", version: "1", title: "Loan validation", description: "Synthetic loan contracts.", startYear: -40, maxAge: 80,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 10 } }, flags: {},
    origins: [{ id: "home", title: "Home", text: "Born at home.", weight: 1, effects: [] }], yearlyEffects: [],
    economy: { stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" }, unitsPerPoint: 10, description: "Authored accounting.", assets: [],
      moneylender: { title: "Harbor lender", principal: 100, fee: 30, termYears: 3, threatAfterYears: 1, attackAfterYears: 3, extensionYears: 2, extensionFee: 20, maxExtensions: 1,
        events: { due: "loan-due", threat: "loan-threat", attack: "loan-attack" } } },
    character: { skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 0 } }, jobs: [], partners: [], childNames: ["Child"], deathCauseDescription: "Authored causes.",
      deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }],
      activities: [
        { id: "borrow", text: "Borrow", category: "finance", minAge: 18, when: { type: "loan", status: "none" }, outcomes: [{ id: "borrowed", text: "Borrowed.", weight: 1, effects: [{ type: "loan", action: "borrow" }] }] },
        { id: "pay-ten", text: "Pay ten", category: "finance", when: { type: "loan-overdue", op: "gte", value: 0 }, outcomes: [{ id: "paid", text: "Paid.", weight: 1, effects: [{ type: "loan", action: "repay", amount: 10 }] }] },
        { id: "extend", text: "Extend", category: "finance", when: { type: "loan", status: "overdue" }, outcomes: [{ id: "extended", text: "Extended.", weight: 1, effects: [{ type: "loan", action: "extend" }] }] },
      ] },
    events: [decision("loan-due"), decision("loan-threat"), decision("loan-attack")],
    endings: [{ id: "record", title: "Record", text: "Record complete.", kind: "chapter" }], defaultEnding: "record",
  };
}

test("loan contracts, references, conditions and voluntary effects validate without mutation", () => {
  const world = fixture(), before = structuredClone(world);
  validateWorld(world);
  assert.deepEqual(world, before);
  const older = fixture(); delete older.economy.moneylender;
  older.character.activities = [{ id: "wait", text: "Wait", category: "finance", outcomes: [{ id: "waited", text: "Waited.", weight: 1, effects: [] }] }];
  older.events = [];
  validateWorld(older);
  assert.equal(Object.hasOwn(older.economy, "moneylender"), false);
});

test("loan rules require a lender, a character and an adult life range", () => {
  const withoutLender = fixture(); delete withoutLender.economy.moneylender;
  assert.throws(() => validateWorld(withoutLender), /moneylender definition/);
  const withoutCharacter = fixture(); delete withoutCharacter.character;
  assert.throws(() => validateWorld(withoutCharacter), /requires a character definition/);
  const short = fixture(); short.maxAge = 18;
  assert.throws(() => validateWorld(short), /beyond age 18/);
});

test("loan amounts, durations, ordering and unknown fields are strictly bounded", () => {
  for (const [field, invalid] of [
    ["principal", 0], ["principal", -1], ["principal", 1e9 + 1], ["fee", -1], ["fee", Infinity],
    ["termYears", 0], ["termYears", 81], ["threatAfterYears", 0], ["attackAfterYears", 1],
    ["extensionYears", .5], ["extensionFee", NaN], ["maxExtensions", 11], ["maxExtensions", -1],
  ] as const) {
    const world = fixture(); world.economy.moneylender[field] = invalid;
    assert.throws(() => validateWorld(world), new RegExp(field));
  }
  const extra = fixture(); extra.economy.moneylender.infiniteCredit = true;
  assert.throws(() => validateWorld(extra), /infiniteCredit.*unknown field/);
});

test("collection events must be distinct real interrupt decisions with a usable fallback", () => {
  const missing = fixture(); missing.economy.moneylender.events.due = "missing";
  assert.throws(() => validateWorld(missing), /events.due.*unknown event/);
  const duplicate = fixture(); duplicate.economy.moneylender.events.threat = "loan-due";
  assert.throws(() => validateWorld(duplicate), /three distinct IDs/);
  const scheduled = fixture(); scheduled.events[0].trigger = { type: "age", at: 21 };
  assert.throws(() => validateWorld(scheduled), /random-trigger decision/);
  const automatic = fixture(); automatic.events[0].mode = "automatic"; automatic.events[0].choices = [];
  assert.throws(() => validateWorld(automatic), /random-trigger decision/);
  const locked = fixture(); locked.events[0].choices[1].when = { type: "cash", op: "gte", value: 1 };
  assert.throws(() => validateWorld(locked), /unconditional option without loan effects/);
  const onlyPayment = fixture(); onlyPayment.events[0].choices = [onlyPayment.events[0].choices[0]];
  assert.throws(() => validateWorld(onlyPayment), /unconditional option without loan effects/);
});

test("loan actions reject unsupported amounts, states and actions", () => {
  for (const amount of [0, -1, .5, 1e9 + 1, Infinity]) {
    const world = fixture(); world.character.activities[1].outcomes[0].effects[0].amount = amount;
    assert.throws(() => validateWorld(world), /amount/);
  }
  const borrowedAmount = fixture(); borrowedAmount.character.activities[0].outcomes[0].effects[0].amount = 10;
  assert.throws(() => validateWorld(borrowedAmount), /only for repayment/);
  const action = fixture(); action.character.activities[0].outcomes[0].effects[0].action = "erase";
  assert.throws(() => validateWorld(action), /unknown loan action/);
  const status = fixture(); status.character.activities[0].when.status = "forgiven";
  assert.throws(() => validateWorld(status), /unknown loan status/);
  const overdue = fixture(); overdue.character.activities[1].when.value = -1;
  assert.throws(() => validateWorld(overdue), /safe integer/);
});

test("origins, annual rules and automatic events cannot perform involuntary loan actions", () => {
  for (const action of ["borrow", "repay", "extend"]) {
    const loan = { type: "loan", action };
    const origin = fixture(); origin.origins[0].effects.push(loan);
    assert.throws(() => validateWorld(origin), /origin money/);
    const yearly = fixture(); yearly.yearlyEffects.push(loan);
    assert.throws(() => validateWorld(yearly), /explicit player choice/);
    const rule = fixture(); rule.yearlyRules = [{ id: "forced-loan", effects: [loan] }];
    assert.throws(() => validateWorld(rule), /explicit player choice/);
    const automatic = fixture(); automatic.events.push({ id: "forced-loan", title: "A loan", text: "A forced loan.", mode: "automatic", trigger: { type: "age", at: 18 }, choices: [], effects: [loan] });
    assert.throws(() => validateWorld(automatic), /explicit player choice/);
    const job = fixture(); job.character.jobs.push({ id: "forced-loan", title: "Loan job", description: "No automatic contract actions.", minAge: 18, yearlyEffects: [loan] });
    assert.throws(() => validateWorld(job), /jobs can change only/);
  }
});
