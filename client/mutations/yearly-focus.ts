import type { LifeState } from "../../src/types.ts";
import { normalizeYearlyFocus, yearlyFocusStorageKey } from "../models/yearly-focus.ts";
import type { FocusStorage, YearlyFocusId } from "../models/yearly-focus.ts";

export function persistYearlyFocus(storage: FocusStorage, life: LifeState, focusId: YearlyFocusId): void {
  storage.setItem(yearlyFocusStorageKey(life), normalizeYearlyFocus(focusId));
}
