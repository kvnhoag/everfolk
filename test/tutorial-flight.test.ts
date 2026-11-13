import assert from "node:assert/strict";
import test from "node:test";
import { FLIGHT_MS, flightTransform, placeHelpTip } from "../client/models/tutorial-flight.ts";

test("the card flies about 300 ms", () => {
  assert.ok(FLIGHT_MS >= 250 && FLIGHT_MS <= 350);
});

test("the flight transform shrinks the card onto the Tutorial button (top-left origin)", () => {
  const card = { top: 300, left: 500, width: 380, height: 200 };
  const button = { top: 20, left: 1200, width: 95, height: 36 };
  assert.equal(flightTransform(card, button), "translate(700px, -280px) scale(0.25, 0.18)");
  assert.equal(flightTransform(card, card), "translate(0px, 0px) scale(1, 1)");
});

test("an empty box never divides by zero", () => {
  assert.equal(flightTransform({ top: 0, left: 0, width: 0, height: 0 }, { top: 10, left: 10, width: 20, height: 20 }), "translate(10px, 10px) scale(1, 1)");
});

const viewport = { width: 1440, height: 900 };
const tip = { width: 240, height: 60 };

test("a ? tooltip opens below the button, right-aligned to it", () => {
  const button = { top: 100, left: 600, width: 22, height: 22 };
  assert.deepEqual(placeHelpTip(button, tip, viewport), { top: 130, left: 382, side: "below" });
});

test("the tooltip flips above near the bottom and stays inside the viewport at the edges", () => {
  const low = placeHelpTip({ top: 870, left: 600, width: 22, height: 22 }, tip, viewport);
  assert.equal(low.side, "above");
  assert.equal(low.top, 870 - 8 - 60);
  const leftEdge = placeHelpTip({ top: 100, left: 4, width: 22, height: 22 }, tip, viewport);
  assert.ok(leftEdge.left >= 8);
  const rightEdge = placeHelpTip({ top: 100, left: 1430, width: 22, height: 22 }, tip, viewport);
  assert.ok(rightEdge.left + tip.width <= viewport.width - 8);
  const tiny = placeHelpTip({ top: 10, left: 10, width: 22, height: 22 }, { width: 500, height: 60 }, { width: 320, height: 568 });
  assert.equal(tiny.left, 0, "a tooltip wider than the screen starts at its edge");
});
