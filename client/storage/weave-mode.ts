export const WEAVE_MODE_STORAGE_KEY = "everfolk:weave-mode:v1";

interface ModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): ModeStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

/** A new life keeps the selected mode until the player changes the toggle. */
export function readWeaveMode(storage: ModeStorage | undefined = browserStorage()): boolean {
  try { return storage?.getItem(WEAVE_MODE_STORAGE_KEY) !== "off"; }
  catch { return true; }
}

export function writeWeaveMode(enabled: boolean, storage: ModeStorage | undefined = browserStorage()): void {
  try { storage?.setItem(WEAVE_MODE_STORAGE_KEY, enabled ? "on" : "off"); }
  catch { /* The menu keeps the choice for this visit when storage is unavailable. */ }
}
