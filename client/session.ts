import { createEngine } from "../src/index.ts";
import type { LifeState } from "../src/types.ts";
import sampleWorld from "../worlds/alexandria-sample.json" with { type: "json" };

/** The sample scene owns its pack; the shared simulation stays setting-independent. */
export const sampleEngine = createEngine(sampleWorld);
export const SAVE_KEY = "historical-lives:alexandria-sample:v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Enter the visual study at its first consequential adult decision. */
export function createSampleLife(seed = "alexandria-scene-01"): LifeState {
  let life = sampleEngine.start(seed);
  while (life.age < 18 && life.phase === "ready") life = sampleEngine.advance(life);
  if (life.age !== 18 || life.phase !== "choice") {
    throw new Error("The sample scene must open with a decision at age 18.");
  }
  return life;
}

export function exportLife(life: LifeState): string {
  return sampleEngine.save(life);
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
    storage.setItem(SAVE_KEY, saved);
  } catch {
    throw new Error("This browser could not save the life. You can keep playing.");
  }
}
