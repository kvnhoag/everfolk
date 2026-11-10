import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceToTurningPoint, archiveLife, createSampleLife, exportLife, persistLife,
  readArchivedLives, readSavedLife, sampleEngine, SAVE_KEY, ARCHIVE_KEY, PRESENTATION_KEY,
  hasLifeBegun, persistBirthPresentation, hasBirthStatsBeenRevealed, persistBirthStatsReveal,
  builtinEngine, legacyEngine, selectWorldPack, loadAnyLife,
} from "../client/session.ts";
import type { StorageLike } from "../client/session.ts";
import { createEngine } from "../src/index.ts";
import namedCausesPack from "../worlds/alexandria-0.5.1.json" with { type: "json" };
import originRangesPack from "../worlds/alexandria-0.6.0.json" with { type: "json" };
import longerLivesPack from "../worlds/alexandria-0.6.1.json" with { type: "json" };
import pooledPeoplePack from "../worlds/alexandria-0.7.0.json" with { type: "json" };
import skillTreePack from "../worlds/alexandria-0.8.0.json" with { type: "json" };
import economyPack from "../worlds/alexandria-0.9.0.json" with { type: "json" };
import variedPack from "../worlds/alexandria-0.10.0.json" with { type: "json" };
import coherentPack from "../worlds/alexandria-0.12.0.json" with { type: "json" };
import workTimelinePack from "../worlds/alexandria-0.13.0.json" with { type: "json" };
import interestCareersPack from "../worlds/alexandria-0.14.0.json" with { type: "json" };
import narrativePack from "../worlds/alexandria-0.31.0.json" with { type: "json" };
import { getArchivedBuiltinWorld, getBuiltinCatalog, isLegacyFactoryDraft } from "../server/content.ts";

function memoryStorage(): StorageLike {
  const items = new Map<string, string>();
  return {
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => { items.set(key, value); },
    removeItem: key => { items.delete(key); },
  };
}

test("the 66 BCE 0.31 world remains available for exact saved identities, continuation and customized drafts", () => {
  const engine = createEngine(narrativePack);
  assert.equal(engine.fingerprint, "fnv1a64-083e29e83c70fe61");
  const born = engine.start("retained-before-classical-era"), saved = engine.save(born);
  const restored = loadAnyLife(saved);
  assert.deepEqual(restored, born);
  assert.equal(restored.year, -66);
  const continued = engine.advance(restored);
  assert.deepEqual(engine.replay(continued.seed, continued.commands), continued);
  assert.deepEqual(loadAnyLife(engine.save(continued)), continued);
  assert.equal(continued.character!.name, born.character!.name);
  assert.equal(engine.save(born), saved);
  assert.deepEqual(getArchivedBuiltinWorld(`pack-${engine.fingerprint}`)!.pack, narrativePack);
  const catalog = getBuiltinCatalog(narrativePack);
  assert.equal(isLegacyFactoryDraft(catalog.worlds), true);
  catalog.worlds[0].pack.title = "An editor's own 66 BCE world";
  assert.equal(isLegacyFactoryDraft(catalog.worlds), false);
});

test("0.14 saves preserve their original age-band mortality after causal health is introduced", () => {
  const original = createEngine(interestCareersPack);
  const life = original.start("situation-death-110");
  assert.equal(life.health, undefined);
  assert.ok(life.stats.health >= 60);
  const restored = loadAnyLife(original.save(life));
  assert.deepEqual(restored, life);
  const continued = original.advance(restored);
  assert.equal(continued.phase, "ended");
  assert.equal(continued.age, 0);
  assert.equal(continued.health, undefined);
  assert.ok(continued.deathCauseId);
  assert.deepEqual(continued, original.replay(life.seed, continued.commands));
  assert.deepEqual(loadAnyLife(original.save(continued)), continued);
});

