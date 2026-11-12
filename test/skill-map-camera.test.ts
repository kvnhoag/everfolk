import assert from "node:assert/strict";
import test from "node:test";
import { fitMapCamera, zoomMapCamera, constrainMapCamera, MAP_MIN_ZOOM, MAP_MAX_ZOOM } from "../client/models/skill-map-camera.ts";

const canvas = { width: 1480, height: 1340 };
test("zoom keeps the same skill-space point beneath an off-center pointer", () => {
  const before = { x: -270, y: -113, scale: .8 }, anchor = { x: 137, y: 252 };
  for (const scale of [.2, .5, 1, 2.4]) {
    const after = zoomMapCamera(before, scale, anchor);
    assert.ok(Math.abs((anchor.x - before.x) / before.scale - (anchor.x - after.x) / after.scale) < 1e-9);
    assert.ok(Math.abs((anchor.y - before.y) / before.scale - (anchor.y - after.y) / after.scale) < 1e-9);
  }
});

test("fit centers the complete graph within desktop and phone viewports", () => {
  for (const viewport of [{ width: 900, height: 600 }, { width: 320, height: 410 }]) {
    const camera = fitMapCamera(viewport, canvas);
    assert.ok(camera.x >= 12 && camera.y >= 12);
    assert.ok(camera.x + canvas.width * camera.scale <= viewport.width - 12);
    assert.ok(camera.y + canvas.height * camera.scale <= viewport.height - 12);
    assert.equal(camera.x * 2 + canvas.width * camera.scale, viewport.width);
  }
});

test("zoom limits and drag bounds keep the atlas recoverable in every direction", () => {
  const viewport = { width: 850, height: 600 };
  assert.equal(zoomMapCamera({ x: 0, y: 0, scale: 1 }, 100, { x: 1, y: 1 }).scale, MAP_MAX_ZOOM);
  assert.equal(zoomMapCamera({ x: 0, y: 0, scale: 1 }, 0, { x: 1, y: 1 }).scale, MAP_MIN_ZOOM);
  for (const scale of [MAP_MIN_ZOOM, .6, MAP_MAX_ZOOM]) for (const direction of [-1, 1]) {
    const result = constrainMapCamera({ x: direction * 100000, y: direction * 100000, scale }, viewport, canvas);
    assert.ok(result.x < viewport.width && result.x + canvas.width * scale > 0);
    assert.ok(result.y < viewport.height && result.y + canvas.height * scale > 0);
  }
});

test("the skill tree opens on the player's deepest learned skill at a readable zoom", async () => {
  const { READABLE_START_ZOOM, skillMapStartNode } = await import("../client/models/skill-map-camera.ts");
  assert.ok(READABLE_START_ZOOM >= .8);
  const depth = new Map([["F1", 1], ["F2", 2], ["C1", 1], ["C3", 3]]);
  assert.equal(skillMapStartNode([{ id: "F1", state: "learned" }, { id: "F2", state: "learned" }, { id: "C3", state: "available" }], depth, "F1"), "F2");
  assert.equal(skillMapStartNode([{ id: "F1", state: "available" }, { id: "C1", state: "locked" }], depth, "F1"), "F1");
  assert.equal(skillMapStartNode([], depth, "F1"), "F1");
});
