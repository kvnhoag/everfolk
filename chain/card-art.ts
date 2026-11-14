import type { WorldPack } from "../src/types.ts";
import { reachableEarnedCardIds } from "./earned-cards.ts";
import { RARITY_CAPS } from "./rarity-caps.ts";

/**
 * The contract's card table (`set_card_art`): every v14 collection card a life can earn in a figure-path world
 * (chain/earned-cards.ts), with the card face's title and its absolute footerless image, so a minted NFT names a
 * card that wallets and markets can show. The contract looks cards up by id; it never chooses one.
 */
export interface CardArtEntry {
  card_id: string;
  title: string;
  /** Absolute image URL, so wallets and markets can load it. */
  media: string;
  rarity: number;
  /** Copies of this card at its rarity; null is unlimited. */
  edition_limit: number | null;
}

const RANKS = ["common", "uncommon", "rare", "epic", "legendary"];
interface ManifestCard { id: string; displayTitle?: string; title: string; footerlessSrc: string; rarity: string }
export interface CardManifest { assets: readonly ManifestCard[]; parentVariants: readonly ManifestCard[] }

export function buildCardArtTable(manifest: CardManifest, mediaBase: string, world: WorldPack): CardArtEntry[] {
  let base: URL;
  try { base = new URL(mediaBase); } catch { throw new Error(`Card images need an absolute https base, got "${mediaBase}".`); }
  if (base.protocol !== "https:") throw new Error(`Card images need an absolute https base, got "${mediaBase}".`);
  const prefix = `${base.origin}${base.pathname.replace(/\/+$/u, "")}`;
  const cards = new Map([...manifest.assets, ...manifest.parentVariants].map(card => [card.id, card]));
  return reachableEarnedCardIds(world).map(cardId => {
    const card = cards.get(cardId);
    if (!card) throw new Error(`The v14 collection has no card ${cardId}.`);
    const rarity = RANKS.indexOf(card.rarity);
    if (rarity < 0) throw new Error(`Card ${cardId} has an unknown rarity.`);
    return { card_id: cardId, title: card.displayTitle || card.title, media: `${prefix}${card.footerlessSrc}`, rarity, edition_limit: RARITY_CAPS[rarity] ?? null };
  });
}
