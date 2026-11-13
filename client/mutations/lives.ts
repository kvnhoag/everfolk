import { birthYearOf } from "../../src/calendar.ts";
import type { LifeState } from "../../src/types.ts";
import { contentFingerprint } from "../../src/random.ts";
import type { ArchivedLife, StorageLike } from "../types/session.ts";
import { ARCHIVE_KEY, ARCHIVE_LIMIT, WEALTH_OBSERVATIONS_KEY, engineForLife, exportLife, presentationKeyFor, sampleEngine, saveKeyFor } from "../lib/world-session.ts";
import { getAssetValue } from "../../src/economy.ts";
import {
  exportWealthObservationsSnapshot,
  getRecordedWealthObservations,
  hydrateWealthObservations,
  recordedLifeIdentity,
  recordWealthObservation,
} from "../models/society-wealth-data.ts";
import { readArchivedLives, readWealthObservations } from "../queries/lives.ts";

export function newLifeSeed(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? `alexandria-${crypto.randomUUID()}`
    : `alexandria-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Begin at birth. A presentation gate holds progression until the player starts. */
export function createSampleLife(seed = newLifeSeed()): LifeState {
  return sampleEngine.start(seed);
}

/** A deliberate new-life request looks for a fresh name and household.
 * Only seed selection changes: the chosen seed still reproduces the exact life.
 * A finite best-match fallback supports worlds with just one name or origin. */
export function createDifferentSampleLife(previous: LifeState, seedFactory: () => string = newLifeSeed): LifeState {
  let best: LifeState | undefined;
  let bestScore = -1;
  for (let attempt = 0; attempt < 16; attempt++) {
    const candidate = createSampleLife(seedFactory());
    const score = Number(candidate.character?.name !== previous.character?.name) + Number(candidate.originId !== previous.originId);
    if (score > bestScore) { best = candidate; bestScore = score; }
    if (score === 2) return candidate;
  }
  return best!;
}

/** Skip quiet years without making any decisions on the player's behalf. */
export function advanceToTurningPoint(life: LifeState): LifeState {
  const engine = engineForLife(life);
  let next = life;
  for (let years = 0; years <= engine.world.maxAge; years++) {
    if (next.phase !== "ready") return next;
    next = engine.advance(next);
  }
  throw new Error("This life could not reach its next turning point.");
}

export function persistLife(storage: StorageLike, life: LifeState): void {
  const saved = exportLife(life);
  try {
    storage.setItem(saveKeyFor(engineForLife(life)), saved);
  } catch {
    throw new Error("This browser could not save the life. You can keep playing.");
  }
}

export function persistBirthPresentation(storage: StorageLike, life: LifeState, hasBegun: boolean): void {
  storage.setItem(presentationKeyFor(engineForLife(life)), hasBegun ? `${life.worldFingerprint}:${life.seed}` : "");
}

export function persistBirthStatsReveal(storage: StorageLike, life: LifeState, revealed: boolean): void {
  const key = `${presentationKeyFor(engineForLife(life))}:stats-revealed`;
  storage.setItem(key, revealed ? `${life.worldFingerprint}:${life.seed}` : "");
}

export function archiveLife(storage: StorageLike, life: LifeState): ArchivedLife[] {
  if (life.phase !== "ended") throw new Error("Only completed lives can enter the archive.");
  const world = engineForLife(life).world;
  const ending = world.endings.find(item => item.id === life.endingId);
  const cause = world.character?.deathCauses.find(item => item.id === life.deathCauseId);
  const saved = exportLife(life);
  const item: ArchivedLife = {
    // Equal-length branches from the same seed are still different completed lives.
    id: `${life.seed}:${contentFingerprint(saved)}`,
    age: life.age,
    year: life.year,
    birthYear: birthYearOf(world, life),
    endingTitle: cause?.title ?? ending?.title ?? "Life ended",
    save: saved,
  };
  const entries = [item, ...readArchivedLives(storage).filter(previous => previous.id !== item.id)].slice(0, ARCHIVE_LIMIT);
  try { storage.setItem(ARCHIVE_KEY, JSON.stringify(entries)); }
  catch { throw new Error("This life could not be added to the local archive. You can still download it."); }
  try {
    syncLifeWealthObservation(storage, life);
  } catch { /* Observation recording is advisory and does not fail archive. */ }
  return entries;
}

function persistWealthObservations(storage: StorageLike): void {
  try { storage.setItem(WEALTH_OBSERVATIONS_KEY, JSON.stringify(exportWealthObservationsSnapshot())); }
  catch { /* Observation persistence is advisory and does not fail gameplay or archive. */ }
}

/** Hydrate persisted recorded-life wealth observations into memory for the current session. */
export function restoreWealthObservations(storage: StorageLike): void {
  try { hydrateWealthObservations(readWealthObservations(storage)); }
  catch { /* Observation hydration is advisory. */ }
}

/** Record or refresh the current life's wealth observation in memory and storage without duplicating by life identity. */
export function syncLifeWealthObservation(storage: StorageLike, life: LifeState): void {
  const world = engineForLife(life).world;
  if (!world.economy || !life.economy) return;
  if (getRecordedWealthObservations(world.id, world.version).length === 0) {
    hydrateWealthObservations(readWealthObservations(storage), { merge: true });
  }
  recordWealthObservation(
    world.id,
    world.version,
    life.economy.cash + getAssetValue(world, life),
    recordedLifeIdentity(life),
  );
  persistWealthObservations(storage);
}
