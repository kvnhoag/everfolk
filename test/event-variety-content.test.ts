import assert from "node:assert/strict";
import test from "node:test";
import { createEngine, matchesCondition } from "../src/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import current from "../worlds/alexandria-0.22.0.json" with { type: "json" };
import previous from "../worlds/alexandria-0.21.0.json" with { type: "json" };

const world = current as WorldPack;
const added = world.events.filter(event => event.id.startsWith("variety-"));
const find = (id: string): LifeEvent => {
  const event = world.events.find(event => event.id === id);
  assert.ok(event, `Missing event ${id}`);
  return event;
};
function context(age: number): LifeState {
  const state = structuredClone(createEngine(world).start("content-condition-fixture"));
  state.age = age;
  state.year = world.startYear + age;
  return state;
}

test("the expanded bank adds128 distinct fictional scenes without new health or death rules", () => {
  assert.equal(added.length, 128);
  assert.equal(added.filter(event => event.mode === "automatic").length, 96);
  assert.equal(added.filter(event => event.mode !== "automatic").length, 32);
  assert.equal(new Set(added.map(event => event.title)).size, 128);
  assert.equal(new Set(added.map(event => event.text)).size, 128);
  assert.deepEqual(current.health, previous.health);
  assert.deepEqual(current.mortality, previous.mortality);
  assert.deepEqual(current.economy, previous.economy);
  assert.deepEqual(current.sources, previous.sources);
  assert.deepEqual(current.origins, previous.origins);
  assert.deepEqual(current.character, previous.character);
  for (const event of added) {
    assert.equal(event.evidence, "fictional");
    assert.equal(event.trigger.type, "random");
    assert.ok(event.maxOccurrences! <= 2);
    assert.ok(event.cooldownYears! >= 12);
    if (event.mode === "automatic") assert.deepEqual(event.effects, []);
    for (const effect of event.choices.flatMap(choice => choice.outcomes).flatMap(outcome => outcome.effects)) {
      assert.ok(!["condition", "end", "loan", "job"].includes(effect.type), `${event.id} adds an unrelated mechanical route`);
    }
  }
});

test("childhood stories stay in childhood and no expanded personal decision occurs at birth", () => {
  for (const event of added) assert.equal(matchesCondition(event.when, context(0)), false, event.id);
  const child = find("variety-child-seed-game");
  assert.equal(matchesCondition(child.when, context(4)), false);
  assert.equal(matchesCondition(child.when, context(5)), true);
  assert.equal(matchesCondition(child.when, context(11)), true);
  assert.equal(matchesCondition(child.when, context(12)), false);
  const elder = find("variety-later-shorter-round");
  assert.equal(matchesCondition(elder.when, context(54)), false);
  assert.equal(matchesCondition(elder.when, context(55)), true);
});

test("trade and spouse stories require the actual occupation or relationship", () => {
  const state = context(30);
  state.character!.jobId = null;
  const pottery = find("variety-trade-potter-drying");
  assert.equal(matchesCondition(pottery.when, state), false);
  state.character!.jobId = "potter";
  assert.equal(matchesCondition(pottery.when, state), true);
  state.character!.jobId = "porter";
  assert.equal(matchesCondition(pottery.when, state), false);
  const married = find("variety-tie-married-late");
  state.character!.relationshipStatus = "single";
  assert.equal(matchesCondition(married.when, state), false);
  state.character!.relationshipStatus = "married";
  state.character!.partnerId = world.character!.partners[0].id;
  assert.equal(matchesCondition(married.when, state), true);
  const divorced = find("variety-choice-after-separation");
  assert.equal(matchesCondition(divorced.when, state), false);
  state.character!.relationshipStatus = "divorced";
  state.character!.partnerId = null;
  assert.equal(matchesCondition(divorced.when, state), true);
});

test("child tasks and questions require a child of the right age rather than a newborn", () => {
  const state = context(30);
  const letters = find("variety-choice-child-wants-letters");
  const sandals = find("variety-tie-child-sandals");
  assert.equal(matchesCondition(letters.when, state), false);
  state.character!.children.push({ id: "fixture-child", name: "Child", birthAge: 30, otherParentId: world.character!.partners[0].id });
  assert.equal(matchesCondition(letters.when, state), false);
  assert.equal(matchesCondition(sandals.when, state), false);
  state.age = 32;
  assert.equal(matchesCondition(sandals.when, state), true);
  assert.equal(matchesCondition(letters.when, state), false);
  state.age = 35;
  assert.equal(matchesCondition(letters.when, state), true);
  state.age = 44;
  assert.equal(matchesCondition(letters.when, state), false);
  assert.equal(matchesCondition(sandals.when, state), false);
});

test("new paid choices cannot spend cash a household does not have", () => {
  const state = context(35);
  state.economy!.cash = 0;
  let checked = 0;
  for (const event of added) for (const choice of event.choices) {
    if (!choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "cash" && effect.delta < 0))) continue;
    checked++;
    assert.equal(matchesCondition(choice.when, state), false, `${event.id}/${choice.id}`);
  }
  assert.ok(checked >= 4);
});

test("old annual fillers and recurring generic decisions now have long repeat limits", () => {
  const fillers = previous.events.filter(event => event.mode === "automatic" && event.trigger.type === "random" && event.maxOccurrences === 100 && event.cooldownYears === 3);
  assert.ok(fillers.length >= 60);
  for (const event of fillers) {
    const revised = find(event.id);
    assert.equal(revised.maxOccurrences, 2);
    assert.equal(revised.cooldownYears, 12);
    assert.equal(revised.text, event.text, "repeat tuning does not replace the authored story");
  }
  for (const id of ["medical-care-needed", "lender-payment-due", "lender-threat", "lender-confrontation", "career-petition-opening", "career-reader-opening"]) {
    assert.deepEqual(find(id), previous.events.find(event => event.id === id), `Protected route changed: ${id}`);
  }
});
