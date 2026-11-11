import assert from "node:assert/strict";
import test from "node:test";
import { inspectModule } from "../scripts/check-structure.mjs";

test("architecture keeps transport, mutations, and React out of read queries", () => {
  assert.deepEqual(inspectModule("client/queries/worlds.ts", 'import { requestJson } from "../lib/http.ts"; export const read = () => requestJson("/api/worlds");'), []);
  for (const source of [
    'import { useState } from "react";',
    'import { persistLife } from "../mutations/lives.ts";',
    'storage.setItem("save", "value");',
    'requestJson("/api/admin/catalog", { method: "PUT" });',
  ]) assert.ok(inspectModule("client/queries/lives.ts", source).length > 0, source);
  assert.ok(inspectModule("client/components/Picker.tsx", 'fetch("/api/worlds");').length > 0);
  assert.deepEqual(inspectModule("client/lib/http.ts", 'fetch("/api/worlds");'), []);
});

test("architecture preserves pure models and the independent simulation core", () => {
  assert.deepEqual(inspectModule("client/models/legacy.ts", 'import type { LegacyEntry } from "../storage/legacy-store.ts";'), []);
  assert.ok(inspectModule("client/models/legacy.ts", 'import { readLegacyEntries } from "../storage/legacy-store.ts";').length > 0);
  assert.ok(inspectModule("client/models/focus.ts", 'window.localStorage.getItem("focus");').length > 0);
  assert.ok(inspectModule("src/engine.ts", 'import { readSavedLife } from "../client/queries/lives.ts";').length > 0);
  // Browser words in authored prose are data, not browser access.
  assert.deepEqual(inspectModule("client/models/scene.ts", 'export const text = "Look through the window.";'), []);
});

test("architecture rejects misplaced files and write SQL in server queries", () => {
  assert.ok(inspectModule("client/useGame.ts", "export const value = 1;").length > 0);
  assert.ok(inspectModule("client/misc/unknown.ts", "export const value = 1;").length > 0);
  assert.ok(inspectModule("client/hooks/Game.tsx", "export default () => null;").length > 0);
  assert.ok(inspectModule("server/queries/content.ts", 'db.prepare("UPDATE content_catalog SET revision = 1");').length > 0);
  assert.deepEqual(inspectModule("server/queries/content.ts", 'db.prepare("SELECT revision FROM content_catalog").first();'), []);
});
