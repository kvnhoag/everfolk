import assert from "node:assert/strict";
import test from "node:test";
import { legendaryCardPointer } from "../client/models/legendary-card-pointer.ts";

const bounds = { left: 100, top: 200, width: 400, height: 560 };
test("a centered cursor leaves the card level", () => {
  const pose = legendaryCardPointer(300, 480, bounds)!;
  assert.equal(pose.rotateX, 0);
  assert.equal(pose.rotateY, 0);
});
test("opposite corners mirror the gentle card tilt", () => {
  const first = legendaryCardPointer(100, 200, bounds)!;
  const last = legendaryCardPointer(500, 760, bounds)!;
  assert.equal(first.rotateX, 3.5);
  assert.equal(first.rotateY, -4.5);
  assert.equal(last.rotateX, -first.rotateX);
  assert.equal(last.rotateY, -first.rotateY);
});
test("outside pointers stay clamped to the nearest card corner", () => {
  assert.deepEqual(legendaryCardPointer(-1000, -1000, bounds), legendaryCardPointer(100, 200, bounds));
  assert.deepEqual(legendaryCardPointer(9999, 9999, bounds), legendaryCardPointer(500, 760, bounds));
});
test("unmeasurable cards and invalid pointer values are ignored", () => {
  assert.equal(legendaryCardPointer(NaN, 300, bounds), null);
  assert.equal(legendaryCardPointer(200, Infinity, bounds), null);
  assert.equal(legendaryCardPointer(200, 300, { ...bounds, width: 0 }), null);
  assert.equal(legendaryCardPointer(200, 300, { ...bounds, height: -1 }), null);
  assert.equal(legendaryCardPointer(200, 300, { ...bounds, left: Infinity }), null);
});
