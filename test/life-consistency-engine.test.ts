import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, validateWorld } from "../src/index.ts";
import type { CharacterActivity, Effect, LifeEngine, LifeState, WorldPack } from "../src/types.ts";

function action(id: string, effects: Effect[], category: CharacterActivity["category"] = "relationship"): CharacterActivity {
  return { id, text: id, category, minAge: 18, outcomes: [{ id: `${id}-done`, text: `${id} completed.`, weight: 1, effects }] };
}

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "life-consistency", version: "1", title: "Life consistency",
    description: "A fictional fixture for relationship and money actions.", startYear: -30, maxAge: 90,
    stats: { wealth: { label: "Wealth", min: 0, max: 100, initial: 10 } },
    flags: { partnered: { label: "Married", initial: false }, parent: { label: "Parent", initial: false } },
    origins: [{ id: "home", title: "Home", text: "At home.", weight: 1, effects: [] }],
    yearlyEffects: [],
    events: [{ id: "household-debt", title: "Household debt", text: "An unpaid cost is recorded.", trigger: { type: "age", at: 18 }, mode: "automatic", choices: [], effects: [{ type: "debt", delta: 40 }] }],
    endings: [{ id: "end", title: "End", text: "The fixture ends." }], defaultEnding: "end",
    economy: {
      stat: "wealth", currency: { singular: "drachma", plural: "drachmas", short: "dr" },
      unitsPerPoint: 10, description: "Fictional fixed prices.", assets: [],
    },
    character: {
      exclusiveCourtship: true,
      skills: { craft: { label: "Craft", min: 0, max: 100, initial: 0 } }, jobs: [],
      partners: [
        { id: "aina", name: "Aina", ageOffset: 0, occupation: "Weaver", description: "A neighbor." },
        { id: "bago", name: "Bago", ageOffset: 0, occupation: "Potter", description: "Another neighbor." },
      ],
      activities: [
        action("court-aina", [{ type: "relationship", partner: "aina", status: "courting" }]),
        action("court-bago", [{ type: "relationship", partner: "bago", status: "courting" }]),
        action("marry-aina", [{ type: "relationship", partner: "aina", status: "married" }]),
        action("break-up", [{ type: "end-courtship" }]),
        action("divorce", [{ type: "divorce" }]),
        { ...action("repay", [{ type: "cash", delta: -10 }, { type: "debt", delta: -10 }], "finance"), usesYearlyActivity: false },
        action("practice", [{ type: "skill", skill: "craft", delta: 10 }], "training"),
      ],
      childNames: ["Niko"], deathCauseDescription: "Fictional causes.",
      deathCauses: [{ id: "illness", title: "Illness", text: "An illness.", weight: 1 }],
    },
  };
}

function ageTo(engine: LifeEngine, state: LifeState, age: number): LifeState {
  while (state.age < age) state = engine.advance(state);
  return state;
}
function activity(engine: LifeEngine, state: LifeState, id: string) {
  return engine.getActivities(state).find(item => item.id === id)!;
}

test("exclusive courtship requires an explicit breakup before another partner and replays exactly", () => {
  const engine = createEngine(fixture());
  let state = engine.act(ageTo(engine, engine.start("exclusive"), 18), "court-aina");
  state = engine.advance(state);
  const saved = engine.save(state);
  assert.match(activity(engine, state, "court-bago").reason!, /End your current courtship/);
  assert.throws(() => engine.act(state, "court-bago"), /End your current courtship/);
  assert.equal(engine.save(state), saved);
  state = engine.act(state, "break-up");
  assert.equal(state.character!.partnerId, null);
  assert.equal(state.character!.relationshipStatus, "single");
  assert.equal(state.flags.partnered, false);
  state = engine.act(engine.advance(state), "court-bago");
  assert.equal(state.character!.partnerId, "bago");
  assert.ok(state.journal.some(entry => entry.type === "activity" && entry.id === "break-up"));
  assert.deepEqual(engine.replay(state.seed, state.commands), state);
  assert.deepEqual(engine.load(engine.save(state)), state);
});

test("legacy packs keep the original courtship behavior unless exclusivity is enabled", () => {
  for (const explicitFalse of [false, true]) {
    const world = fixture();
    if (explicitFalse) world.character!.exclusiveCourtship = false;
    else delete world.character!.exclusiveCourtship;
    const engine = createEngine(world);
    let state = engine.act(ageTo(engine, engine.start("legacy"), 18), "court-aina");
    state = engine.act(engine.advance(state), "court-bago");
    assert.equal(state.character!.partnerId, "bago");
    assert.deepEqual(engine.replay(state.seed, state.commands), state);
  }
});

test("breakup is unavailable when single or married and does not substitute for divorce", () => {
  const engine = createEngine(fixture());
  let state = ageTo(engine, engine.start("breakup-status"), 18);
  assert.match(activity(engine, state, "break-up").reason!, /not currently courting/);
  assert.throws(() => engine.act(state, "break-up"), /not currently courting/);
  state = engine.act(state, "court-aina");
  state = engine.act(engine.advance(state), "marry-aina");
  state = engine.advance(state);
  assert.match(activity(engine, state, "break-up").reason!, /not currently courting/);
  assert.throws(() => engine.act(state, "break-up"), /not currently courting/);
  assert.equal(state.flags.partnered, true);
  state = engine.act(state, "divorce");
  assert.equal(state.character!.relationshipStatus, "divorced");
});

