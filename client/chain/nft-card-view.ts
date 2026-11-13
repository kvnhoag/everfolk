import type { CareerGroup } from "../../chain/ids.ts";
import type { MintCard, MintResult } from "../../chain/types.ts";
import { figureMediaPath } from "../../chain/figure-media.ts";
import { portraitSource } from "../models/life-background.ts";
import { cardEditionText, getFigureCardArt } from "../models/card-art.ts";
import { RARITY_LABELS } from "../../chain/ids.ts";
import { editionLabel } from "./edition-label.ts";
import type { BoosterCardView } from "../types/booster.ts";
import { actionName, figureTitle, GROUP_TITLE } from "./chain-copy.ts";
import type { KeptRow } from "./token-page-model.ts";

/** Generated portraits use an adult face, seeded so a card always draws the same person. */
const PORTRAIT_AGE = 45;

/** The artwork changes the presentation, never the figure, rarity, owner or awarded outcome. */
export function boosterArtwork(figureId: MintCard["figure_id"], rarity: number, portraitMedia: string | null | undefined, seed: string, recordedEdition?: string | null): Pick<BoosterCardView, "art" | "framedArt" | "editionText"> {
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
  return { art: portraitMedia ?? (figureId ? figureMediaPath(figureId) : portraitSource({ age: PORTRAIT_AGE, seed })) };
}

/** One opened pack card, as the 3D scene draws it. */
export function packCardView(card: MintCard, slot: number, evidenceHash: string, group: CareerGroup): BoosterCardView {
  return {
    name: card.figure_id ? figureTitle(card.figure_id) : card.character_name ?? GROUP_TITLE[group],
    rarity: card.rarity,
    ...boosterArtwork(card.figure_id, card.rarity, card.portrait_media, `${evidenceHash}:${slot}`, editionLabel({ edition_number: card.next_edition_number ?? undefined, edition_limit: card.edition_limit })),
    sub: actionName(card.action_id),
  };
}

/** The NFT a mint just produced. Without its deed, the card says where it is kept. */
export function resultCardView(result: MintResult, group?: CareerGroup, actionId?: string | null): BoosterCardView {
  return {
    name: result.figure_id ? figureTitle(result.figure_id) : result.character_name ?? (group ? GROUP_TITLE[group] : "A life of Alexandria"),
    rarity: result.rarity,
    ...boosterArtwork(result.figure_id, result.rarity, result.portrait_media, `token:${result.token_id}`, editionLabel(result)),
    sub: actionId ? actionName(actionId) : "Kept on NEAR",
  };
}

/** An NFT the player owns, from its My lives row. */
export function keptCardView(row: KeptRow): BoosterCardView {
  return { name: row.title, rarity: row.rarity, ...boosterArtwork(row.figureId, row.rarity, row.portraitMedia, `token:${row.tokenId}`, row.editionText), sub: row.actionName };
}

/** Repaint a known old figure export for viewing without rewriting a saved pack. */
export function refreshSavedBoosterCard(card: BoosterCardView): BoosterCardView {
  if (card.framedArt) return card;
  const figureId = (["alexander", "aristotle", "euclid", "cleomenes"] as const).find(id => card.art === figureMediaPath(id));
  return figureId ? { ...card, ...boosterArtwork(figureId, card.rarity, undefined, `saved:${card.art}`, card.editionText) } : card;
}
