import assert from "node:assert/strict";
import test from "node:test";
import {
  createSampleLife, exportLife, persistLife, readSavedLife, sampleEngine, SAVE_KEY,
} from "../client/session.ts";
import type { StorageLike } from "../client/session.ts";

function memoryStorage(): StorageLike {
  const items = new Map<string, string>();
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value); },
    removeItem: key => { items.delete(key); },
  };
}

test("the sample controller starts at its first adult decision in 48 BCE", () => {
  const life = createSampleLife();
  assert.equal(life.age, 18);
  assert.equal(life.year, -48);
  assert.equal(life.phase, "choice");
  assert.equal(sampleEngine.getChoices(life).length, 3);
  assert.equal(life.commands.length, 18);
});

test("local persistence restores a pending choice with the same continuation", () => {
  const storage = memoryStorage();
  assert.equal(readSavedLife(storage), null);
  const original = createSampleLife("local-roundtrip");
  persistLife(storage, original);
  const restored = readSavedLife(storage);
  assert.deepEqual(restored, original);
  assert.deepEqual(
    sampleEngine.choose(restored!, sampleEngine.getChoices(restored!)[0].id),
    sampleEngine.choose(original, sampleEngine.getChoices(original)[0].id),
  );
  assert.equal(storage.getItem(SAVE_KEY), exportLife(original));
});

test("corrupt and incompatible local saves fail with a readable import error", () => {
  const storage = memoryStorage();
  storage.setItem(SAVE_KEY, "not a save");
  assert.throws(() => readSavedLife(storage), /previous save could not be opened/);
  const save = JSON.parse(exportLife(createSampleLife()));
  save.worldFingerprint = "changed-content";
  storage.setItem(SAVE_KEY, JSON.stringify(save));
  assert.throws(() => readSavedLife(storage), /previous save could not be opened/);
});

test("unavailable and full browser storage do not report successful persistence", () => {
  const storage: StorageLike = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("quota"); },
    removeItem() { throw new Error("blocked"); },
  };
  assert.throws(() => readSavedLife(storage), /Local saves are unavailable/);
  assert.throws(() => persistLife(storage, createSampleLife()), /could not save the life/);
});
