import type { LifeState } from "../../src/types.ts";
import { yearEndStopStorageKey } from "../models/year-end-choice.ts";

interface StopStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function browserStorage(): StopStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function readYearEndStopAge(
  life: Pick<LifeState, "worldFingerprint" | "seed">,
  storage: StopStorage | undefined = browserStorage(),
): number | null {
  try {
    const raw = storage?.getItem(yearEndStopStorageKey(life));
    if (!raw) return null;
    const age = Number(raw);
    return Number.isInteger(age) && age >= 0 ? age : null;
  } catch {
    return null;
  }
}

export function writeYearEndStopAge(
  life: Pick<LifeState, "worldFingerprint" | "seed">,
  age: number,
  storage: StopStorage | undefined = browserStorage(),
): void {
  try { storage?.setItem(yearEndStopStorageKey(life), String(age)); }
  catch { /* Session memory keeps the interval if storage is unavailable. */ }
}

export function clearYearEndStopAge(
  life: Pick<LifeState, "worldFingerprint" | "seed">,
  storage: StopStorage | undefined = browserStorage(),
): void {
  try { storage?.removeItem?.(yearEndStopStorageKey(life)); }
  catch { /* Ignore storage errors when resetting a life. */ }
}
