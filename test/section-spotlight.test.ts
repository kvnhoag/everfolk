import assert from "node:assert/strict";
import test from "node:test";
import { spotlightStrength } from "../client/lib/section-spotlight.ts";

test("the dim holds at full strength, then fades to nothing by the end", () => {
  const spot = { start: 0, end: 10_000 };
  assert.equal(spotlightStrength(spot, 0), 1);
  assert.equal(spotlightStrength(spot, 3_000), 1, "holds for three seconds");
  assert.ok(Math.abs(spotlightStrength(spot, 6_500) - 0.5) < 1e-9, "halfway through the fade");
  assert.equal(spotlightStrength(spot, 10_000), 0);
  const short = { start: 0, end: 4_000 };
  assert.equal(spotlightStrength(short, 2_000), 1, "a short highlight holds for half its time");
  assert.ok(spotlightStrength(short, 3_000) < 1);
});
