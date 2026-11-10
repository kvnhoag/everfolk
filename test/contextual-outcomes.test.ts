import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition, validateWorld } from "../src/index.ts";
import { getOpportunityPreview, getOutcomeProbabilities, outcomeWeight } from "../src/outcomes.ts";
import { nextRandom } from "../src/random.ts";
import { relationshipOutcomeWeight } from "../src/relationships.ts";
import type { Choice, LifeState, WorldPack } from "../src/types.ts";

function fixture(): WorldPack {
  return {
    schemaVersion: 1, id: "contextual-odds", version: "1", title: "Odds", description: "Authored test fixture.", startYear: -50, maxAge: 80,
    stats: { bonds: { label: "Bonds", min: 0, max: 100, initial: 50 } }, flags: { recommended: { label: "Recommended", initial: false } },
    origins: [{ id: "connected", title: "Connected", text: "A household with contacts.", weight: 1, effects: [] },
      { id: "newcomer", title: "Newcomer", text: "A new household.", weight: 1, effects: [] }], yearlyEffects: [],
    endings: [{ id: "complete", title: "Complete", text: "The record ends.", kind: "chapter" }], defaultEnding: "complete",
    events: [{ id: "opening", title: "A recommendation", text: "Submit a sample.", trigger: { type: "age", at: 0 }, choices: [offer()] }],
    character: { skills: { literacy: { label: "Literacy", min: 0, max: 100, initial: 20 } },
      jobs: [{ id: "adviser", title: "Adviser", description: "A skilled adviser.", minAge: 24, requirements: { literacy: 35 }, yearlyEffects: [] }],
      activities: [{ ...offer(), id: "apply", category: "career" }], partners: [], childNames: ["Child"],
      deathCauseDescription: "Authored causes.", deathCauses: [{ id: "illness", title: "Illness", text: "Illness.", weight: 1 }] },
  };
}
function offer(): Choice {
  return { id: "submit", text: "Submit a writing sample", opportunity: { label: "Recommendation", outcomeIds: ["accepted"] }, outcomes: [
    { id: "accepted", text: "Your sample earns a recommendation.", weight: 10, effects: [{ type: "flag", flag: "recommended", value: true }], weightModifiers: [
      { when: { type: "origin", origin: "connected" }, multiplier: 2, reason: "Household contacts" },
      { when: { type: "skill", skill: "literacy", op: "gte", value: 35 }, multiplier: 3, reason: "Strong writing" },
      { when: { type: "stat", stat: "bonds", op: "lt", value: 30 }, multiplier: 0.5, reason: "Few contacts" },
    ] },
    { id: "refused", text: "The reader declines.", weight: 90, effects: [] },
  ] };
}
function editable(life: LifeState): LifeState { return structuredClone(life); }
function near(actual: number, expected: number): void { assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} should equal ${expected}`); }

test("origin and current skills change normalized odds, without guaranteeing access", () => {
  const world = fixture(), engine = createEngine(world), state = editable(engine.start("context")), choice = offer();
  state.originId = "newcomer";
  near(getOpportunityPreview(world, state, choice)!.probability, 0.1);
  state.originId = "connected";
  near(getOpportunityPreview(world, state, choice)!.probability, 20 / 110);
  state.character!.skills.literacy = 35;
  near(getOpportunityPreview(world, state, choice)!.probability, 60 / 150);
  state.stats.bonds = 20;
  const preview = getOpportunityPreview(world, state, choice)!;
  near(preview.probability, 30 / 120);
  assert.deepEqual(preview.factors.map(item => item.reason), ["Household contacts", "Strong writing", "Few contacts"]);
  assert.ok(preview.probability > 0 && preview.probability < 1);
});

test("preview is pure and engine selection matches its exact current weights and draw", () => {
  const world = fixture(), engine = createEngine(world);
  for (let i = 0; i < 64; i++) {
    const state = engine.start(`draw-${i}`), before = structuredClone(state);
    const choice = engine.getChoices(state)[0];
    const preview = getOpportunityPreview(world, state, choice)!;
    const draw = nextRandom(state.rngState);
    const next = engine.choose(state, choice.id);
    assert.equal(next.flags.recommended, draw.value < preview.probability);
    assert.deepEqual(engine.load(engine.save(next)), next);
    getOutcomeProbabilities(world, state, choice);
    assert.deepEqual(state, before);
  }
});

test("activities use the same contextual weights and replay as event choices", () => {
  const world = fixture(); world.events = [];
  const engine = createEngine(world), state = engine.start("activity"), choice = world.character!.activities[0];
  const draw = nextRandom(state.rngState), probability = getOpportunityPreview(world, state, choice)!.probability;
  const next = engine.act(state, choice.id);
  assert.equal(next.flags.recommended, draw.value < probability);
  assert.deepEqual(engine.load(engine.save(next)), next);
});

test("contextual odds never bypass job age or skill requirements", () => {
  const world = fixture(); world.events = [];
  world.character!.activities[0].outcomes[0].effects = [{ type: "job", job: "adviser" }];
  const engine = createEngine(world), state = engine.start("unqualified");
  assert.equal(engine.getActivities(state)[0].available, false);
  assert.throws(() => engine.act(state, "apply"), /age 24/);
  const adult = editable(state); adult.age = 24; adult.year = -26;
  assert.equal(engine.getActivities(adult)[0].available, false);
  assert.throws(() => engine.act(adult, "apply"), /Literacy 35/);
});

test("outcomes without modifiers retain exact relationship and legacy arithmetic", () => {
  const world = fixture(), state = createEngine(world).start("legacy");
  for (const weight of [Number.MIN_VALUE, 0.1, 1, 10, Number.MAX_SAFE_INTEGER]) {
    const outcome = { id: "legacy", text: "Unchanged.", weight, effects: [] };
    assert.equal(outcomeWeight(world, state, outcome), relationshipOutcomeWeight(world, state, outcome));
  }
  const choice = offer(); delete choice.opportunity;
  choice.outcomes.forEach(outcome => delete outcome.weightModifiers);
  assert.equal(getOpportunityPreview(world, state, choice), undefined);
  getOutcomeProbabilities(world, state, choice).forEach((item, i) => near(item.probability, [0.1, 0.9][i]));
  assert.equal(matchesCondition({ type: "all", conditions: [{ type: "age", op: "gte", value: 0 }] }, state), true);
});

test("courtship closeness adjustment composes with authored circumstances", () => {
  const world = fixture();
  world.relationships = { description: "Authored ties.", initialCloseness: 40, childCloseness: 60,
    decayAfterYears: 2, yearlyDecay: 1, marriageMinimum: 50, supportThreshold: 60, maxHealthSupport: 0.1 };
  world.character!.partners = [{ id: "reader", name: "Reader", ageOffset: 0, occupation: "Reader", description: "A reader." }];
  const state = editable(createEngine(world).start("courtship"));
  state.character!.knownPartnerIds = ["reader"];
  state.character!.relationships = { partners: { reader: { closeness: 80, lastContactAge: 0 } }, children: {} };
  const choice: Choice = { id: "ask", text: "Ask to begin courtship", outcomes: [
    { id: "yes", text: "Accepted.", weight: 10, effects: [{ type: "relationship", partner: "reader", status: "courting" }],
      weightModifiers: [{ when: { type: "stat", stat: "bonds", op: "gte", value: 40 }, multiplier: 3, reason: "Shared contacts" }] },
    { id: "no", text: "Declined.", weight: 90, effects: [] },
  ] };
  const before = structuredClone(state);
  assert.equal(relationshipOutcomeWeight(world, state, choice.outcomes[0]), 20);
  assert.equal(outcomeWeight(world, state, choice.outcomes[0]), 60);
  near(getOutcomeProbabilities(world, state, choice)[0].probability, 60 / 150);
  assert.deepEqual(state, before);
  state.character!.relationships.partners.reader.closeness = 20;
  assert.equal(outcomeWeight(world, state, choice.outcomes[0]), 15);
  near(getOutcomeProbabilities(world, state, choice)[0].probability, 15 / 105);
});

test("invalid multipliers, condition references and opportunity IDs are rejected in events and activities", () => {
  for (const location of ["event", "activity"] as const) {
    const selected = (world: WorldPack): Choice => location === "event" ? world.events[0].choices[0] : world.character!.activities[0];
    for (const multiplier of [0, -1, 0.049, 10.01, Infinity, NaN]) {
      const world = fixture(); selected(world).outcomes[0].weightModifiers![0].multiplier = multiplier;
      assert.throws(() => validateWorld(world), /multiplier/);
    }
    const unknown = fixture(); selected(unknown).outcomes[0].weightModifiers![0].when = { type: "origin", origin: "absent" };
    assert.throws(() => validateWorld(unknown), /unknown origin/);
    for (const outcomeIds of [["absent"], ["accepted", "accepted"], ["accepted", "refused"], []]) {
      const world = fixture(); selected(world).opportunity!.outcomeIds = outcomeIds;
      assert.throws(() => validateWorld(world), /opportunity/);
    }
    const extra = fixture(); selected(extra).outcomes[0].weightModifiers = Array.from({ length: 9 }, () => ({ when: { type: "origin", origin: "connected" }, multiplier: 2, reason: "Contacts" }));
    assert.throws(() => validateWorld(extra), /1\.\.8 entries/);
    const overflow = fixture(); selected(overflow).outcomes[0].weight = Number.MAX_SAFE_INTEGER;
    assert.throws(() => validateWorld(overflow), /effective weight/);
    const underflow = fixture(); selected(underflow).outcomes[0].weight = Number.MIN_VALUE;
    selected(underflow).outcomes[0].weightModifiers = [{ when: { type: "origin", origin: "connected" }, multiplier: 0.05, reason: "Contacts" }];
    assert.throws(() => validateWorld(underflow), /underflows/);
  }
});