test("scripted choices also cannot replace a courtship when exclusivity is enabled", () => {
  const world = fixture();
  world.events.push({
    id: "another-person", title: "Another person", text: "Another acquaintance asks about courtship.", trigger: { type: "age", at: 19 },
    choices: [
      { id: "switch", text: "Court Bago", outcomes: [{ id: "switched", text: "A new courtship begins.", weight: 1, effects: [{ type: "relationship", partner: "bago", status: "courting" }] }] },
      { id: "decline", text: "Decline", outcomes: [{ id: "declined", text: "You decline.", weight: 1, effects: [] }] },
    ],
  });
  const engine = createEngine(world);
  let state = engine.act(ageTo(engine, engine.start("narrative-courtship"), 18), "court-aina");
  state = engine.advance(state);
  const before = engine.save(state);
  assert.throws(() => engine.choose(state, "switch"), /End your current courtship/);
  assert.equal(engine.save(state), before);
  state = engine.choose(state, "decline");
  assert.equal(state.character!.partnerId, "aina");
});

test("a minor repayment preserves the annual activity whether performed before or after it", () => {
  for (const repaymentFirst of [true, false]) {
    const engine = createEngine(fixture());
    let state = ageTo(engine, engine.start(`repay-order-${repaymentFirst}`), 18);
    state = engine.act(state, repaymentFirst ? "repay" : "practice");
    assert.equal(state.character!.lastActivityAge, repaymentFirst ? null : 18);
    assert.equal(activity(engine, state, repaymentFirst ? "practice" : "repay").available, true);
    state = engine.act(state, repaymentFirst ? "practice" : "repay");
    assert.equal(state.character!.lastActivityAge, 18);
    assert.equal(state.economy!.cash, 90);
    assert.equal(state.economy!.debt, 30);
    assert.equal(state.stats.wealth, 6);
    assert.equal(state.character!.skills.craft, 10);
    assert.match(activity(engine, state, "practice").reason!, /major activity/);
    assert.match(activity(engine, state, "repay").reason!, /age 19/);
    assert.deepEqual(engine.replay(state.seed, state.commands), state);
    assert.deepEqual(engine.load(engine.save(state)), state);
  }
});

test("minor repayments retain their own cooldown, cash, debt, age and pending-choice restrictions", () => {
  const engine = createEngine(fixture());
  let state = ageTo(engine, engine.start("repayment-gates"), 17);
  assert.match(activity(engine, state, "repay").reason!, /age 18/);
  state = engine.act(engine.advance(state), "repay");
  assert.throws(() => engine.act(state, "repay"), /age 19/);
  for (let age = 19; age <= 21; age++) state = engine.act(engine.advance(state), "repay");
  state = engine.advance(state);
  assert.equal(state.economy!.debt, 0);
  assert.match(activity(engine, state, "repay").reason!, /do not owe/);

  const poor = fixture();
  poor.stats.wealth.initial = 0;
  const poorEngine = createEngine(poor), poorState = ageTo(poorEngine, poorEngine.start("no-cash"), 18);
  assert.match(activity(poorEngine, poorState, "repay").reason!, /cash/);

  const pending = fixture();
  pending.events.push({ id: "pending", title: "Pending", text: "An unresolved choice.", trigger: { type: "age", at: 18 }, choices: [{ id: "resolve", text: "Resolve", outcomes: [{ id: "resolved", text: "Resolved.", weight: 1, effects: [] }] }] });
  const pendingEngine = createEngine(pending), pendingState = ageTo(pendingEngine, pendingEngine.start("pending-repayment"), 18);
  assert.match(activity(pendingEngine, pendingState, "repay").reason!, /current decision/);
  assert.throws(() => pendingEngine.act(pendingState, "repay"), /current decision/);
});

test("ordinary finance actions retain the original annual limit by default", () => {
  const world = fixture();
  delete world.character!.activities.find(item => item.id === "repay")!.usesYearlyActivity;
  const engine = createEngine(world);
  let state = engine.act(ageTo(engine, engine.start("legacy-annual-finance"), 18), "repay");
  assert.equal(state.character!.lastActivityAge, 18);
  assert.match(activity(engine, state, "practice").reason!, /major activity/);
  state = engine.act(engine.advance(state), "practice");
  assert.match(activity(engine, state, "repay").reason!, /major activity/);
});

test("new content flags are typed and breakup effects require character support", () => {
  assert.doesNotThrow(() => validateWorld(fixture()));
  const badExclusivity: any = fixture();
  badExclusivity.character.exclusiveCourtship = "yes";
  assert.throws(() => validateWorld(badExclusivity), /exclusiveCourtship.*boolean/);
  const badActivity: any = fixture();
  badActivity.character.activities[0].usesYearlyActivity = "no";
  assert.throws(() => validateWorld(badActivity), /usesYearlyActivity.*boolean/);
  const missingCharacter = fixture();
  delete missingCharacter.character;
  missingCharacter.events[0].effects = [{ type: "end-courtship" }];
  assert.throws(() => validateWorld(missingCharacter), /requires a character definition/);
});
