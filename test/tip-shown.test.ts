import assert from "node:assert/strict";
import test from "node:test";
import { tipShownStore } from "../client/state/tip-shown.ts";

test("the tip-shown flag notifies only on real changes, so the clock is held only while a card is on screen", () => {
  let calls = 0;
  const stop = tipShownStore.subscribe(() => { calls += 1; });
  assert.equal(tipShownStore.get(), false);
  tipShownStore.set(true);
  tipShownStore.set(true);
  assert.equal(tipShownStore.get(), true);
  tipShownStore.set(false);
  assert.equal(calls, 2);
  stop();
  tipShownStore.set(true);
  assert.equal(calls, 2, "an unsubscribed listener hears nothing");
  tipShownStore.set(false);
});
