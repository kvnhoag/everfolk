/** Whether How to Play opens each time the game screen starts. On unless the player switched it off. */

export const HOW_TO_PLAY_STORAGE_KEY = "everfolk:how-to-play:v1";

interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): PreferenceStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function readHowToPlayAtStart(storage: PreferenceStorage | undefined = browserStorage()): boolean {
  try { return storage?.getItem(HOW_TO_PLAY_STORAGE_KEY) !== "off"; }
  catch { return true; }
}

export function writeHowToPlayAtStart(on: boolean, storage: PreferenceStorage | undefined = browserStorage()): void {
  try { storage?.setItem(HOW_TO_PLAY_STORAGE_KEY, on ? "on" : "off"); }
  catch { /* Without storage the choice lasts for this visit only. */ }
}
