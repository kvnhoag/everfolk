import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PLAYBACK_SPEED, YEAR_DURATION_MS, secondsPerYear } from "../client/models/playback.ts";

test("a life starts at 4× so a year passes in about six seconds", () => {
  assert.equal(DEFAULT_PLAYBACK_SPEED, 2);
  assert.equal(YEAR_DURATION_MS, 25_000);
  assert.equal(secondsPerYear(DEFAULT_PLAYBACK_SPEED), 12.5);
});
