import assert from "node:assert/strict";
import test from "node:test";
import { readWeaveMode, writeWeaveMode, WEAVE_MODE_STORAGE_KEY } from "../client/storage/weave-mode.ts";

test("menu and new-life mounts retain the selected mode until the toggle changes it", () => {
  const saved = new Map<string, string>();
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
  assert.equal(readWeaveMode(storage), true);
  writeWeaveMode(true, storage);
  assert.equal(readWeaveMode(storage), true);
  assert.equal(saved.get(WEAVE_MODE_STORAGE_KEY), "on");
  writeWeaveMode(false, storage);
  assert.equal(readWeaveMode(storage), false);
  assert.equal(readWeaveMode(storage), false, "reopening the menu after a new guest birth keeps Weave off");
  writeWeaveMode(true, storage);
  assert.equal(readWeaveMode(storage), true);
});

test("unavailable preference storage does not prevent the menu from opening or toggling", () => {
  const storage = { getItem(): never { throw new Error("Blocked storage"); }, setItem(): never { throw new Error("Blocked storage"); } };
  assert.equal(readWeaveMode(storage), true);
  assert.doesNotThrow(() => writeWeaveMode(false, storage));
});
