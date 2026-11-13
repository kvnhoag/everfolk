import assert from "node:assert/strict";
import test from "node:test";
import { drawApprovedCardFace } from "../client/lib/booster/card-face.mjs";

test("the approved face keeps its complete authored canvas and receives only its live serial", () => {
  const calls: unknown[][] = [];
  const context = {
    imageSmoothingEnabled: true, font: "", textAlign: "", textBaseline: "", letterSpacing: "", fillStyle: "",
    drawImage(...args: unknown[]) { calls.push(["image", ...args]); },
    fillText(...args: unknown[]) { calls.push(["text", ...args]); },
  };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const image = { width: 900, height: 1260 };
  assert.equal(drawApprovedCardFace(canvas, image, "007/025"), canvas);
  assert.deepEqual([canvas.width, canvas.height], [900, 1260]);
  assert.equal(context.imageSmoothingEnabled, false);
  assert.deepEqual(calls, [["image", image, 0, 0, 900, 1260], ["text", "007/025", 816, 1207.344]]);
  assert.equal(context.textAlign, "right");
  assert.equal(context.letterSpacing, "2.1px");
});

test("a face without a recorded edition does not invent an example copy", () => {
  const text: string[] = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {}, fillText(value: string) { text.push(value); } }) };
  drawApprovedCardFace(canvas, {}, undefined);
  assert.deepEqual(text, []);
});
