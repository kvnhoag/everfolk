import assert from "node:assert/strict";
import test from "node:test";
import { clockHeld, holdClock, releaseClock } from "../client/models/clock-hold.ts";
import { canRunLifeClock } from "../client/models/pause-state.ts";
import { createClockHoldStore } from "../client/state/clock-hold-store.ts";

const ready = { hasBegun: true, phase: "ready" as const };

test("a tip or a ? popover holds the clock until it closes", () => {
  const held = holdClock([], "help:focus");
  assert.equal(clockHeld(held), true);
  assert.equal(canRunLifeClock({ playing: true }, ready, true, clockHeld(held)), false, "the year waits while the player reads");
  const released = releaseClock(held, "help:focus");
  assert.equal(clockHeld(released), false);
  assert.equal(canRunLifeClock({ playing: true }, ready, true, clockHeld(released)), true, "it carries on by itself when the popover closes");
});

test("the clock resumes only if it was running before; a paused clock stays paused", () => {
  const held = holdClock(holdClock([], "tip"), "help:time-bar");
  assert.equal(canRunLifeClock({ playing: false }, ready, true, clockHeld(held)), false);
  assert.equal(canRunLifeClock({ playing: false }, ready, true, clockHeld(releaseClock(releaseClock(held, "tip"), "help:time-bar"))), false,
    "closing a tip never starts a clock the player paused");
});

test("moving from one ? to the next keeps the clock held until the last one closes", () => {
  const both = holdClock(holdClock([], "help:a"), "help:b");
  assert.equal(clockHeld(releaseClock(both, "help:a")), true);
  assert.equal(clockHeld(releaseClock(releaseClock(both, "help:a"), "help:b")), false);
  assert.deepEqual(holdClock(both, "help:a"), both, "holding twice changes nothing");
  assert.deepEqual(releaseClock([], "help:a"), [], "releasing a hold that is not there changes nothing");
});

test("the hold store tells subscribers when the clock is held or free", () => {
  const store = createClockHoldStore();
  const seen: boolean[] = [];
  const unsubscribe = store.subscribe(() => seen.push(store.held()));
  const release = store.hold("help:x");
  release();
  release();
  unsubscribe();
  store.hold("help:y");
  assert.deepEqual(seen, [true, false], "one change each way; a second release is ignored");
});
