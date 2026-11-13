import { CAREER_GROUPS, FIGURE_IDS, type CareerGroup } from "./ids.ts";
import { figureRosterEntry } from "./catalog/figure-roster.ts";
import { RARITY_CAPS, designKey } from "./rarity-caps.ts";

/**
 * Which v14 collection card a pack card or minted NFT shows (public/assets/cards/collection-v14).
 * The contract stores the table this module builds (`set_card_art`) and matches it with the same rule,
 * so the pack, the minted NFT's metadata and every in-game view show one card.
 */

export type CardSex = "male" | "female";
export const CARD_RANKS = ["common", "uncommon", "rare", "epic", "legendary"] as const;

/** A person of the city draws their career's profession set from one historical figure. */
export const CARD_ART_CAREER_FIGURE: Readonly<Record<CareerGroup, string>> = Object.freeze({
  letters: "aristotle", military: "alexander", commerce: "cleomenes", craft: "lysippos",
  sky: "euclid", performance: "menander", farming: "theophrastus",
});

/** Profession cards stop at Epic; a Legendary person of the city has no v14 card yet. */
const TOP_PROFESSION_RARITY = 3;

export interface CardMatch {
  figure_id: string | null;
  rarity: number;
  career_group: string | null;
  sex?: string | null;
}

/** One contract card-table row: what to match, and what the minted NFT shows. */
export interface CardArtEntry {
  card_id: string;
  title: string;
  /** Absolute image URL, so wallets and markets can load it. */
  media: string;
  rarity: number;
  figure_id: string | null;
  career_group: string | null;
  sex: CardSex | null;
  /** Copies of this card design at this rarity; null is unlimited. */
  edition_limit: number | null;
}

const isSex = (value: unknown): value is CardSex => value === "male" || value === "female";

/** The card a pack slot or token shows, or null when the collection has none for it. */
export function cardIdFor(match: CardMatch): string | null {
  const rank = CARD_RANKS[match.rarity];
  if (!rank) return null;
  if (match.figure_id) {
    const base = figureRosterEntry(match.figure_id)?.baseRank.toLowerCase();
    if (!base) return null;
    return base === rank ? `${match.figure_id}-parent` : `${match.figure_id}-parent-${rank}`;
  }
  const figure = CARD_ART_CAREER_FIGURE[match.career_group as CareerGroup];
  if (!figure || match.rarity > TOP_PROFESSION_RARITY || !isSex(match.sex)) return null;
  return `${figure}-${rank}-${match.sex}`;
}

/** The design a copy is counted under, as contract/src/card_art.rs `card_design`: its card, else the figure or deed. */
export function cardDesign(match: CardMatch, npcActionId: string): string {
  const cardId = cardIdFor(match);
  return cardId ? `card:${cardId}` : designKey(match.figure_id, npcActionId);
}

/** The contract's lookup, mirrored: figure cards match figure and rarity; profession cards also career and sex. */
export function cardArtFor(table: readonly CardArtEntry[], match: CardMatch): CardArtEntry | undefined {
  return table.find(entry => entry.rarity === match.rarity && (match.figure_id
    ? entry.figure_id === match.figure_id
    : entry.figure_id === null && entry.career_group === match.career_group && isSex(match.sex) && entry.sex === match.sex));
}

interface ManifestCard { id: string; displayTitle?: string; title: string; footerlessSrc: string }
export interface CardManifest { assets: readonly ManifestCard[]; parentVariants: readonly ManifestCard[] }

/** Every card a pack can draw, with the card face's title and its absolute footerless image. */
export function buildCardArtTable(manifest: CardManifest, mediaBase: string): CardArtEntry[] {
  let base: URL;
  try { base = new URL(mediaBase); } catch { throw new Error(`Card images need an absolute https base, got "${mediaBase}".`); }
  if (base.protocol !== "https:") throw new Error(`Card images need an absolute https base, got "${mediaBase}".`);
  const prefix = `${base.origin}${base.pathname.replace(/\/+$/u, "")}`;
  const cards = new Map([...manifest.assets, ...manifest.parentVariants].map(card => [card.id, card]));
  const entry = (match: Omit<CardArtEntry, "card_id" | "title" | "media" | "edition_limit">): CardArtEntry => {
    const cardId = cardIdFor(match);
    const card = cardId ? cards.get(cardId) : undefined;
    if (!cardId || !card) throw new Error(`The v14 collection has no card for ${JSON.stringify(match)}.`);
    return {
      card_id: cardId, title: card.displayTitle || card.title, media: `${prefix}${card.footerlessSrc}`,
      ...match, edition_limit: RARITY_CAPS[match.rarity] ?? null,
    };
  };
  const figures = FIGURE_IDS.flatMap(figure_id => CARD_RANKS.map((_, rarity) => entry({ figure_id, rarity, career_group: null, sex: null })));
  const professions = CAREER_GROUPS.flatMap(career_group => CARD_RANKS.slice(0, TOP_PROFESSION_RARITY + 1).flatMap((_, rarity) =>
    (["male", "female"] as const).map(sex => entry({ figure_id: null, rarity, career_group, sex }))));
  return [...figures, ...professions];
}
