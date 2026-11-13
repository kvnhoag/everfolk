import registry from "./card-art-registry.json" with { type: "json" };

/** Artwork identities are independent of the four retained onchain FigureIds. */
export type CardArtRank = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type CardArtGender = "male" | "female";
export interface CardArtwork {
  readonly id: string;
  readonly slug: string;
  readonly figureId: string;
  readonly figureName: string;
  readonly kind: "parent" | "contribution";
  readonly tier: CardArtRank | null;
  readonly gender: CardArtGender;
  readonly title: string;
  readonly canonicalTitle: string;
  readonly displayTitle: string;
  readonly subtitle: string;
  readonly bodyTitle: string;
  readonly bodyText: string;
  readonly rarity: CardArtRank;
  readonly editionLimit: number | null;
  readonly exampleEdition: string;
  readonly src: string;
  readonly footerlessSrc: string;
  readonly thumbnailSrc: string;
  readonly portraitSrc: string;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  readonly variantOf?: string;
}

export const allCardArt: readonly CardArtwork[] = Object.freeze(registry.assets.map(asset => Object.freeze({ ...asset }) as CardArtwork));
export const CARD_ART_RANKS: readonly CardArtRank[] = Object.freeze(["common", "uncommon", "rare", "epic", "legendary"]);
const parentVariants: readonly CardArtwork[] = Object.freeze(((registry as unknown as { parentVariants?: CardArtwork[] }).parentVariants ?? [])
  .map(asset => Object.freeze({ ...asset })));
export function cardArtRank(value: number | string | null | undefined): CardArtRank | undefined {
  if (typeof value === "number") return Number.isInteger(value) ? CARD_ART_RANKS[value] : undefined;
  const rank = value?.toLowerCase();
  return CARD_ART_RANKS.find(item => item === rank);
}
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
const aliases: Readonly<Record<string, { figureId: string; tier: CardArtRank }>> = Object.freeze({
  "right hand of alexander": { figureId: "alexander", tier: "rare" },
  "general of alexander": { figureId: "alexander", tier: "epic" },
  "disciple of aristotle": { figureId: "aristotle", tier: "epic" },
  "student of aristotle": { figureId: "aristotle", tier: "common" },
  "disciple of euclid": { figureId: "euclid", tier: "epic" },
  "scholar of theophrastus": { figureId: "theophrastus", tier: "epic" },
  "trusted adviser of ptolemy": { figureId: "ptolemy", tier: "epic" },
});

function artworkGender(gender: CardArtGender | undefined, seed: string | undefined): CardArtGender {
  if (gender) return gender;
  // An older save may not record sex. This selects representative art only;
  // it never rewrites the saved identity or infers sex from a person's name.
  let hash = 2166136261;
  for (const char of seed ?? "") hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return seed && (hash >>> 0) % 2 ? "female" : "male";
}

export interface CardArtQuery {
  figureId?: string | null;
  kind?: "parent" | "contribution";
  tier?: CardArtRank | number;
  gender?: CardArtGender;
  title?: string;
  seed?: string;
}

/** Resolve only an explicit figure, known title/alias, or requested rank. */
export function findCardArt(query: CardArtQuery): CardArtwork | undefined {
  const title = query.title ? normalize(query.title) : "";
  const alias = aliases[title];
  const titleOwner = title && allCardArt.find(art => (!query.kind || art.kind === query.kind) &&
    [art.title, art.canonicalTitle, art.displayTitle, art.subtitle, art.slug].some(value => normalize(value) === title));
  const figureId = query.figureId?.toLowerCase() || alias?.figureId || (titleOwner ? titleOwner.figureId : undefined);
  if (figureId && !allCardArt.some(art => art.figureId === figureId)) return undefined;
  if (alias && figureId !== alias.figureId) return undefined;
  const gender = artworkGender(query.gender, query.seed);
  const matchesFigure = (art: CardArtwork) => !figureId || art.figureId === figureId;
  const matchesKind = (art: CardArtwork) => !query.kind || art.kind === query.kind;
  if (query.kind === "parent") return figureId ? getFigureCardArt(figureId, query.tier) : undefined;
  if (query.tier !== undefined && !cardArtRank(query.tier)) return undefined;
  const tier = cardArtRank(query.tier) ?? alias?.tier;
  if (tier) return figureId ? allCardArt.find(art => art.kind === "contribution" && matchesFigure(art) && art.tier === tier && art.gender === gender) : undefined;
  if (title) return allCardArt.find(art => matchesFigure(art) && matchesKind(art) &&
    (art.kind === "parent" || art.gender === gender) &&
    [art.title, art.canonicalTitle, art.displayTitle, art.subtitle, art.slug].some(value => normalize(value) === title));
  return figureId && !query.kind ? getFigureCardArt(figureId) : undefined;
}

export function getFigureCardArt(figureId: string, rarity?: number | string): CardArtwork | undefined {
  const base = allCardArt.find(art => art.kind === "parent" && art.figureId === figureId);
  if (rarity === undefined) return base;
  const rank = cardArtRank(rarity);
  if (!rank) return undefined;
  return base?.rarity === rank ? base : parentVariants.find(art => art.figureId === figureId && art.rarity === rank);
}

/** Recorded edition values stay live; the creator's 001 numerator is never an ownership fallback. */
export function cardEditionText(art: Pick<CardArtwork, "editionLimit">, editionText?: string | null): string {
  const value = editionText?.trim().replace(/^Next edition\s+/i, "");
  const validNumber = (number: string) => Number.isSafeInteger(Number(number)) && Number(number) > 0;
  const unlimited = value?.match(/^(\d+)\s*(?:·\s*Unlimited|\/\s*∞)$/i);
  if (unlimited && validNumber(unlimited[1])) return `${unlimited[1].padStart(3, "0")}/∞`;
  const numbered = value?.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (numbered && validNumber(numbered[1]) && validNumber(numbered[2])) return `${numbered[1].padStart(3, "0")}/${numbered[2].padStart(3, "0")}`;
  return `—/${art.editionLimit === null ? "∞" : String(art.editionLimit).padStart(3, "0")}`;
}
