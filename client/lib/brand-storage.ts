interface ReadableStorage {
  getItem(key: string): string | null;
}

/** New writes use Everfolk; existing browser data remains readable and untouched. */
export function readEverfolkStorage(storage: ReadableStorage, key: string): string | null {
  const current = storage.getItem(key);
  if (current !== null || !key.startsWith("everfolk:")) return current;
  return storage.getItem(key.replace(/^everfolk:/, "historical-lives:"));
}
