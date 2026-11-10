import assert from "node:assert/strict";
import test from "node:test";
import { readEverfolkStorage } from "../client/brand-storage.ts";
import { builtinEngine, createSampleLife, exportLife, hasBirthStatsBeenRevealed, hasLifeBegun, persistLife, readArchivedLives, readSavedLife, SAVE_KEY, PRESENTATION_KEY } from "../client/session.ts";
import { persistYearlyFocus, readYearlyFocus, yearlyFocusStorageKey } from "../client/yearly-focus.ts";
import { LEGACY_GALLERY_KEY, readLegacyEntries } from "../client/legacy-store.ts";

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
const previousKey = (key: string) => key.replace(/^everfolk:/, "historical-lives:");

test("Everfolk resumes a previous-brand life and birth presentation without altering the original save", () => {
  const disk = storage();
  const life = createSampleLife("rebrand-compatibility");
  const saved = exportLife(life);
  const presentation = `${life.worldFingerprint}:${life.seed}`;
  disk.setItem(previousKey(SAVE_KEY), saved);
  disk.setItem(previousKey(PRESENTATION_KEY), presentation);
  disk.setItem(`${previousKey(PRESENTATION_KEY)}:stats-revealed`, presentation);
  assert.deepEqual(readSavedLife(disk), life);
  assert.equal(hasLifeBegun(disk, life), true);
  assert.equal(hasBirthStatsBeenRevealed(disk, life), true);
  disk.setItem(previousKey(PRESENTATION_KEY), "");
  assert.equal(hasLifeBegun(disk, life), false);
  assert.equal(hasBirthStatsBeenRevealed(disk, life), true);
  persistLife(disk, life);
  assert.equal(disk.getItem(SAVE_KEY), saved);
  assert.equal(disk.getItem(previousKey(SAVE_KEY)), saved);
  assert.equal(life.worldFingerprint, builtinEngine.fingerprint);
  const nextLife = createSampleLife("everfolk-new-save");
  persistLife(disk, nextLife);
  assert.deepEqual(readSavedLife(disk), nextLife);
  assert.equal(disk.getItem(previousKey(SAVE_KEY)), saved);
});

test("Everfolk honours existing preferences and collections, with current values taking priority", () => {
  const disk = storage();
  const life = createSampleLife("rebrand-preferences");
  const focusKey = yearlyFocusStorageKey(life);
  disk.setItem(previousKey(focusKey), "study");
  assert.equal(readYearlyFocus(disk, life), "study");
  persistYearlyFocus(disk, life, "everyday");
  assert.equal(readYearlyFocus(disk, life), "everyday");
  disk.setItem("historical-lives:scene-motion:v1", "off");
  assert.equal(readEverfolkStorage(disk, "everfolk:scene-motion:v1"), "off");
  disk.setItem(previousKey(LEGACY_GALLERY_KEY), "[]");
  const archive = [{ id: "preserved-life", age: 30, year: -320, birthYear: -350, endingTitle: "A remembered life", save: exportLife(life) }];
  disk.setItem("historical-lives:alexandria-lives:v3", JSON.stringify(archive));
  assert.deepEqual(readLegacyEntries(disk), []);
  assert.deepEqual(readArchivedLives(disk), archive);
  disk.setItem(LEGACY_GALLERY_KEY, "broken data");
  assert.throws(() => readLegacyEntries(disk), /left unchanged/);
  assert.equal(disk.getItem(previousKey(LEGACY_GALLERY_KEY)), "[]");
});