test("0.12.0 lives retain their later work timeline and exact continuation after the historical-age update", () => {
  const original = createEngine(coherentPack);
  let life = original.start("old-work-timeline");
  while (life.age < 16 && life.phase !== "ended") {
    life = life.phase === "choice" ? original.choose(life, original.getChoices(life)[0].id) : original.advance(life);
  }
  assert.equal(life.age, 16);
  assert.notEqual(life.phase, "ended");
  if (life.phase === "choice") life = original.choose(life, original.getChoices(life)[0].id);
  const restored = loadAnyLife(original.save(life));
  assert.deepEqual(restored, life);
  assert.equal(original.world.character!.jobs.find(job => job.id === "copyist")!.minAge, 18);
  assert.deepEqual(original.world.events.find(event => event.id === "a-place-on-the-manifest")!.trigger, { type: "age", at: 18 });
  const continued = advanceToTurningPoint(restored);
  assert.ok(continued.commands.length > restored.commands.length, "Continuation must exercise the retained engine beyond the imported save.");
  assert.ok(continued.age >= 18, "The retained job-offer event keeps its original later age.");
  assert.deepEqual(continued, original.replay(life.seed, continued.commands));
  assert.notEqual(restored.worldFingerprint, builtinEngine.fingerprint);
});

test("0.13.0 apprenticeship saves keep their original commissions and continue through exact replay", () => {
  const original = createEngine(workTimelinePack);
  let life = original.start("legacy-interest-career");
  while (life.age < 12 && life.phase !== "ended") {
    life = life.phase === "choice" ? original.choose(life, original.getChoices(life)[0].id) : original.advance(life);
  }
  while (life.phase === "choice") life = original.choose(life, original.getChoices(life)[0].id);
  assert.equal(life.age, 12);
  assert.equal(life.phase, "ready");
  life = original.act(life, "work-apprentice");
  const restored = loadAnyLife(original.save(life));
  assert.deepEqual(restored, life);
  assert.equal(restored.character!.jobId, "apprentice");
  assert.equal(original.world.character!.activities.length, 81);
  assert.deepEqual(original.world.character!.activities.find(activity => activity.id === "carve-door-fitting")!.when, {
    type: "all", conditions: [{ type: "job", job: "wood-carver" }, { type: "skill", skill: "carving", op: "gte", value: 35 }],
  });
  const continued = advanceToTurningPoint(restored);
  assert.ok(continued.commands.length > restored.commands.length);
  assert.ok(continued.character!.skills.craft > restored.character!.skills.craft);
  assert.deepEqual(continued, original.replay(life.seed, continued.commands));
  assert.notEqual(restored.worldFingerprint, builtinEngine.fingerprint);
});

test("the controller begins at birth without simulating childhood in advance", () => {
  const life = createSampleLife("a-newborn-life");
  assert.equal(life.age, 0);
  assert.equal(life.year, sampleEngine.world.startYear);
  assert.equal(life.commands.length, 0);
  assert.deepEqual(life, sampleEngine.start("a-newborn-life"));
  assert.equal(life.journal[0].type, "birth");
});

test("the original v3 life survives the Everfolk rebrand with its original rules and untouched save", () => {
  const storage = memoryStorage();
  const legacy = legacyEngine.start("legacy-character-release");
  const save = legacyEngine.save(legacy);
  storage.setItem("historical-lives:alexandria-sample:v3", save);
  try {
    selectWorldPack(legacyEngine.world);
    assert.equal(SAVE_KEY, "everfolk:alexandria-sample:v3");
    assert.deepEqual(readSavedLife(storage), legacy);
    selectWorldPack(builtinEngine.world);
    assert.deepEqual(loadAnyLife(save), legacy);
    assert.deepEqual(advanceToTurningPoint(legacy), legacyEngine.replay(legacy.seed, advanceToTurningPoint(legacy).commands));
    persistLife(storage, createSampleLife("new-character-release"));
    assert.equal(storage.getItem("historical-lives:alexandria-sample:v3"), save);
  } finally { selectWorldPack(builtinEngine.world); }
});

test("0.5.1 fixed-stat saves remain readable after randomized origin stats are introduced", () => {
  const original = createEngine(namedCausesPack);
  const oldLife = original.choose(original.start("fixed-origin-save"), "family-care");
  const restored = loadAnyLife(original.save(oldLife));
  assert.deepEqual(restored, oldLife);
  assert.deepEqual(advanceToTurningPoint(restored), original.replay(oldLife.seed, advanceToTurningPoint(oldLife).commands));
  assert.notEqual(oldLife.worldFingerprint, builtinEngine.fingerprint);
});

