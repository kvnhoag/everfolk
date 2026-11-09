import { createEngine } from "../src/index.ts";
import type { LifeEngine, LifeState, WorldPack } from "../src/types.ts";
import { contentFingerprint } from "../src/random.ts";
import sampleWorld from "../worlds/alexandria-sample.json" with { type: "json" };

/** The sample scene owns its pack; the shared simulation stays setting-independent. */
export const builtinEngine = createEngine(sampleWorld);
export let sampleEngine = builtinEngine;
const engines = new Map<string, LifeEngine>([[builtinEngine.fingerprint, builtinEngine]]);
const PACK_CACHE_PREFIX = "historical-lives:world-pack:";
// Earlier content revisions remain untouched under their original v1/v2 keys.
export let SAVE_KEY = "historical-lives:alexandria-sample:v3";
export const ARCHIVE_KEY = "historical-lives:alexandria-lives:v3";
export let PRESENTATION_KEY = "historical-lives:alexandria-presentation:v3";
const ARCHIVE_LIMIT = 10;
const saveKeyFor = (engine: LifeEngine) => engine.fingerprint === builtinEngine.fingerprint ? "historical-lives:alexandria-sample:v3" : `historical-lives:active:${engine.world.id}:${engine.fingerprint}`;
const presentationKeyFor = (engine: LifeEngine) => engine.fingerprint === builtinEngine.fingerprint ? "historical-lives:alexandria-presentation:v3" : `${saveKeyFor(engine)}:presentation`;

/** Pin a life to its own immutable world revision; publishing never rewrites it. */
export function selectWorldPack(pack: WorldPack): void {
  const engine = createEngine(pack);
  engines.set(engine.fingerprint, engine);
  sampleEngine = engine;
  SAVE_KEY = saveKeyFor(engine);
  PRESENTATION_KEY = presentationKeyFor(engine);
  try { window.localStorage.setItem(`${PACK_CACHE_PREFIX}${engine.fingerprint}`, JSON.stringify(pack)); } catch { /* Session play remains available without storage. */ }
}

export function engineForLife(life: Pick<LifeState, "worldFingerprint">): LifeEngine {
  const known = engines.get(life.worldFingerprint);
  if (known) return known;
  try {
    const raw = window.localStorage.getItem(`${PACK_CACHE_PREFIX}${life.worldFingerprint}`);
    if (raw) {
      const engine = createEngine(JSON.parse(raw));
      if (engine.fingerprint === life.worldFingerprint) {
        engines.set(engine.fingerprint, engine);
        return engine;
      }
    }
  } catch { /* Report a missing revision below without altering the stored save. */ }
  throw new Error("This life's original world revision is not available on this device.");
}

export function loadAnyLife(json: string): LifeState {
  const identity = JSON.parse(json) as { worldFingerprint: string };
  return engineForLife(identity).load(json);
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ArchivedLife {
  id: string;
  age: number;
  year: number;
  birthYear: number;
  endingTitle: string;
  save: string;
}

export function newLifeSeed(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `alexandria-${crypto.randomUUID()}`
    : `alexandria-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Begin at birth. A presentation gate holds progression until the player starts. */
export function createSampleLife(seed = newLifeSeed()): LifeState {
  return sampleEngine.start(seed);
}

/** Skip quiet years without making any decisions on the player's behalf. */
export function advanceToTurningPoint(life: LifeState): LifeState {
  let next = life;
  for (let years = 0; years <= sampleEngine.world.maxAge; years++) {
    if (next.phase !== "ready") return next;
    next = sampleEngine.advance(next);
  }
  throw new Error("This life could not reach its next turning point.");
}

export function exportLife(life: LifeState): string {
  return engineForLife(life).save(life);
}

export function readSavedLife(storage: StorageLike): LifeState | null {
  let saved: string | null;
  try {
    saved = storage.getItem(SAVE_KEY);
  } catch {
    throw new Error("Local saves are unavailable in this browser.");
  }
  if (saved === null) return null;
  try {
    return sampleEngine.load(saved);
  } catch {
    throw new Error("The previous save could not be opened with this version of the sample.");
  }
}

export function persistLife(storage: StorageLike, life: LifeState): void {
  const saved = exportLife(life);
  try {
    storage.setItem(saveKeyFor(engineForLife(life)), saved);
  } catch {
    throw new Error("This browser could not save the life. You can keep playing.");
  }
}

/** Remember the birth reveal separately; it is presentation, not a simulation command. */
export function hasLifeBegun(storage: StorageLike, life: LifeState): boolean {
  if (life.commands.length > 0 || life.phase === "ended") return true;
  let engine: LifeEngine;
  try { engine = engineForLife(life); } catch { return false; }
  return storage.getItem(presentationKeyFor(engine)) === `${life.worldFingerprint}:${life.seed}`;
}

export function persistBirthPresentation(storage: StorageLike, life: LifeState, hasBegun: boolean): void {
  storage.setItem(presentationKeyFor(engineForLife(life)), hasBegun ? `${life.worldFingerprint}:${life.seed}` : "");
}

export function readArchivedLives(storage: StorageLike): ArchivedLife[] {
  let raw: string | null;
  try { raw = storage.getItem(ARCHIVE_KEY); }
  catch { throw new Error("The local past-lives archive is unavailable."); }
  if (raw === null) return [];
  try {
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length > ARCHIVE_LIMIT) throw new Error("Invalid archive.");
    return entries.map((entry: unknown) => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid archived life.");
      const value = entry as ArchivedLife;
      if (typeof value.id !== "string" || value.id.length > 400 || !Number.isSafeInteger(value.age) || value.age < 0 ||
        !Number.isSafeInteger(value.year) || value.year === 0 || !Number.isSafeInteger(value.birthYear) || value.birthYear === 0 ||
        typeof value.endingTitle !== "string" || value.endingTitle.length > 500 ||
        typeof value.save !== "string" || value.save.length > 8_000_000) throw new Error("Invalid archived life.");
      return { id: value.id, age: value.age, year: value.year, birthYear: value.birthYear, endingTitle: value.endingTitle, save: value.save };
    });
  } catch { throw new Error("The past-lives archive could not be opened. Its stored data has been left unchanged."); }
}

export function archiveLife(storage: StorageLike, life: LifeState): ArchivedLife[] {
  if (life.phase !== "ended") throw new Error("Only completed lives can enter the archive.");
  const world = engineForLife(life).world;
  const ending = world.endings.find(item => item.id === life.endingId);
  const saved = exportLife(life);
  const item: ArchivedLife = {
    // Equal-length branches from the same seed are still different completed lives.
    id: `${life.seed}:${contentFingerprint(saved)}`,
    age: life.age,
    year: life.year,
    birthYear: world.startYear,
    endingTitle: ending?.title ?? "A life remembered",
    save: saved,
  };
  const entries = [item, ...readArchivedLives(storage).filter(previous => previous.id !== item.id)].slice(0, ARCHIVE_LIMIT);
  try { storage.setItem(ARCHIVE_KEY, JSON.stringify(entries)); }
  catch { throw new Error("This life could not be added to the local archive. You can still download it."); }
  return entries;
}
