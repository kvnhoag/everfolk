import { atom, createStore } from "jotai/vanilla";

interface ReadableStorage {
  getItem(key: string): string | null;
}

interface WritableStorage extends ReadableStorage {
  setItem(key: string, value: string): void;
}

const STORAGE_PREFIX = "everfolk:event-notifications:v1:";

function browserStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}

function storageKey(lifeKey: string): string {
  // JSON also escapes lone surrogates before URI encoding.
  return `${STORAGE_PREFIX}${encodeURIComponent(JSON.stringify(lifeKey))}`;
}

function readStoredKeys(storage: ReadableStorage | undefined, lifeKey: string): readonly string[] {
  try {
    const raw = storage?.getItem(storageKey(lifeKey));
    if (!raw) return [];
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every(key => typeof key === "string") ? value : [];
  } catch { return []; }
}

/** Shared atom state survives remounts even when browser storage is blocked. */
export function createEventNotificationStore() {
  const seenByLifeAtom = atom<ReadonlyMap<string, readonly string[]>>(new Map());
  const store = createStore();

  function readSeenEventNotifications(lifeKey: string, storage: ReadableStorage | undefined = browserStorage()): readonly string[] {
    const seenByLife = store.get(seenByLifeAtom);
    const previous = seenByLife.get(lifeKey) ?? [];
    const seen = new Set(previous);
    for (const key of readStoredKeys(storage, lifeKey)) seen.add(key);
    if (seen.size === previous.length) return previous;
    const next = [...seen];
    store.set(seenByLifeAtom, new Map(seenByLife).set(lifeKey, next));
    return next;
  }

  function rememberSeenEventNotifications(lifeKey: string, keys: readonly string[], storage: WritableStorage | undefined = browserStorage()): void {
    const seen = new Set([...readSeenEventNotifications(lifeKey, storage), ...keys]);
    const next = [...seen];
    store.set(seenByLifeAtom, previous => new Map(previous).set(lifeKey, next));
    try { storage?.setItem(storageKey(lifeKey), JSON.stringify(next)); }
    catch { /* Memory still prevents already-shown notices from reopening. */ }
  }

  return { readSeenEventNotifications, rememberSeenEventNotifications };
}

export const { readSeenEventNotifications, rememberSeenEventNotifications } = createEventNotificationStore();
