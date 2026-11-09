import assert from "node:assert/strict";
import test from "node:test";
import { createBirthRollClock } from "../client/birth-roll-clock.ts";
import { BIRTH_ROLL_DURATION_MS, getBirthDigitReels, getBirthRollFrame, getBirthRollTiming } from "../client/birth-stat-roll.ts";

test("all cards start moving on the first active frame and still settle in order", () => {
  assert.deepEqual(getBirthRollFrame(0, 4).phases, ["rolling", "rolling", "rolling", "rolling"]);
  for (let card = 0; card < 4; card++) {
    assert.equal(getBirthRollTiming(card, 4).startsAt, 0);
    const stat = { id: "zero", label: "Knowledge", value: 0, range: { min: 0, max: 2 } };
    const initial = getBirthDigitReels(stat, "first-frame", 0, card, 4);
    const moving = getBirthDigitReels(stat, "first-frame", 16, card, 4);
    assert.equal(moving.length, 1);
    assert.notEqual(moving[0].position, initial[0].position);
    assert.equal(moving[0].direction, initial[0].direction);
  }
  assert.deepEqual([0, 1, 2, 3].map(card => getBirthRollTiming(card, 4).settlesAt), [1475, 2050, 2625, 3200]);
});

test("slow foreground frames do not stretch a 3.2-second reveal", () => {
  const clock = createBirthRollClock(BIRTH_ROLL_DURATION_MS);
  clock.resume(100);
  assert.equal(clock.tick(1_100), 1_000, "A one-second foreground stall still counts as one second.");
  assert.equal(clock.tick(2_100), 2_000);
  assert.equal(clock.tick(3_300), BIRTH_ROLL_DURATION_MS);
  assert.equal(clock.tick(6_000), BIRTH_ROLL_DURATION_MS);
});

test("hidden time is excluded and resuming continues the same roll", () => {
  const clock = createBirthRollClock(BIRTH_ROLL_DURATION_MS);
  clock.resume(0);
  assert.equal(clock.tick(200), 200);
  assert.equal(clock.pause(300), 300);
  assert.equal(clock.tick(30_000), 300, "No hidden-tab catch-up.");
  clock.resume(30_000);
  assert.equal(clock.tick(30_016), 316);
  assert.equal(clock.pause(30_100), 400);
  assert.equal(clock.pause(40_000), 400, "Repeated cleanup cannot count hidden time twice.");
});

test("skip and completed rolls stay complete without restarting their clock", () => {
  const clock = createBirthRollClock(BIRTH_ROLL_DURATION_MS);
  clock.resume(0);
  assert.equal(clock.finish(), BIRTH_ROLL_DURATION_MS);
  clock.resume(20_000);
  assert.equal(clock.tick(20_016), BIRTH_ROLL_DURATION_MS);
  assert.equal(clock.finish(), BIRTH_ROLL_DURATION_MS);
});