test("0.6.0 lives retain their rolled stats and original mortality after the longer-life update", () => {
  const original = createEngine(originRangesPack);
  const oldLife = original.choose(original.start("original-mortality-save"), "family-care");
  const restored = loadAnyLife(original.save(oldLife));
  assert.deepEqual(restored, oldLife);
  const continued = advanceToTurningPoint(restored);
  assert.deepEqual(continued, original.replay(oldLife.seed, continued.commands));
  assert.notEqual(oldLife.worldFingerprint, builtinEngine.fingerprint);
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

test("0.6.1 saves keep their original identity and relationship rules after pooled names", () => {
  const original = createEngine(longerLivesPack);
  const life = original.choose(original.start("before-pooled-names"), "family-care");
  const restored = loadAnyLife(original.save(life));
  assert.deepEqual(restored, life);
  assert.equal(restored.character?.name, undefined);
  assert.equal(restored.character?.knownPartnerIds, undefined);
  const continued = advanceToTurningPoint(restored);
  assert.deepEqual(continued, original.replay(life.seed, continued.commands));
});

test("0.7.0 lives retain pooled people and their original training rules after the skill tree", () => {
  const original = createEngine(pooledPeoplePack);
  let life = original.start("before-skill-paths");
  while (life.age < 10 || life.phase === "choice") {
    life = life.phase === "choice" ? original.choose(life, original.getChoices(life)[0].id) : original.advance(life);
    assert.notEqual(life.phase, "ended");
  }
  assert.equal(original.world.character!.skills.pottery.prerequisites, undefined);
  assert.equal(original.getActivities(life).find(activity => activity.id === "train-pottery")!.available, true);
  const restored = loadAnyLife(original.save(life));
  assert.deepEqual(restored, life);
  assert.equal(restored.character!.name, life.character!.name);
  assert.deepEqual(restored.character!.knownPartnerIds, []);
  const trained = original.act(restored, "train-pottery");
  assert.equal(trained.character!.skills.pottery, life.character!.skills.pottery + 8);
  assert.deepEqual(loadAnyLife(original.save(trained)), trained);
  assert.deepEqual(advanceToTurningPoint(trained), original.replay(life.seed, advanceToTurningPoint(trained).commands));
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

test("0.8.0 skill-tree lives retain abstract Resources and exact replay after the economy release", () => {
  const original = createEngine(skillTreePack);
  const life = original.choose(original.start("before-money-ledger"), "family-care");
  assert.equal(original.world.economy, undefined);
  assert.equal(life.economy, undefined);
  assert.deepEqual(original.world.character!.skills.pottery.prerequisites, { craft: 15 });
  const restored = loadAnyLife(original.save(life));
  assert.deepEqual(restored, life);
  assert.equal(restored.economy, undefined);
  const continued = advanceToTurningPoint(restored);
  assert.deepEqual(continued, original.replay(life.seed, continued.commands));
});

test("0.9.0 lives retain their original identity, household and money after varied backgrounds", () => {
  const original = createEngine(economyPack);
  const life = original.choose(original.start("before-varied-backgrounds"), "family-care");
  assert.equal(original.world.origins.length, 3);
  assert.equal(original.world.character!.playerNames!.length, 16);
  const saved = original.save(life);
  const restored = loadAnyLife(saved);
  assert.deepEqual(restored, life);
  assert.deepEqual(restored.economy, life.economy);
  const continued = advanceToTurningPoint(restored);
  assert.deepEqual(continued, original.replay(life.seed, continued.commands));
  assert.equal(original.save(restored), saved);
});

test("0.10.0 saves preserve their original birth decision after birth becomes automatic", () => {
  const original = createEngine(variedPack);
  const born = original.start("before-automatic-birth");
  assert.equal(born.pendingEventId, "the-first-household");
  assert.equal(born.phase, "choice");
  const saved = original.save(born);
  const restored = loadAnyLife(saved);
  assert.deepEqual(restored, born);
  const chosen = original.choose(restored, "family-care");
  assert.equal(chosen.commands[0].type, "choose");
  assert.deepEqual(loadAnyLife(original.save(chosen)), chosen);
  assert.deepEqual(advanceToTurningPoint(chosen), original.replay(chosen.seed, advanceToTurningPoint(chosen).commands));
  assert.equal(original.save(restored), saved);
});

function completedLife(seed: string, openingChoice = 0) {
  let life = createSampleLife(seed);
  let chose = false;
  for (let commands = 0; commands < 1500; commands++) {
    if (life.phase === "ended") return life;
    if (life.phase === "choice") {
      life = sampleEngine.choose(life, sampleEngine.getChoices(life)[chose ? 0 : openingChoice].id);
      chose = true;
    } else life = sampleEngine.advance(life);
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

test("a completed stat reveal persists independently without beginning or changing the life", () => {
  const storage = memoryStorage();
  const life = createSampleLife("stats-reveal-presentation");
  const original = exportLife(life);
  persistLife(storage, life);
  assert.equal(hasBirthStatsBeenRevealed(storage, life), false);
  persistBirthStatsReveal(storage, life, true);
  const restored = readSavedLife(storage)!;
  assert.equal(hasBirthStatsBeenRevealed(storage, restored), true);
  assert.equal(hasLifeBegun(storage, restored), false);
  assert.equal(storage.getItem(SAVE_KEY), original);
  assert.equal(exportLife(life), original);
  assert.equal(restored.rngState, life.rngState);
  assert.equal(restored.commands.length, 0);
  persistBirthStatsReveal(storage, life, false);
  assert.equal(hasBirthStatsBeenRevealed(storage, restored), false);
});

test("stat reveal completion belongs to the exact seed and world revision", () => {
  const storage = memoryStorage();
  const original = createSampleLife("revealed-same-seed");
  persistBirthStatsReveal(storage, original, true);
  assert.equal(hasBirthStatsBeenRevealed(storage, createSampleLife("another-stats-seed")), false);
  const changed = structuredClone(builtinEngine.world);
  changed.version = "stat-reveal-other-revision";
  try {
    selectWorldPack(changed);
    const revised = createSampleLife(original.seed);
    assert.equal(hasBirthStatsBeenRevealed(storage, revised), false);
    persistBirthStatsReveal(storage, revised, false);
    assert.equal(hasBirthStatsBeenRevealed(storage, original), true);
    persistBirthStatsReveal(storage, revised, true);
    assert.equal(hasBirthStatsBeenRevealed(storage, revised), true);
  } finally { selectWorldPack(builtinEngine.world); }
});

test("blank, stale and malformed stat reveal markers do not skip a pending birth", () => {
  const storage = memoryStorage();
  const life = createSampleLife("unrevealed-marker");
  for (const value of ["", "true", life.seed, `${life.worldFingerprint}:another-seed`, `another-revision:${life.seed}`]) {
    storage.setItem(`${PRESENTATION_KEY}:stats-revealed`, value);
    assert.equal(hasBirthStatsBeenRevealed(storage, life), false);
  }
});

test("already begun, progressed and ended lives skip the new stat reveal", () => {
  const storage = memoryStorage();
  const newborn = createSampleLife("already-begun-stat-reveal");
  persistBirthPresentation(storage, newborn, true);
  assert.equal(hasBirthStatsBeenRevealed(storage, newborn), true);
  const progressed = sampleEngine.advance(createSampleLife("progressed-stat-reveal"));
  const ended = completedLife("ended-stat-reveal");
  const unreadable: StorageLike = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() {} };
  assert.equal(hasBirthStatsBeenRevealed(unreadable, progressed), true);
  assert.equal(hasBirthStatsBeenRevealed(unreadable, ended), true);
});

test("blocked stat reveal storage leaves the pending life unchanged and the reveal available", () => {
  const life = createSampleLife("stat-reveal-storage-blocked");
  const original = exportLife(life);
  const storage: StorageLike = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() {} };
  assert.equal(hasBirthStatsBeenRevealed(storage, life), false);
  assert.throws(() => persistBirthStatsReveal(storage, life, true), /quota/);
  assert.equal(exportLife(life), original);
});

test("stat reveal persistence writes only its presentation key", () => {
  const life = createSampleLife("stat-reveal-keys");
  const writes: Array<[string, string]> = [];
  const storage: StorageLike = { getItem() { return null; }, setItem(key, value) { writes.push([key, value]); }, removeItem() {} };
  persistBirthStatsReveal(storage, life, true);
  assert.deepEqual(writes, [[`${PRESENTATION_KEY}:stats-revealed`, `${life.worldFingerprint}:${life.seed}`]]);
});

test("completed lives enter the local archive once and retain an exact replayable save", () => {
  const storage = memoryStorage();
  const life = completedLife("archive-life");
  const first = archiveLife(storage, life);
  assert.equal(first.length, 1);
  assert.equal(first[0].age, life.age);
  assert.equal(first[0].birthYear, sampleEngine.world.startYear);
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
