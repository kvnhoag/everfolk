import type { AccomplishmentRecord, LifeState, WorldPack } from "../src/types.ts";
import type { StorageLike } from "./session.ts";
import { getAccomplishments } from "../src/legacy.ts";
import { readEverfolkStorage } from "./brand-storage.ts";

export const LEGACY_GALLERY_KEY = "everfolk:legacy-gallery:v1";
export interface LegacyEntry {
  key: string;
  lifeKey: string;
  worldId: string;
  worldVersion: string;
  worldFingerprint: string;
  seed: string;
  characterName: string;
  worldTitle: string;
  routeTitle?: string;
  accomplishment: AccomplishmentRecord;
  /** Reserved metadata from development builds; unused by the personal gallery. */
  verifiedRunId?: string;
  nft?: { tokenId: string; explorerUrl: string };
}

export function legacyLifeKey(life: Pick<LifeState, "worldId" | "worldFingerprint" | "seed">): string {
  return JSON.stringify([life.worldId, life.worldFingerprint, life.seed]);
}

export function safeExplorerUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

function text(value: unknown, max = 2000): value is string { return typeof value === "string" && value.length <= max; }
function validEntry(value: unknown): value is LegacyEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as LegacyEntry;
  const record = entry.accomplishment;
  if (!text(entry.key) || !text(entry.lifeKey) || !text(entry.worldId) || !text(entry.worldVersion) || !text(entry.worldFingerprint) ||
    !text(entry.seed) || !text(entry.characterName) || !text(entry.worldTitle) || !record || typeof record !== "object") return false;
  if (entry.lifeKey !== legacyLifeKey({ worldId: entry.worldId, worldFingerprint: entry.worldFingerprint, seed: entry.seed }) ||
    entry.key !== JSON.stringify([entry.lifeKey, record.id])) return false;
  if (![record.id, record.achievementId, record.routeId, record.title, record.name, record.description, record.sourceId, record.outcomeId].every(value => text(value)) ||
    !["ordinary", "prestige", "ultimate"].includes(record.kind) || !Number.isSafeInteger(record.age) || record.age < 0 ||
    !Number.isSafeInteger(record.year) || record.year === 0 || !Array.isArray(record.people) || !record.people.every(value => text(value, 200))) return false;
  if (entry.verifiedRunId !== undefined && !text(entry.verifiedRunId, 300)) return false;
  if (entry.routeTitle !== undefined && !text(entry.routeTitle, 200)) return false;
  if (entry.nft && (!text(entry.nft.tokenId) || !text(entry.nft.explorerUrl) || !safeExplorerUrl(entry.nft.explorerUrl))) return false;
  return true;
}

/** A separate collection: restarting or trimming the ten-life archive never evicts achievements. */
export function readLegacyEntries(storage: StorageLike): LegacyEntry[] {
  let raw: string | null;
  try { raw = readEverfolkStorage(storage, LEGACY_GALLERY_KEY); }
  catch { throw new Error("The legacy gallery cannot access browser storage. Your current accomplishments are still visible."); }
  if (raw === null) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(validEntry) || new Set(data.map(entry => entry.key)).size !== data.length) throw new Error("Invalid collection.");
    return data;
  } catch { throw new Error("The saved legacy gallery could not be read. Its stored data has been left unchanged."); }
}

export function collectLegacyEntries(world: WorldPack, life: LifeState, previous: readonly LegacyEntry[], verifiedRunId?: string): LegacyEntry[] {
  const entries = new Map(previous.map(entry => [entry.key, entry]));
  const lifeKey = legacyLifeKey(life);
  for (const accomplishment of getAccomplishments(world, life)) {
    const key = JSON.stringify([lifeKey, accomplishment.id]);
    const existing = entries.get(key);
    entries.set(key, {
      key, lifeKey, worldId: life.worldId, worldVersion: life.worldVersion, worldFingerprint: life.worldFingerprint,
      seed: life.seed, characterName: life.character?.name ?? "Your character", worldTitle: world.title,
      routeTitle: world.legacy?.routes.find(route => route.id === accomplishment.routeId)?.title ?? accomplishment.routeId,
      accomplishment: structuredClone(accomplishment),
      ...(existing?.verifiedRunId || verifiedRunId ? { verifiedRunId: existing?.verifiedRunId ?? verifiedRunId } : {}),
      ...(existing?.nft ? { nft: { ...existing.nft } } : {}),
    });
  }
  return [...entries.values()];
}

export function persistLegacyEntries(storage: StorageLike, entries: readonly LegacyEntry[]): void {
  if (!entries.every(validEntry)) throw new Error("This legacy collection could not be saved.");
  try { storage.setItem(LEGACY_GALLERY_KEY, JSON.stringify(entries)); }
  catch { throw new Error("This browser could not save the legacy gallery. The current collection remains visible for this visit."); }
}

export function attachLegacyNft(entries: readonly LegacyEntry[], key: string, nft: NonNullable<LegacyEntry["nft"]>): LegacyEntry[] {
  if (!text(nft.tokenId) || !safeExplorerUrl(nft.explorerUrl)) throw new Error("The NFT result has no valid explorer link.");
  return entries.map(entry => entry.key === key ? { ...entry, nft: { ...nft } } : entry);
}
