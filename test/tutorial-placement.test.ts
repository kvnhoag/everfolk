import assert from "node:assert/strict";
import test from "node:test";
import { intersectRect, placeTutorialCard, spotlightRect, tutorialScrollPlan, unionRect, type Rect } from "../client/models/tutorial-placement.ts";

const card = { width: 360, height: 240 };
const viewports = [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }];

function inside(position: { top: number; left: number }, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  return position.left >= 0 && position.top >= 0 && position.left + size.width <= viewport.width && position.top + size.height <= viewport.height;
}

function overlaps(a: Rect, b: Rect) {
  return a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
}

test("without a target the card is centered", () => {
  const placed = placeTutorialCard(null, card, viewports[0]);
  assert.equal(placed.placement, "center");
  assert.equal(placed.left, (1440 - 360) / 2);
  assert.equal(placed.top, (900 - 240) / 2);
});

test("the card prefers the space below a target and does not cover it", () => {
  const target = { top: 100, left: 200, width: 300, height: 60 };
  const placed = placeTutorialCard(target, card, viewports[0]);
  assert.equal(placed.placement, "bottom");
  assert.ok(placed.top >= target.top + target.height);
  assert.ok(!overlaps({ ...placed, ...card }, target));
});

test("a target near the bottom gets the card above it", () => {
  const target = { top: 760, left: 600, width: 300, height: 80 };
  const placed = placeTutorialCard(target, card, viewports[0]);
  assert.equal(placed.placement, "top");
  assert.ok(placed.top + card.height <= target.top);
});

test("a tall target gets the card at its side", () => {
  const target = { top: 40, left: 40, width: 600, height: 820 };
  const placed = placeTutorialCard(target, card, viewports[0]);
  assert.equal(placed.placement, "right");
  assert.ok(!overlaps({ ...placed, ...card }, target));
});

test("the card always stays fully on screen, wherever the target is", () => {
  for (const viewport of viewports) {
    const size = { width: Math.min(card.width, viewport.width - 24), height: card.height };
    for (let top = -200; top <= viewport.height + 200; top += 97) {
      for (let left = -200; left <= viewport.width + 200; left += 131) {
        for (const [width, height] of [[40, 40], [400, 120], [1200, 700], [viewport.width, viewport.height]]) {
          const placed = placeTutorialCard({ top, left, width, height }, size, viewport);
          assert.ok(inside(placed, size, viewport), `${viewport.width}x${viewport.height} target ${left},${top} ${width}x${height} -> ${placed.left},${placed.top}`);
        }
      }
    }
  }
});

test("the spotlight pads the target and stays within the viewport", () => {
  assert.deepEqual(spotlightRect({ top: 100, left: 100, width: 200, height: 50 }, viewports[0], 8), { top: 92, left: 92, width: 216, height: 66 });
  assert.deepEqual(spotlightRect({ top: -50, left: -10, width: 300, height: 100 }, viewports[0], 8), { top: 0, left: 0, width: 298, height: 58 });
  assert.equal(spotlightRect(null, viewports[0], 8), null);
  assert.equal(spotlightRect({ top: 1200, left: 0, width: 100, height: 100 }, viewports[0], 8), null, "an off-screen target has no spotlight");
});

test("several matches are highlighted together", () => {
  assert.deepEqual(unionRect([{ top: 10, left: 20, width: 100, height: 50 }, { top: 80, left: 0, width: 40, height: 40 }]), { top: 10, left: 0, width: 120, height: 110 });
  assert.equal(unionRect([]), null);
});

test("a target is scrolled to the middle, and a tall one only far enough to show its top", () => {
  assert.deepEqual(tutorialScrollPlan({ top: 1400, left: 0, width: 300, height: 80 }, 900), { block: "center", marginTop: 0 });
  assert.equal(tutorialScrollPlan({ top: 300, left: 0, width: 300, height: 80 }, 900)?.block, "center", "even a visible target is centered");
  assert.equal(tutorialScrollPlan({ top: 260, left: 0, width: 900, height: 2000 }, 900), null, "a tall target whose top is in view stays put");
  assert.deepEqual(tutorialScrollPlan({ top: 1500, left: 0, width: 900, height: 2000 }, 900), { block: "start", marginTop: 198 }, "its top lands below sticky headers");
  assert.deepEqual(tutorialScrollPlan({ top: -900, left: 0, width: 900, height: 2000 }, 900), { block: "start", marginTop: 198 });
});

test("a target inside a scrolling popup is clipped to the popup's visible area", () => {
  assert.deepEqual(intersectRect({ top: 280, left: 250, width: 930, height: 1400 }, { top: 70, left: 220, width: 1000, height: 760 }), { top: 280, left: 250, width: 930, height: 550 });
  assert.equal(intersectRect({ top: 900, left: 0, width: 10, height: 10 }, { top: 0, left: 0, width: 100, height: 100 }), null);
});
