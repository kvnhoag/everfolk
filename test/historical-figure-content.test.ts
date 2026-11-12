import assert from "node:assert/strict";
import test from "node:test";
import { FIGURE_INFLUENCES } from "../chain/catalog/figure-influences.ts";
import { correctHistoricalInfluences } from "../chain/catalog/historical-content.ts";
import { matchesCondition } from "../src/conditions.ts";
import { createEngine } from "../src/engine.ts";
import type { LifeState, WorldPack } from "../src/types.ts";
import world from "../worlds/alexandria-0.33.0.json" with { type: "json" };

const corrected = correctHistoricalInfluences(FIGURE_INFLUENCES);
function entry(id: string) {
  const found = corrected.find(item => item.id === id);
  assert.ok(found, id);
  return found;
}
const base = createEngine(world as unknown as WorldPack).start("historical-content");
function life(year: number, age: number, literacy = 35, reckoning = 35): LifeState {
  const state = structuredClone(base);
  state.year = year;
  state.age = age;
  assert.ok(state.character);
  state.character.skills.literacy = literacy;
  state.character.skills.reckoning = reckoning;
  return state;
}

test("historical corrections clone input and leave retained influence content unchanged", () => {
  const before = structuredClone(FIGURE_INFLUENCES);
  const output = correctHistoricalInfluences(FIGURE_INFLUENCES);
  assert.deepEqual(FIGURE_INFLUENCES, before);
  assert.notEqual(output, FIGURE_INFLUENCES);
  assert.notEqual(output[0], FIGURE_INFLUENCES[0]);
  assert.deepEqual(correctHistoricalInfluences(output), output, "repeated building is stable");
});

test("Lyceum material cannot arrive before 335 BCE and retains existing age limits", () => {
  const when = entry("aristotle.lyceum").event!.when;
  assert.equal(matchesCondition(when, life(-336, 14)), false);
  assert.equal(matchesCondition(when, life(-335, 15)), true);
  assert.equal(matchesCondition(when, life(-327, 23)), false);
  assert.equal(matchesCondition(when, life(-335, 11)), false);
  assert.match(entry("aristotle.tutor-court").event!.text, /a tutor familiar with Aristotle's arguments/);
  assert.doesNotMatch(entry("aristotle.tutor-court").event!.text, /trained in Aristotle's school/);
});

test("Euclidean teaching begins around 300 BCE for adults without an invented last year", () => {
  for (const id of ["euclid.school", "euclid.museum"]) {
    const when = entry(id).event!.when;
    assert.equal(matchesCondition(when, life(-301, 49)), false, id);
    assert.equal(matchesCondition(when, life(-300, 50)), true, id);
    assert.equal(matchesCondition(when, life(-280, 70)), true, id);
    assert.equal(matchesCondition(when, life(-300, 13)), false, id);
  }
  const when = entry("euclid.museum").event!.when;
  assert.equal(matchesCondition(when, life(-300, 50, 34, 35)), false);
  assert.equal(matchesCondition(when, life(-300, 50, 35, 34)), false);
});

test("geometry copy describes adult demonstrations without asserting Museum employment", () => {
  assert.doesNotMatch(entry("euclid.school").event!.text, /children/i);
  const geometry = entry("euclid.museum");
  const narrative = [geometry.label, geometry.event!.title, geometry.event!.text,
    ...geometry.event!.choices.flatMap(choice => [
      choice.text, choice.opportunity?.label ?? "", ...choice.outcomes.map(outcome => outcome.text),
    ])].join(" ");
  assert.doesNotMatch(narrative, /museum/i);
  assert.match(narrative, /Elements/);
  assert.equal(geometry.event!.title, "Work with the geometers");
  assert.deepEqual(geometry.event!.sourceIds, ["classical-euclid"]);
  assert.doesNotMatch(entry("cleomenes.granaries").event!.text, /granaries that Cleomenes had filled/);
  assert.equal(entry("cleomenes.granaries").event!.evidence, "fictional");
});

test("corrections preserve identifiers, rewards, weights and choice prerequisites", () => {
  assert.deepEqual(corrected.map(item => item.id), FIGURE_INFLUENCES.map(item => item.id));
  for (const original of FIGURE_INFLUENCES) {
    const revised = entry(original.id);
    assert.equal(revised.baseWeight, original.baseWeight, original.id);
    assert.deepEqual(revised.effects, original.effects, original.id);
    assert.equal(revised.event?.id, original.event?.id, original.id);
    assert.deepEqual(revised.event?.trigger, original.event?.trigger, original.id);
    assert.deepEqual(revised.event?.effects, original.event?.effects, original.id);
    assert.equal(revised.event?.mode, original.event?.mode, original.id);
    assert.deepEqual(revised.event?.choices.map(choice => choice.id), original.event?.choices.map(choice => choice.id), original.id);
    original.event?.choices.forEach((choice, index) => {
      const changed = revised.event!.choices[index];
      assert.deepEqual(changed.when, choice.when, choice.id);
      assert.deepEqual(changed.opportunity?.outcomeIds, choice.opportunity?.outcomeIds, choice.id);
      assert.deepEqual(changed.outcomes.map(outcome => ({ ...outcome, text: "" })), choice.outcomes.map(outcome => ({ ...outcome, text: "" })), choice.id);
    });
  }
});
