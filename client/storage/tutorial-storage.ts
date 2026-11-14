/** Remembers which tutorial hints this browser has seen and the hint the tutorial was last on. */

export const TUTORIAL_STORAGE_KEY = "everfolk:tutorial:v2";
/** The old linear tour only recorded "started" or "closed". */
export const LEGACY_TUTORIAL_STORAGE_KEY = "everfolk:tutorial:v1";

export interface TutorialProgress {
  seen: readonly string[];
  current: string | null;
  /** The player turned automatic tips off; new sections only glow. Absent in older saves (tips on). */
  tipsOff?: boolean;
}

export interface TutorialStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const EMPTY: TutorialProgress = Object.freeze({ seen: [], current: null });

/** The browser's localStorage, or undefined during server rendering or when storage is blocked. */
export function browserTutorialStorage(): TutorialStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

function parseProgress(raw: string): TutorialProgress {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return EMPTY;
    const { seen, current, tipsOff } = value as { seen?: unknown; current?: unknown; tipsOff?: unknown };
    return {
      seen: Array.isArray(seen) ? seen.filter((id): id is string => typeof id === "string") : [],
      current: typeof current === "string" ? current : null,
      ...(tipsOff === true ? { tipsOff: true } : {}),
    };
  } catch { return EMPTY; }
}

/** Reads saved progress. Broken or blocked storage reads as a fresh start; a player of the old tour skips the welcome. */
export function readTutorialProgress(storage: TutorialStorage | undefined): TutorialProgress {
  try {
    const raw = storage?.getItem(TUTORIAL_STORAGE_KEY);
    if (raw != null) return parseProgress(raw);
    const legacy = storage?.getItem(LEGACY_TUTORIAL_STORAGE_KEY);
    return legacy === "started" || legacy === "closed" ? { seen: ["welcome"], current: null } : EMPTY;
  } catch { return EMPTY; }
}

export function writeTutorialProgress(storage: TutorialStorage | undefined, progress: TutorialProgress): void {
  try { storage?.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ seen: progress.seen, current: progress.current, ...(progress.tipsOff ? { tipsOff: true } : {}) })); }
  catch { /* Without storage, hints may show again next visit; the tutorial still works now. */ }
}
