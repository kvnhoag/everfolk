import assert from "node:assert/strict";
import test from "node:test";
import { CARD_RARITY_ORDER, orderedVariantRanks, stepVariantIndex, variantStackSlot, initialWheelGesture, reduceVariantWheel, swipeVariantStep } from "../client/models/figure-card-carousel.ts";
const input = (deltaY: number, timeStamp: number, deltaMode = 0, deltaX = 0) => ({ deltaY, timeStamp, deltaMode, deltaX });

test("available variants follow Common through Legendary without mutating or expanding the list", () => {
  const ranks = Object.freeze(["Legendary", "Uncommon", "Epic", "Common", "Rare"] as const);
  assert.deepEqual(orderedVariantRanks(ranks), ["Common", "Uncommon", "Rare", "Epic", "Legendary"]);
  assert.deepEqual(ranks, ["Legendary", "Uncommon", "Epic", "Common", "Rare"]);
  assert.deepEqual(orderedVariantRanks(["Legendary", "Epic"]), ["Epic", "Legendary"]);
  assert.deepEqual(orderedVariantRanks(["Epic", "Uncommon", "Rare"]), ["Uncommon", "Rare", "Epic"]);
  assert.deepEqual(orderedVariantRanks([]), []);
  assert.deepEqual(orderedVariantRanks(["Epic"]), ["Epic"]);
  assert.equal(Object.isFrozen(CARD_RARITY_ORDER), true);
});

test("navigation reaches adjacent rarities and never wraps at either boundary", () => {
  for (let count = 1; count <= 5; count++) {
    assert.equal(stepVariantIndex(0, count, -1), 0);
    assert.equal(stepVariantIndex(count - 1, count, 1), count - 1);
    for (let index = 0; index < count; index++) {
      assert.equal(stepVariantIndex(index, count, 0), index);
      assert.equal(stepVariantIndex(index, count, 1), Math.min(index + 1, count - 1));
      assert.equal(stepVariantIndex(index, count, -1), Math.max(index - 1, 0));
    }
  }
  assert.equal(stepVariantIndex(Number.NaN, 0, 1), 0);
  assert.equal(stepVariantIndex(99, 3, -1), 1);
  assert.equal(stepVariantIndex(-99, 3, 1), 1);
});

test("every selection preserves monotonically ordered left and right stack positions", () => {
  for (let count = 1; count <= 5; count++) {
    for (let selected = 0; selected < count; selected++) {
      const slots = Array.from({ length: count }, (_, index) => variantStackSlot(index, selected, count));
      assert.equal(slots[selected], 0);
      assert.equal(slots.filter(slot => slot === 0).length, 1);
      for (let index = 0; index < count; index++) {
        assert.equal(slots[index], index - selected);
        if (index < selected) assert.ok(slots[index] < 0);
        if (index > selected) assert.ok(slots[index] > 0);
        if (index > 0) assert.ok(slots[index] > slots[index - 1]);
      }
    }
  }
  assert.equal(variantStackSlot(Number.NaN, Number.NaN, 0), 0);
});

test("small trackpad deltas accumulate to one transition at the exact threshold", () => {
  const initial = initialWheelGesture();
  const first = reduceVariantWheel(initial, input(23, 100), 3);
  assert.equal(first.step, 0);
  const second = reduceVariantWheel(first.state, input(24, 150), 3);
  assert.equal(second.step, 0);
  const third = reduceVariantWheel(second.state, input(1, 170), 3);
  assert.equal(third.step, 1);
  assert.equal(third.state.accumulated, 0);
  assert.deepEqual(initial, initialWheelGesture());
});

test("wheel momentum cannot skip variants during the cooldown", () => {
  const first = reduceVariantWheel(initialWheelGesture(), input(1000, 100), 3);
  assert.equal(first.step, 1);
  const momentum = reduceVariantWheel(first.state, input(1000, 519), 3);
  assert.equal(momentum.step, 0);
  assert.equal(momentum.state.accumulated, 0);
  assert.equal(reduceVariantWheel(momentum.state, input(48, 520), 3).step, 1);
});

test("reversing direction or pausing starts a fresh wheel gesture", () => {
  const first = reduceVariantWheel(initialWheelGesture(), input(40, 100), 3);
  const reversed = reduceVariantWheel(first.state, input(-40, 130), 3);
  assert.equal(reversed.step, 0);
  assert.equal(reversed.state.accumulated, -40);
  assert.equal(reduceVariantWheel(reversed.state, input(-8, 150), 3).step, -1);
  const paused = reduceVariantWheel(first.state, input(20, 341), 3);
  assert.equal(paused.step, 0);
  assert.equal(paused.state.accumulated, 20);
});

test("line, page and horizontal wheel input use normalized dominant movement", () => {
  assert.equal(reduceVariantWheel(initialWheelGesture(), input(3, 100, 1), 2).step, 1);
  assert.equal(reduceVariantWheel(initialWheelGesture(), input(-1, 100, 2), 2).step, -1);
  assert.equal(reduceVariantWheel(initialWheelGesture(), input(2, 100, 0, -50), 2).step, -1);
  assert.equal(reduceVariantWheel(initialWheelGesture(), { ...input(1, 100, 2), pageHeight: 30 }, 2).step, 0);
});

test("invalid deltas are inert and a fresh event clock does not inherit a cooldown", () => {
  const state = initialWheelGesture();
  assert.equal(reduceVariantWheel(state, input(Number.NaN, 100), 3).step, 0);
  assert.equal(reduceVariantWheel(state, input(100, Number.NaN), 3).step, 0);
  const stepped = reduceVariantWheel(state, input(60, 1000), 3);
  assert.equal(reduceVariantWheel(stepped.state, input(60, 10), 3).step, 1);
  assert.equal(reduceVariantWheel(stepped.state, input(100, 1100), 1).step, 0);
});

test("only deliberate horizontal swipes navigate; vertical scrolling stays available", () => {
  assert.equal(swipeVariantStep(-40, 8), 1);
  assert.equal(swipeVariantStep(40, -8), -1);
  assert.equal(swipeVariantStep(-39, 0), 0);
  assert.equal(swipeVariantStep(-80, 100), 0);
  assert.equal(swipeVariantStep(50, 50), 0);
  assert.equal(swipeVariantStep(Number.NaN, 0), 0);
});
