import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/index.ts";
import type { WorldPack } from "../src/types.ts";
import pack from "../worlds/alexandria-sample.json" with { type: "json" };
import { canRunAutomaticDecision, canRunLifeClock, canUseLifeCommands, initialPauseState, updatePauseState } from "../client/pause-state.ts";
import type { PauseContext } from "../client/pause-state.ts";

const living: PauseContext = { hasBegun: true, phase: "ready" };
const pending: PauseContext = { hasBegun: true, phase: "choice" };

test("a restored living life waits for Continue before accepting any progression", () => {
  const state = initialPauseState(living);
  assert.deepEqual(state, { screenOpen: true, playing: false });
  assert.equal(canUseLifeCommands(state, living), false);
  assert.equal(canRunLifeClock(state, living, true, false), false);
  assert.deepEqual(updatePauseState(state, { type: "playback", playing: true }, living), state,
    "A stale playback callback cannot bypass the return screen.");
  const continued = updatePauseState(state, { type: "continue" }, living);
  assert.equal(canUseLifeCommands(continued, living), true);
  assert.equal(canRunLifeClock(continued, living, true, false), true);
});

test("pausing and returning cannot change the saved life, money, choices or RNG", () => {
  const world = structuredClone(pack) as WorldPack;
  world.mortality!.bands.forEach(band => { band.annualProbability = 0; });
  const engine = createEngine(world);
  const life = engine.advance(engine.start("pause-keeps-the-same-person"));
  const saved = engine.save(life);
  let state = updatePauseState(initialPauseState(living), { type: "continue" }, living);
  for (let attempt = 0; attempt < 4; attempt++) {
    state = updatePauseState(state, { type: "show" }, living);
    const unchanged = canUseLifeCommands(state, living) ? engine.advance(life) : life;
    assert.equal(unchanged, life);
    state = updatePauseState(state, { type: "continue" }, living);
    assert.equal(engine.save(life), saved);
  }
  const next = engine.advance(life);
  assert.equal(next.age, life.age + 1);
  assert.deepEqual(next.commands.slice(life.commands.length), [{ type: "advance" }]);
  assert.deepEqual(engine.replay(next.seed, next.commands), next);
});

test("returning to a pending decision waits before either manual or Auto choice", () => {
  const state = initialPauseState(pending);
  assert.equal(canUseLifeCommands(state, pending), false);
  assert.equal(canRunAutomaticDecision(state, pending, true, false, true), false);
  const continued = updatePauseState(state, { type: "continue" }, pending);
  assert.equal(canUseLifeCommands(continued, pending), true);
  assert.equal(canRunLifeClock(continued, pending, true, false), false,
    "Continue restores the decision rather than skipping it.");
  assert.equal(canRunAutomaticDecision(continued, pending, true, false, true), true);
  assert.equal(canRunAutomaticDecision(continued, pending, true, false, false), false);
});

test("leaving the tab closes playback until the player explicitly continues", () => {
  const playing = updatePauseState(initialPauseState(living), { type: "continue" }, living);
  const away = updatePauseState(playing, { type: "show" }, living);
  assert.equal(canRunLifeClock(away, living, false, false), false);
  assert.equal(canRunLifeClock(away, living, true, false), false,
    "Visibility returning alone does not resume the clock.");
  assert.equal(canRunAutomaticDecision(away, pending, true, false, true), false);
  const returned = updatePauseState(away, { type: "continue" }, living);
  assert.equal(canRunLifeClock(returned, living, true, false), true);
  assert.equal(canRunLifeClock(returned, living, false, false), false);
  assert.equal(canRunLifeClock(returned, living, true, true), false);
});

test("fresh and unfinished births keep their existing Begin life flow", () => {
  const unborn: PauseContext = { hasBegun: false, phase: "ready" };
  const state = initialPauseState(unborn);
  assert.deepEqual(state, { screenOpen: false, playing: false });
  assert.deepEqual(updatePauseState(state, { type: "show" }, unborn), state);
  assert.deepEqual(updatePauseState(state, { type: "continue" }, unborn), state);
  assert.deepEqual(updatePauseState(state, { type: "playback", playing: true }, unborn), state);
  assert.equal(canUseLifeCommands(state, unborn), false);
});

test("a begun age-zero save is resumable, while rebirth clears its presentation gate", () => {
  const state = initialPauseState(living);
  assert.equal(state.screenOpen, true, "Age zero is not evidence that an already-begun life is fresh.");
  const fresh = updatePauseState(state, { type: "fresh" }, { hasBegun: false, phase: "ready" });
  assert.deepEqual(fresh, { screenOpen: false, playing: false });
  assert.equal(canUseLifeCommands(fresh, { hasBegun: false, phase: "ready" }), false);
});

test("completed lives do not show a resumable pause screen or accept Continue", () => {
  const ended: PauseContext = { hasBegun: true, phase: "ended" };
  const state = initialPauseState(ended);
  assert.deepEqual(state, { screenOpen: false, playing: false });
  for (const event of [{ type: "show" }, { type: "continue" }, { type: "playback", playing: true }] as const) {
    assert.deepEqual(updatePauseState(state, event, ended), state);
  }
  assert.equal(canUseLifeCommands(state, ended), false);
  assert.equal(canRunLifeClock(state, ended, true, false), false);
  assert.equal(canRunAutomaticDecision(state, ended, true, false, true), false);
});
