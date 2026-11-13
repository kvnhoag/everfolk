import type { CareerGroup, FigureId } from "../../chain/ids.ts";
import type { MintCard, MintResult } from "../../chain/types.ts";
import { figureMediaPath } from "../../chain/figure-media.ts";
import { resolvePortraitState } from "../models/portrait-state.ts";
import { cardEditionText, getCardArtById, getFigureCardArt } from "../models/card-art.ts";
import { RARITY_LABELS } from "../../chain/ids.ts";
import { editionLabel } from "./edition-label.ts";
import type { BoosterCardView } from "../types/booster.ts";
import { actionName, figureName, figureTitle, GROUP_TITLE } from "./chain-copy.ts";
import type { KeptRow } from "./token-page-model.ts";

/** People of the city are drawn as working adults from the v3 portrait library, seeded so a card always shows the same person. */
const PORTRAIT_AGE = 32;

/** Each career's NFT wears that work's clothes (client/models/portrait-asset-registry.json jobs). */
const CAREER_PORTRAIT_JOB: Readonly<Record<CareerGroup, string>> = {
  letters: "clerk", military: "soldier", commerce: "trader", craft: "potter", sky: "astrologer", performance: "performer", farming: "farmer",
};

/** Card paintings for figures without an approved collection portrait; collection art always wins. */
export const FIGURE_CARD_ART: Readonly<Partial<Record<FigureId, string>>> = Object.freeze({
  alexander: "/assets/cards/figures/alexander.png",
});

/** A figure's portrait for a card: the approved collection portrait, else its card painting, else its figure art. */
export function figureCardArt(figureId: FigureId): string {
  return getFigureCardArt(figureId)?.portraitSrc ?? FIGURE_CARD_ART[figureId] ?? figureMediaPath(figureId);
}

const roleOf = (figureId: FigureId | null | undefined, cardId?: string | null) => {
  const card = getCardArtById(cardId);
  if (card) return card.kind === "parent" ? "Historical figure" : "Contributor";
  return figureId ? "Historical figure" : "Person of the city";
};
/** An earned card's own face title (e.g. "Proof Checker"); otherwise the figure or person's name. */
const cardTitle = (cardId: string | null | undefined) => {
  const card = getCardArtById(cardId);
  return card ? card.displayTitle || card.title : undefined;
};

/**
 * The artwork changes the presentation, never the figure, rarity, owner or awarded outcome.
 * A figure whose approved collection card matches the rarity shows that whole card face (framedArt);
 * people of the city wear their career's clothes from the v3 portrait library.
 */
export function boosterArtwork(figureId: MintCard["figure_id"], rarity: number, portraitMedia: string | null | undefined, seed: string, recordedEdition?: string | null, group?: CareerGroup, cardId?: string | null): Pick<BoosterCardView, "art" | "framedArt" | "editionText"> {
  // The card the contract recorded for this slot or token (chain/card-art.ts) is shown exactly.
  const recorded = getCardArtById(cardId);
  if (recorded && recorded.rarity === RARITY_LABELS[rarity]?.toLowerCase()) {
    return { art: recorded.portraitSrc, framedArt: recorded.footerlessSrc, editionText: cardEditionText(recorded, recordedEdition) };
  }
  const approved = figureId ? getFigureCardArt(figureId, rarity) : undefined;
  let authoredFigureMedia = !portraitMedia;
  if (portraitMedia && figureId && approved) {
    try {
      const pathname = new URL(portraitMedia, "https://artwork.invalid").pathname;
      authoredFigureMedia = [figureMediaPath(figureId), approved.portraitSrc, approved.src, approved.footerlessSrc].includes(pathname);
    } catch { authoredFigureMedia = false; }
  }
  if (approved && authoredFigureMedia) {
    const matchesRank = approved.rarity === RARITY_LABELS[rarity]?.toLowerCase();
    return { art: approved.portraitSrc, ...(matchesRank ? { framedArt: approved.footerlessSrc, editionText: cardEditionText(approved, recordedEdition) } : {}) };
  }
  if (portraitMedia) return { art: portraitMedia };
  if (figureId) return { art: figureCardArt(figureId) };
  return { art: resolvePortraitState({ age: PORTRAIT_AGE, seed, jobId: group ? CAREER_PORTRAIT_JOB[group] : undefined, portraitSet: "ordinary-v3" }).src };
}

/** One opened pack card, as the 3D scene draws it. */
export function packCardView(card: MintCard, slot: number, evidenceHash: string, group: CareerGroup): BoosterCardView {
  return {
    name: cardTitle(card.card_id) ?? (card.figure_id ? figureTitle(card.figure_id) : card.character_name ?? GROUP_TITLE[group]),
    rarity: card.rarity,
    ...boosterArtwork(card.figure_id, card.rarity, card.portrait_media, `${evidenceHash}:${slot}`, editionLabel({ edition_number: card.next_edition_number ?? undefined, edition_limit: card.edition_limit }), group, card.card_id),
    sub: actionName(card.action_id),
    role: roleOf(card.figure_id, card.card_id),
  };
}

/** The NFT a mint just produced. Without its deed, the card says where it is kept. */
export function resultCardView(result: MintResult, group?: CareerGroup, actionId?: string | null): BoosterCardView {
  return {
    name: result.figure_id ? figureTitle(result.figure_id) : result.character_name ?? (group ? GROUP_TITLE[group] : "A life of Alexandria"),
    rarity: result.rarity,
    ...boosterArtwork(result.figure_id, result.rarity, result.portrait_media, `token:${result.token_id}`, editionLabel(result), group),
    sub: actionId ? actionName(actionId) : "Kept on NEAR",
    role: roleOf(result.figure_id),
  };
}

/** An NFT the player owns, from its My lives row. */
export function keptCardView(row: KeptRow): BoosterCardView {
  return { name: cardTitle(row.cardId) ?? row.title, rarity: row.rarity, ...boosterArtwork(row.figureId, row.rarity, row.portraitMedia, `token:${row.tokenId}`, row.editionText, row.careerGroup, row.cardId), sub: row.actionName, role: roleOf(row.figureId, row.cardId) };
}

/** Repaint a known old figure export for viewing without rewriting a saved pack. */
export function refreshSavedBoosterCard(card: BoosterCardView): BoosterCardView {
  if (card.framedArt) return card;
  const figureId = (["alexander", "aristotle", "euclid", "cleomenes"] as const).find(id => card.art === figureMediaPath(id) || card.art === FIGURE_CARD_ART[id]);
  return figureId ? { ...card, ...boosterArtwork(figureId, card.rarity, undefined, `saved:${card.art}`, card.editionText) } : card;
}

/** A free life's pack card: the earned v14 card it shows (chain/earned-cards.ts); it never mints. */
export function freePlayCardView(card: MintCard, group: CareerGroup, life: { seed: string }, ownPortrait: string): BoosterCardView {
  return {
    name: cardTitle(card.card_id) ?? (card.figure_id ? figureName(card.figure_id) : GROUP_TITLE[group]),
    rarity: card.rarity,
    ...boosterArtwork(card.figure_id, card.rarity, card.figure_id ? undefined : ownPortrait, life.seed, undefined, group, card.card_id),
    sub: actionName(card.action_id),
    role: roleOf(card.figure_id, card.card_id),
  };
}
