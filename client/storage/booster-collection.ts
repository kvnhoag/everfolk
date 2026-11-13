import type { StorageLike } from "../types/session.ts";
import type { BoosterCollectionPack } from "../types/booster.ts";

export const BOOSTER_COLLECTION_KEY = "everfolk:booster-collection:v1";

export class BoosterDecisionConflictError extends Error {
  constructor() {
    super("This pack was already resolved in another tab. Close and reopen it to see the saved decision.");
    this.name = "BoosterDecisionConflictError";
  }
}

function validPack(value: unknown): value is BoosterCollectionPack {
  if (!value || typeof value !== "object") return false;
  const pack = value as BoosterCollectionPack;
  return typeof pack.id === "string" && typeof pack.lifeKey === "string" && typeof pack.characterName === "string" &&
    Array.isArray(pack.cards) && pack.cards.length >= 1 && pack.cards.length <= 5 && pack.cards.every(card =>
      card && typeof card.name === "string" && typeof card.sub === "string" && typeof card.art === "string" &&
      /^\/assets\/[a-zA-Z0-9/_-]+\.(png|svg|webp)$/.test(card.art) &&
      (card.framedArt === undefined || typeof card.framedArt === "string" && /^\/assets\/cards\/collection-v14\/[a-zA-Z0-9/_-]+\.webp$/.test(card.framedArt)) &&
      (card.editionText === undefined || typeof card.editionText === "string" && /^(?:[0-9]{3,}|—)\/(?:[0-9]{3,}|∞)$/.test(card.editionText)) &&
      Number.isInteger(card.rarity) && card.rarity >= 0 && card.rarity <= 4) &&
    Array.isArray(pack.selected) && new Set(pack.selected).size === pack.selected.length &&
    pack.selected.every(index => Number.isInteger(index) && index >= 0 && index < pack.cards.length);
}

/** Corrupt collections are reported, never replaced with an empty save. */
export function readBoosterCollection(storage: StorageLike): BoosterCollectionPack[] {
  const raw = storage.getItem(BOOSTER_COLLECTION_KEY);
  if (!raw) return [];
  const packs: unknown = JSON.parse(raw);
  if (!Array.isArray(packs) || !packs.every(validPack) || new Set(packs.map(pack => pack.id)).size !== packs.length)
    throw new Error("Your saved booster collection could not be read. Existing data has been preserved.");
  return packs;
}

/** One immutable keep/skip decision per deterministic life pack. Never mints an NFT. */
export function resolveBoosterPack(storage: StorageLike, pack: BoosterCollectionPack): BoosterCollectionPack[] {
  if (!validPack(pack)) throw new Error("Invalid booster selection.");
  const collection = readBoosterCollection(storage);
  const selected = pack.selected.slice().sort((a, b) => a - b);
  const existing = collection.find(entry => entry.id === pack.id);
  if (existing) {
    const committed = existing.selected.slice().sort((a, b) => a - b);
    if (committed.length !== selected.length || committed.some((index, position) => index !== selected[position]))
      throw new BoosterDecisionConflictError();
    return collection;
  }
  const next = [...collection, { ...pack, selected }];
  storage.setItem(BOOSTER_COLLECTION_KEY, JSON.stringify(next));
  return next;
}
