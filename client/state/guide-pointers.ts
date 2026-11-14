import { YEAR_TASKS, type YearTask } from "../models/year-reminder.ts";

/**
 * The steps the yearly notice has already pointed at, per life. Kept in this browser so a reload never points at the
 * same step twice; a preview life or blocked storage keeps them in memory only.
 */

const PREFIX = "everfolk:guide-pointers:v1:";

interface PointerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): PointerStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

function parse(raw: string | null | undefined): YearTask[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? YEAR_TASKS.filter(task => value.includes(task)) : [];
  } catch { return []; }
}

export function createGuidePointers(storage: () => PointerStorage | undefined) {
  const memory = new Map<string, readonly YearTask[]>();
  const key = (lifeKey: string) => `${PREFIX}${encodeURIComponent(lifeKey)}`;

  function read(lifeKey: string, persistent: boolean): readonly YearTask[] {
    const cached = memory.get(lifeKey);
    if (cached || !persistent) return cached ?? [];
    let stored: YearTask[] = [];
    try { stored = parse(storage()?.getItem(key(lifeKey))); } catch { /* Read as none; memory still works. */ }
    memory.set(lifeKey, stored);
    return stored;
  }

  function add(lifeKey: string, task: YearTask, persistent: boolean): readonly YearTask[] {
    const current = read(lifeKey, persistent);
    if (current.includes(task)) return current;
    const next = YEAR_TASKS.filter(item => item === task || current.includes(item));
    memory.set(lifeKey, next);
    if (persistent) try { storage()?.setItem(key(lifeKey), JSON.stringify(next)); } catch { /* Memory keeps it for this visit. */ }
    return next;
  }

  return { read, add };
}

export const guidePointers = createGuidePointers(browserStorage);
