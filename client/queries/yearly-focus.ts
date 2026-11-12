import type { LifeState, WorldPack } from "../../src/types.ts";
import { readEverfolkStorage } from "../lib/brand-storage.ts";
import { normalizeYearlyFocus, yearlyFocusStorageKey } from "../models/yearly-focus.ts";
import type { FocusStorage, YearlyFocusId } from "../models/yearly-focus.ts";

export function readYearlyFocus(storage: FocusStorage, life: LifeState, world?: WorldPack): YearlyFocusId {
  try { return normalizeYearlyFocus(readEverfolkStorage(storage, yearlyFocusStorageKey(life)), world); }
  catch { return "everyday"; }
}
