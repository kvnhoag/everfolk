import assert from "node:assert/strict";
import test from "node:test";
import { createPlaybackClock, playbackYearKey } from "../client/playback-clock.ts";

const YEAR = 25_000;
const key = "life:year-1";
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test("Resume keeps the time already spent in the year instead of restarting 25 seconds", () => {
  const clock = createPlaybackClock(key, YEAR);
  clock.resume(key, YEAR, 100);
  close(clock.pause(20_100).progress, .8);
  close(clock.read().remainingMs, 5_000);
  clock.resume(key, YEAR, 90_000);
  close(clock.read(91_000).remainingMs, 4_000);
  close(clock.read(95_000).remainingMs, 0);
});

test("repeated overlays and hidden time leave the paused year unchanged", () => {
  const clock = createPlaybackClock(key, YEAR);
  clock.resume(key, YEAR, 0);
  clock.pause(10_000);
  clock.hold(key, YEAR, 500_000);
  close(clock.read(900_000).progress, .4);
  clock.resume(key, YEAR, 900_000);
  clock.pause(905_000);
  close(clock.read().remainingMs, 10_000);
  clock.resume(key, YEAR, 2_000_000);
  close(clock.read(2_001_000).remainingMs, 9_000);
});

test("speed changes retain year progress and apply the new speed only to remaining time", () => {
  const clock = createPlaybackClock(key, YEAR);
  clock.resume(key, YEAR, 0);
  clock.pause(10_000);
  clock.hold(key, YEAR / 4, 20_000);
  close(clock.read().progress, .4);
  close(clock.read().remainingMs, 3_750);
  clock.resume(key, YEAR / 4, 20_000);
  close(clock.read(21_250).progress, .6);
  clock.pause(21_250);
  clock.hold(key, YEAR, 30_000);
  close(clock.read().remainingMs, 10_000);
});

test("same-year snapshots preserve progress while new years, lives and imports reset it", () => {
  const clock = createPlaybackClock(key, YEAR);
  clock.resume(key, YEAR, 0);
  clock.pause(12_500);
  clock.setYear(key);
  close(clock.read().progress, .5);
  clock.setYear("life:year-2");
  close(clock.read().progress, 0);
  clock.resume("life:year-2", YEAR, 50_000);
  clock.pause(55_000);
  clock.reset("life:year-2");
  close(clock.read().remainingMs, YEAR);
  clock.resume("another-life:year-2", YEAR, 80_000);
  close(clock.read().progress, 0);
});

test("stale callbacks cannot advance a resumed year or claim the same year twice", () => {
  const clock = createPlaybackClock(key, YEAR);
  const stale = clock.resume(key, YEAR, 0);
  clock.pause(20_000);
  assert.equal(clock.takeDue(stale, 100_000), false);
  const current = clock.resume(key, YEAR, 100_000);
  assert.equal(clock.takeDue(stale, 104_999), false);
  assert.equal(clock.takeDue(current, 104_999), false);
  assert.equal(clock.takeDue(current, 105_000), true);
  assert.equal(clock.takeDue(current, 105_000), false);
  const replayed = clock.resume(key, YEAR, 200_000);
  assert.equal(clock.takeDue(replayed, 200_000), false);
  clock.setYear("life:year-2");
  const next = clock.resume("life:year-2", YEAR, 200_000);
  assert.equal(clock.takeDue(next, 225_000), true);
});

test("the year identity ignores same-year commands but distinguishes worlds, lives and ages", () => {
  const life = { worldFingerprint: "world", seed: "seed", age: 7 };
  assert.equal(playbackYearKey({ ...life }), playbackYearKey(life));
  for (const changed of [{ ...life, age: 8 }, { ...life, seed: "other" }, { ...life, worldFingerprint: "other" }]) {
    assert.notEqual(playbackYearKey(changed), playbackYearKey(life));
  }
});


test("an overlay holds the clock immediately without requiring a separate Pause action", () => {
  const clock = createPlaybackClock(key, YEAR);
  const oldTimer = clock.resume(key, YEAR, 100);
  close(clock.hold(key, YEAR, 12_600).progress, .5);
  assert.equal(clock.isCurrent(oldTimer), false);
  close(clock.read(500_000).remainingMs, 12_500);
  const resumed = clock.resume(key, YEAR, 500_000);
  assert.equal(clock.takeDue(resumed, 512_499), false);
  assert.equal(clock.takeDue(resumed, 512_500), true);
});

test("a delayed foreground callback completes one year without carrying missed years forward", () => {
  const clock = createPlaybackClock(key, YEAR);
  const timer = clock.resume(key, YEAR, 0);
  assert.equal(clock.takeDue(timer, 100_000), true);
  clock.setYear("life:year-2");
  clock.resume("life:year-2", YEAR, 100_000);
  close(clock.read().progress, 0);
  close(clock.read(101_000).remainingMs, 24_000);
});
