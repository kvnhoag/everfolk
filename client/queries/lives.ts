import type { LifeEngine, LifeState } from "../../src/types.ts";
import type { ArchivedLife, StorageLike } from "../types/session.ts";
import { ARCHIVE_KEY, ARCHIVE_LIMIT, SAVE_KEY, WEALTH_OBSERVATIONS_KEY, engineForLife, presentationKeyFor, sampleEngine } from "../lib/world-session.ts";
import { MAX_RECORDED_OBSERVATIONS_PER_REVISION, type WealthObservationsSnapshot } from "../models/society-wealth-data.ts";
import { readEverfolkStorage } from "../lib/brand-storage.ts";

export function readRawSavedLife(storage: StorageLike): string | null {
  try {
    return readEverfolkStorage(storage, SAVE_KEY);
  } catch {
    return null;
  }
}

export function readSavedLife(storage: StorageLike): LifeState | null {
  let saved: string | null;
  try {
    saved = readEverfolkStorage(storage, SAVE_KEY);
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

/** Remember the birth reveal separately; it is presentation, not a simulation command. */
export function hasLifeBegun(storage: StorageLike, life: LifeState): boolean {
  if (life.commands.some(command => command.type !== "avatar") || life.phase === "ended") return true;
  let engine: LifeEngine;
  try { engine = engineForLife(life); } catch { return false; }
  return readEverfolkStorage(storage, presentationKeyFor(engine)) === `${life.worldFingerprint}:${life.seed}`;
}

/** A stat reveal is presentation only; older lives that have begun need no replay. */
export function hasBirthStatsBeenRevealed(storage: StorageLike, life: LifeState): boolean {
  if (life.commands.some(command => command.type !== "avatar") || life.phase === "ended") return true;
  try {
    if (hasLifeBegun(storage, life)) return true;
    const key = `${presentationKeyFor(engineForLife(life))}:stats-revealed`;
    return readEverfolkStorage(storage, key) === `${life.worldFingerprint}:${life.seed}`;
  } catch {
    // A blocked storage read must not prevent revealing and playing in memory.
    return false;
  }
}

export function readArchivedLives(storage: StorageLike): ArchivedLife[] {
  let raw: string | null;
  try { raw = readEverfolkStorage(storage, ARCHIVE_KEY); }
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

/** Read persisted recorded-life wealth observations per world revision from storage (returns empty on missing/corrupt data). */
export function readWealthObservations(storage: StorageLike): WealthObservationsSnapshot {
  let raw: string | null;
  try { raw = readEverfolkStorage(storage, WEALTH_OBSERVATIONS_KEY); }
  catch { return {}; }
  if (raw === null || raw.length > 2_000_000) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const snapshot: WealthObservationsSnapshot = {};
    for (const [revisionKey, entries] of Object.entries(parsed).slice(0, 64)) {
      if (!revisionKey || revisionKey.length > 400 || !entries || typeof entries !== "object" || Array.isArray(entries)) continue;
      const valid: Record<string, number> = {};
      for (const [lifeId, netWorth] of Object.entries(entries).slice(-MAX_RECORDED_OBSERVATIONS_PER_REVISION)) {
        if (lifeId && lifeId.length <= 400 && typeof netWorth === "number" && Number.isFinite(netWorth)) {
          valid[lifeId] = Math.round(netWorth);
        }
      }
      if (Object.keys(valid).length > 0) snapshot[revisionKey] = valid;
    }
    return snapshot;
  } catch { return {}; }
}
