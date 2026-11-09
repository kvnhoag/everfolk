import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { LifeState } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };

const engine = createEngine(pack);

function scene(seed = "alexandria-scene"): LifeState {
  let state = engine.start(seed);
  while (state.age < 18) {
    assert.equal(state.phase, "ready", "Childhood must remain quiet for this sample.");
    state = engine.advance(state);
  }
  return state;
}

function complete(firstChoice: string, seed: string): LifeState {
  let state = engine.choose(scene(seed), firstChoice);
  for (let step = 0; step < 30 && state.phase !== "ended"; step++) {
    state = state.phase === "choice"
      ? engine.choose(state, engine.getChoices(state)[0].id)
      : engine.advance(state);
  }
  assert.equal(state.phase, "ended");
  return state;
}

test("Alexandria scene opens at eighteen in 48 BCE with three available paths", () => {
  const state = scene();
  assert.equal(state.age, 18);
  assert.equal(state.year, -48);
  assert.equal(state.pendingEventId, "a-place-on-the-manifest");
  assert.deepEqual(engine.getChoices(state).map(choice => choice.id), ["stay", "sail", "study"]);
  assert.equal(state.journal.filter(entry => entry.type === "event").length, 1);
});

test("a pending sample decision survives save/load exactly", () => {
  const state = scene("sample-save");
  assert.deepEqual(engine.load(engine.save(state)), state);
  const restored = engine.load(engine.save(state));
  assert.deepEqual(engine.choose(restored, "sail"), engine.choose(state, "sail"));
});

test("each initial path reaches its own living chapter ending with bounded stats", () => {
  const expected = {
    stay: "a-place-to-belong",
    sail: "a-life-on-the-water",
    study: "a-keeper-of-words",
  };
  for (const [choice, ending] of Object.entries(expected)) {
    for (let seed = 0; seed < 12; seed++) {
      const state = complete(choice, `path-${choice}-${seed}`);
      assert.equal(state.endingId, ending);
      assert.equal(state.age, 23);
      assert.equal(state.year, -43);
      assert.equal(state.pendingEventId, null);
      for (const [id, value] of Object.entries(state.stats)) {
        assert.ok(Number.isFinite(value));
        assert.ok(value >= engine.world.stats[id].min && value <= engine.world.stats[id].max);
      }
      assert.deepEqual(engine.load(engine.save(state)), state);
    }
  }
});

test("path-specific follow-up events match the initial choice", () => {
  const expected = {
    sail: "letters-across-the-water",
    study: "the-unfamiliar-page",
    stay: "the-neighbors-request",
  };
  for (const [choice, event] of Object.entries(expected)) {
    let state = engine.choose(scene(`followup-${choice}`), choice);
    assert.equal(state.phase, "ready");
    state = engine.advance(state);
    assert.equal(state.age, 19);
    assert.equal(state.pendingEventId, event);
  }
});
