import type { PublishedCatalog, PublishedWorld } from "../../server/content.ts";
import { readEverfolkStorage } from "../lib/brand-storage.ts";
import { requestJson } from "../lib/http.ts";
import { SELECTED_WORLD_KEY } from "../lib/world-selection.ts";

const worldRequestOptions = {
  timeoutMs: 12_000,
  jsonHeaders: false,
  tolerateInvalidJson: false,
  includeMessage: false,
  fallbackError: "The world library could not be opened.",
};

export function readWorldCatalog(): Promise<PublishedCatalog> {
  return requestJson("/api/worlds", { cache: "no-store" }, worldRequestOptions);
}

export function readWorld(id: string): Promise<PublishedWorld> {
  return requestJson(`/api/worlds/${encodeURIComponent(id)}`, { cache: "no-store" }, worldRequestOptions);
}

export function readSelectedWorld(storage: Pick<Storage, "getItem">): PublishedWorld | null {
  const saved = readEverfolkStorage(storage, SELECTED_WORLD_KEY);
  return saved === null ? null : JSON.parse(saved) as PublishedWorld;
}

export function hasLegacyWorldSave(storage: Pick<Storage, "getItem">): boolean {
  return readEverfolkStorage(storage, "everfolk:alexandria-sample:v3") !== null;
}
