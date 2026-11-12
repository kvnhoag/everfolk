import assert from "node:assert/strict";
import test from "node:test";
import { nextStableHeight } from "../client/hooks/useStableHeight.ts";

test("a tabbed box keeps the height of its tallest tab seen so far", () => {
  assert.equal(nextStableHeight(0, 1300), 1300);
  assert.equal(nextStableHeight(1300, 640), 1300, "A shorter tab does not shrink the box.");
  assert.equal(nextStableHeight(1300, 1420), 1420);
  assert.equal(nextStableHeight(900, Number.NaN), 900);
});
