import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { canRunAutomaticDecision, canRunLifeClock, canUseLifeCommands, initialPauseState, updatePauseState } from "../client/models/pause-state.ts";
import type { PauseContext } from "../client/models/pause-state.ts";

const living: PauseContext = { hasBegun: true, phase: "ready" };
const pending: PauseContext = { hasBegun: true, phase: "choice" };

test("a restored living life is available for manual actions with automatic time paused", () => {
  const state = initialPauseState();
  assert.deepEqual(state, { playing: false });
  assert.equal(canUseLifeCommands(living), true);
  assert.equal(canRunLifeClock(state, living, true, false), false);
  const continued = updatePauseState(state, { type: "continue" }, living);
  assert.equal(canRunLifeClock(continued, living, true, false), true);
  assert.deepEqual(updatePauseState(state, { type: "playback", playing: true }, living), continued);
});

test("pausing and resuming cannot change the saved life, money, choices or RNG", () => {
  const world = structuredClone(pack) as WorldPack;
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  const engine = createEngine(world);
  const life = engine.advance(engine.start("pause-keeps-the-same-person"));
  const saved = engine.save(life);
  let state = updatePauseState(initialPauseState(), { type: "continue" }, living);
  for (let attempt = 0; attempt < 4; attempt++) {
    state = updatePauseState(state, { type: "pause" }, living);
    const unchanged = canRunLifeClock(state, living, true, false) ? engine.advance(life) : life;
    assert.equal(unchanged, life);
    assert.equal(engine.save(life), saved);
    state = updatePauseState(state, { type: "continue" }, living);
    assert.equal(engine.save(life), saved);
  }
  state = updatePauseState(state, { type: "pause" }, living);
  assert.equal(state.playing, false);
  assert.equal(canUseLifeCommands(living), true, "A paused player can explicitly advance one year.");
  const next = engine.advance(life);
  assert.equal(next.age, life.age + 1);
  assert.deepEqual(next.commands.slice(life.commands.length), [{ type: "advance" }]);
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
});

test("a paused pending decision remains available manually without enabling Auto choice", () => {
  const state = initialPauseState();
  assert.equal(canUseLifeCommands(pending), true);
  assert.equal(canRunAutomaticDecision(state, pending, true, false, true), false);
  const continued = updatePauseState(state, { type: "continue" }, pending);
  assert.equal(canRunLifeClock(continued, pending, true, false), false,
    "Resuming restores the decision rather than skipping it.");
  assert.equal(canRunAutomaticDecision(continued, pending, true, false, true), true);
  assert.equal(canRunAutomaticDecision(continued, pending, true, false, false), false);
  assert.equal(canRunAutomaticDecision(continued, pending, false, false, true), false);
  assert.equal(canRunAutomaticDecision(continued, pending, true, true, true), false);
  const paused = updatePauseState(continued, { type: "playback", playing: false }, pending);
  assert.equal(canRunAutomaticDecision(paused, pending, true, false, true), false);
  assert.equal(canUseLifeCommands(pending), true);
});

test("leaving the tab pauses playback until the player explicitly resumes", () => {
  const playing = updatePauseState(initialPauseState(), { type: "continue" }, living);
  const away = updatePauseState(playing, { type: "pause" }, living);
  assert.equal(canRunLifeClock(away, living, false, false), false);
  assert.equal(canRunLifeClock(away, living, true, false), false,
    "Visibility returning alone does not resume the clock.");
  assert.equal(canRunAutomaticDecision(away, pending, true, false, true), false);
  assert.equal(canUseLifeCommands(living), true);
  const returned = updatePauseState(away, { type: "continue" }, living);
  assert.equal(canRunLifeClock(returned, living, true, false), true);
  assert.equal(canRunLifeClock(returned, living, false, false), false);
  assert.equal(canRunLifeClock(returned, living, true, true), false);
});

test("fresh and unfinished births keep their existing Begin life flow", () => {
  const unborn: PauseContext = { hasBegun: false, phase: "ready" };
  const state = initialPauseState();
  assert.deepEqual(state, { playing: false });
  assert.deepEqual(updatePauseState(state, { type: "pause" }, unborn), state);
  assert.deepEqual(updatePauseState(state, { type: "continue" }, unborn), state);
  assert.deepEqual(updatePauseState(state, { type: "playback", playing: true }, unborn), state);
  assert.equal(canUseLifeCommands(unborn), false);
});

test("a begun age-zero save stays available while rebirth resets playback", () => {
  const state = updatePauseState(initialPauseState(), { type: "continue" }, living);
  assert.equal(canUseLifeCommands(living), true, "An already-begun age-zero life is available.");
  const fresh = updatePauseState(state, { type: "fresh" }, { hasBegun: false, phase: "ready" });
  assert.deepEqual(fresh, { playing: false });
  assert.equal(canUseLifeCommands({ hasBegun: false, phase: "ready" }), false);
});

test("completed lives cannot resume automatic time or accept further life commands", () => {
  const ended: PauseContext = { hasBegun: true, phase: "ended" };
  const state = initialPauseState();
  assert.deepEqual(state, { playing: false });
  for (const event of [{ type: "pause" }, { type: "continue" }, { type: "playback", playing: true }] as const) {
    assert.deepEqual(updatePauseState(state, event, ended), state);
  }
  assert.equal(canUseLifeCommands(ended), false);
  assert.equal(canRunLifeClock(state, ended, true, false), false);
  assert.equal(canRunAutomaticDecision(state, ended, true, false, true), false);
  const playing = updatePauseState(initialPauseState(), { type: "continue" }, living);
  assert.deepEqual(updatePauseState(playing, { type: "ended" }, ended), state);
});
