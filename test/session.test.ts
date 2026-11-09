import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceToTurningPoint, archiveLife, createSampleLife, exportLife, persistLife,
  readArchivedLives, readSavedLife, sampleEngine, SAVE_KEY, ARCHIVE_KEY,
  hasLifeBegun, persistBirthPresentation,
  builtinEngine, selectWorldPack, loadAnyLife,
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

test("the controller begins at birth without simulating childhood in advance", () => {
  const life = createSampleLife("a-newborn-life");
  assert.equal(life.age, 0);
  assert.equal(life.year, -66);
  assert.equal(life.commands.length, 0);
  assert.deepEqual(life, sampleEngine.start("a-newborn-life"));
  assert.equal(life.journal[0].type, "birth");
});

test("local persistence restores a pending choice with the same continuation", () => {
  const storage = memoryStorage();
  assert.equal(readSavedLife(storage), null);
  const original = createSampleLife("local-roundtrip");
  persistLife(storage, original);
  const restored = readSavedLife(storage);
  assert.deepEqual(restored, original);
  const next = (life: typeof original) => life.phase === "choice"
    ? sampleEngine.choose(life, sampleEngine.getChoices(life)[0].id)
    : sampleEngine.advance(life);
  assert.deepEqual(next(restored!), next(original));
  assert.equal(storage.getItem(SAVE_KEY), exportLife(original));
});

test("revised full-life saves preserve earlier scene and full-life records", () => {
  const storage = memoryStorage();
  const legacyKey = "historical-lives:alexandria-sample:v1";
  storage.setItem(legacyKey, "earlier preview data");
  const previousKeys = ["historical-lives:alexandria-sample:v2", "historical-lives:alexandria-lives:v2", "historical-lives:alexandria-presentation:v2"];
  for (const key of previousKeys) storage.setItem(key, `previous:${key}`);
  assert.equal(readSavedLife(storage), null);
  persistLife(storage, createSampleLife("new-save-format"));
  assert.notEqual(SAVE_KEY, legacyKey);
  assert.equal(storage.getItem(legacyKey), "earlier preview data");
  assert.notEqual(storage.getItem(SAVE_KEY), null);
  for (const key of previousKeys) assert.equal(storage.getItem(key), `previous:${key}`);
});

function completedLife(seed: string, openingChoice = 0) {
  let life = createSampleLife(seed);
  for (let commands = 0; commands < 1500; commands++) {
    if (life.phase === "ended") return life;
    life = life.phase === "choice"
      ? sampleEngine.choose(life, sampleEngine.getChoices(life)[life.age === 0 ? openingChoice : 0].id)
      : sampleEngine.advance(life);
  }
  assert.fail("A full life did not terminate within the controller safety bound.");
}

test("next turning point stops for a decision or death without selecting a choice", () => {
  const original = createSampleLife("next-turning-point");
  const startingChoices = original.commands.filter(command => command.type === "choose").length;
  const result = advanceToTurningPoint(original);
  assert.ok(result.phase === "choice" || result.phase === "ended");
  assert.equal(result.commands.filter(command => command.type === "choose").length, startingChoices);
  assert.equal(original.age, 0);
  assert.equal(original.commands.length, 0);
  assert.deepEqual(result, sampleEngine.replay(result.seed, result.commands));
});

test("beginning a life is remembered even before the newborn decision is resolved", () => {
  const storage = memoryStorage();
  const newborn = createSampleLife("birth-presentation");
  assert.equal(newborn.commands.length, 0);
  assert.equal(hasLifeBegun(storage, newborn), false);
  persistLife(storage, newborn);
  persistBirthPresentation(storage, newborn, true);
  assert.equal(hasLifeBegun(storage, readSavedLife(storage)!), true);
  assert.equal(hasLifeBegun(storage, createSampleLife("another-birth")), false);
  assert.equal(hasLifeBegun(storage, { ...newborn, worldFingerprint: "changed-content" }), false);
  persistBirthPresentation(storage, newborn, false);
  assert.equal(hasLifeBegun(storage, newborn), false);
});

test("completed lives enter the local archive once and retain an exact replayable save", () => {
  const storage = memoryStorage();
  const life = completedLife("archive-life");
  const first = archiveLife(storage, life);
  assert.equal(first.length, 1);
  assert.equal(first[0].age, life.age);
  assert.equal(first[0].birthYear, -66);
  assert.equal(first[0].year, life.year);
  assert.deepEqual(sampleEngine.load(first[0].save), life);
  assert.equal(archiveLife(storage, life).length, 1);
  assert.deepEqual(readArchivedLives(storage), first);
  assert.throws(() => archiveLife(storage, createSampleLife("not-completed")), /Only completed/);
});

test("the past-lives archive retains the ten most recent distinct lives", () => {
  const storage = memoryStorage();
  for (let i = 0; i < 12; i++) archiveLife(storage, completedLife(`archive-limit-${i}`));
  const entries = readArchivedLives(storage);
  assert.equal(entries.length, 10);
  assert.ok(entries[0].id.startsWith("archive-limit-11:"));
  assert.ok(entries[9].id.startsWith("archive-limit-2:"));
});

test("equal-length branches of the same seeded life are archived as separate stories", () => {
  const storage = memoryStorage();
  const first = completedLife("archive-fork-0", 0);
  const other = completedLife("archive-fork-0", 1);
  assert.equal(first.commands.length, other.commands.length);
  assert.notEqual(exportLife(first), exportLife(other));
  archiveLife(storage, first);
  const entries = archiveLife(storage, other);
  assert.equal(entries.length, 2);
  assert.notEqual(entries[0].id, entries[1].id);
  assert.deepEqual(sampleEngine.load(entries[0].save), other);
  assert.deepEqual(sampleEngine.load(entries[1].save), first);
});

test("a corrupt archive is reported without replacing the stored record", () => {
  const storage = memoryStorage();
  storage.setItem(ARCHIVE_KEY, "broken archive");
  assert.throws(() => readArchivedLives(storage), /stored data has been left unchanged/);
  assert.throws(() => archiveLife(storage, completedLife("preserve-broken-archive")), /stored data has been left unchanged/);
  assert.equal(storage.getItem(ARCHIVE_KEY), "broken archive");
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

test("published revisions use separate saves while earlier lives and archives remain replayable", () => {
  const storage = memoryStorage();
  const originalKey = SAVE_KEY;
  const original = createSampleLife("pinned-original");
  persistLife(storage, original);
  const saved = exportLife(original);
  const changed = structuredClone(builtinEngine.world);
  changed.version = "admin-test-revision";
  changed.title = "A newly published title";
  try {
    selectWorldPack(changed);
    const revisedKey = SAVE_KEY;
    assert.notEqual(revisedKey, originalKey);
    assert.equal(readSavedLife(storage), null);
    const revised = createSampleLife("pinned-revised");
    persistLife(storage, revised);
    assert.deepEqual(loadAnyLife(saved), original);
    assert.equal(storage.getItem(originalKey), saved);
    assert.notEqual(storage.getItem(revisedKey), null);
    // An older snapshot arriving after a world switch still saves to its own slot.
    persistLife(storage, original);
    assert.deepEqual(readSavedLife(storage), revised);
    selectWorldPack(builtinEngine.world);
    assert.deepEqual(readSavedLife(storage), original);
  } finally { selectWorldPack(builtinEngine.world); }
});
