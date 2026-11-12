/** Remembers whether this browser has already been shown the guided tour. */

export const TUTORIAL_STORAGE_KEY = "everfolk:tutorial:v1";

export type TutorialMemory = "started" | "closed";

export interface TutorialStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's localStorage, or undefined during server rendering or when storage is blocked. */
export function browserTutorialStorage(): TutorialStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

export function hasSeenTutorial(storage: TutorialStorage | undefined): boolean {
  try { return storage?.getItem(TUTORIAL_STORAGE_KEY) != null; }
  catch { return false; }
}

export function rememberTutorial(storage: TutorialStorage | undefined, memory: TutorialMemory): void {
  try { storage?.setItem(TUTORIAL_STORAGE_KEY, memory); }
  catch { /* Without storage the tour may open again next visit; the Close still works now. */ }
}
