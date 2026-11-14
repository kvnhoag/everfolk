import { parseSkippedAutoConfirmLives, serializeSkippedAutoConfirmLives } from "../models/auto-mode-confirm.ts";

export const AUTO_MODE_CONFIRM_STORAGE_KEY = "everfolk:auto-mode-confirm-skip:v1";

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): PreferenceStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function readSkippedAutoConfirmLives(storage: PreferenceStorage | undefined = browserStorage()): ReadonlySet<string> {
  try { return new Set(parseSkippedAutoConfirmLives(storage?.getItem(AUTO_MODE_CONFIRM_STORAGE_KEY) ?? null)); }
  catch { return new Set(); }
}

export function writeSkippedAutoConfirmLives(
  lives: ReadonlySet<string>,
  storage: PreferenceStorage | undefined = browserStorage(),
): void {
  try { storage?.setItem(AUTO_MODE_CONFIRM_STORAGE_KEY, serializeSkippedAutoConfirmLives(lives)); }
  catch { /* In-memory state keeps "Don't ask again" working for this visit. */ }
}
