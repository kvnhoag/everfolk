import type { CareerGroup } from "../../chain/ids.ts";
import type { MintCard, MintResult } from "../../chain/types.ts";
import { figureMediaPath } from "../../chain/figure-media.ts";
import { portraitSource } from "../models/life-background.ts";
import type { BoosterCardView } from "../types/booster.ts";
import { actionName, figureTitle, GROUP_TITLE } from "./chain-copy.ts";
import type { KeptRow } from "./token-page-model.ts";

/** Generated portraits use an adult face, seeded so a card always draws the same person. */
const PORTRAIT_AGE = 45;

function artFor(figureId: MintCard["figure_id"], portraitMedia: string | null | undefined, seed: string): string {
  return portraitMedia ?? (figureId ? figureMediaPath(figureId) : portraitSource({ age: PORTRAIT_AGE, seed }));
}

/** One opened pack card, as the 3D scene draws it. */
export function packCardView(card: MintCard, slot: number, evidenceHash: string, group: CareerGroup): BoosterCardView {
  return {
    name: card.figure_id ? figureTitle(card.figure_id) : card.character_name ?? GROUP_TITLE[group],
    rarity: card.rarity,
    art: artFor(card.figure_id, card.portrait_media, `${evidenceHash}:${slot}`),
    sub: actionName(card.action_id),
  };
}

/** The NFT a mint just produced. Without its deed, the card says where it is kept. */
export function resultCardView(result: MintResult, group?: CareerGroup, actionId?: string | null): BoosterCardView {
  return {
    name: result.figure_id ? figureTitle(result.figure_id) : result.character_name ?? (group ? GROUP_TITLE[group] : "A life of Alexandria"),
    rarity: result.rarity,
    art: artFor(result.figure_id, result.portrait_media, `token:${result.token_id}`),
    sub: actionId ? actionName(actionId) : "Kept on NEAR",
  };
}

/** An NFT the player owns, from its My lives row. */
export function keptCardView(row: KeptRow): BoosterCardView {
  return { name: row.title, rarity: row.rarity, art: artFor(row.figureId, row.portraitMedia, `token:${row.tokenId}`), sub: row.actionName };
}
