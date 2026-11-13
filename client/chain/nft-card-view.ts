import type { CareerGroup, FigureId } from "../../chain/ids.ts";
import type { MintCard, MintResult } from "../../chain/types.ts";
import { figureMediaPath } from "../../chain/figure-media.ts";
import { resolvePortraitState } from "../models/portrait-state.ts";
import type { BoosterCardView } from "../types/booster.ts";
import { actionName, figureTitle, GROUP_TITLE } from "./chain-copy.ts";
import type { KeptRow } from "./token-page-model.ts";

/** People of the city are drawn as working adults from the v3 portrait library, seeded so a card always shows the same person. */
const PORTRAIT_AGE = 32;

/** Each career's NFT wears that work's clothes (client/models/portrait-asset-registry.json jobs). */
const CAREER_PORTRAIT_JOB: Readonly<Record<CareerGroup, string>> = {
  letters: "clerk", military: "soldier", commerce: "trader", craft: "potter", sky: "astrologer", performance: "performer", farming: "farmer",
};

/** Approved card paintings for historical figures (artwork/cards); figures without one keep their figure art. */
export const FIGURE_CARD_ART: Readonly<Partial<Record<FigureId, string>>> = Object.freeze({
  alexander: "/assets/cards/figures/alexander.png",
});

export function figureCardArt(figureId: FigureId): string {
  return FIGURE_CARD_ART[figureId] ?? figureMediaPath(figureId);
}

const roleOf = (figureId: FigureId | null | undefined) => (figureId ? "Historical figure" : "Person of the city");

function artFor(figureId: FigureId | null | undefined, portraitMedia: string | null | undefined, seed: string, group?: CareerGroup): string {
  if (portraitMedia) return portraitMedia;
  if (figureId) return figureCardArt(figureId);
  return resolvePortraitState({ age: PORTRAIT_AGE, seed, jobId: group ? CAREER_PORTRAIT_JOB[group] : undefined }).src;
}

/** One opened pack card, as the 3D scene draws it. */
export function packCardView(card: MintCard, slot: number, evidenceHash: string, group: CareerGroup): BoosterCardView {
  return {
    name: card.figure_id ? figureTitle(card.figure_id) : card.character_name ?? GROUP_TITLE[group],
    rarity: card.rarity,
    art: artFor(card.figure_id, card.portrait_media, `${evidenceHash}:${slot}`, group),
    sub: actionName(card.action_id),
    role: roleOf(card.figure_id),
  };
}

/** The NFT a mint just produced. Without its deed, the card says where it is kept. */
export function resultCardView(result: MintResult, group?: CareerGroup, actionId?: string | null): BoosterCardView {
  return {
    name: result.figure_id ? figureTitle(result.figure_id) : result.character_name ?? (group ? GROUP_TITLE[group] : "A life of Alexandria"),
    rarity: result.rarity,
    art: artFor(result.figure_id, result.portrait_media, `token:${result.token_id}`, group),
    sub: actionId ? actionName(actionId) : "Kept on NEAR",
    role: roleOf(result.figure_id),
  };
}

/** An NFT the player owns, from its My lives row. */
export function keptCardView(row: KeptRow): BoosterCardView {
  return { name: row.title, rarity: row.rarity, art: artFor(row.figureId, row.portraitMedia, `token:${row.tokenId}`, row.careerGroup), sub: row.actionName, role: roleOf(row.figureId) };
}
