import { FIGURE_ACTIONS, NPC_ACTIONS, type FigureId } from "../../chain/ids.ts";
import type { Listing, TokenExtra, TokenStats } from "../../chain/types.ts";
import { formatYear } from "../../src/calendar.ts";
import { actionName, actionOption, figureTitle, groupOfAction, GROUP_TITLE, rarityLabel, type ActionOption } from "./chain-copy.ts";
import { chainHref } from "./chain-route.ts";
import { formatPercent } from "./life-report-model.ts";
import { formatNear } from "./near-amount.ts";
import type { TokenView } from "./types.ts";

/** Pure view models for a kept life's page and the market (Task 20). */

const EVIDENCE_PATH = "/api/ranked/evidence/";
const NO_EVIDENCE = /^0+$/u;

export function tokenTitle(extra: TokenExtra): string {
  return extra.kind === "figure" && extra.figure_id ? figureTitle(extra.figure_id) : GROUP_TITLE[extra.career_group];
}

export function reachLine(stats: TokenStats): string {
  const lives = stats.lives_influenced === 1 ? "1 life" : `${stats.lives_influenced} lives`;
  return `Affected ${lives} · earned ${formatNear(stats.earned)} NEAR`;
}

/** Figures choose from their own deeds; people of the city from their current action's career group (the contract's rule). */
export function tokenActionMenu(extra: TokenExtra): (ActionOption & { selected: boolean })[] {
  const group = groupOfAction(extra.action_id);
  const ids: readonly string[] = extra.kind === "figure" && extra.figure_id
    ? FIGURE_ACTIONS[extra.figure_id]
    : group ? NPC_ACTIONS[group].actions : [extra.action_id];
  return ids.map(id => ({ ...actionOption(id), selected: id === extra.action_id }));
}

function yearText(year: number): string {
  return Number.isSafeInteger(year) && year !== 0 ? formatYear(year) : "?";
}

export interface TokenPageInput {
  tokenId: string;
  token: TokenView;
  stats: TokenStats;
  viewer: string | null;
  /** The viewer's claimable balance in yoctoNEAR. */
  balance: string;
  listing: Listing | null;
  children: readonly string[];
  sourceTokens: Readonly<Record<string, TokenView | null>>;
}

export interface TokenPageView {
  title: string;
  kindLabel: string;
  isFigure: boolean;
  figureId?: FigureId | null;
  rarityLabel: string;
  affection: number;
  affectionText: string;
  lifeLine: string;
  owner: string;
  isOwner: boolean;
  reach: string;
  currentAction: ActionOption;
  menu: (ActionOption & { selected: boolean })[];
  canChangeAction: boolean;
  claimableText: string | null;
  listing: { priceText: string; priceYocto: string; seller: string } | null;
  canList: boolean;
  canUnlist: boolean;
  canBuy: boolean;
  sources: { tokenId: string; href: string; name: string; percentText: string }[];
  children: { tokenId: string; href: string }[];
  evidenceHref: string | null;
}

export function tokenPageView(input: TokenPageInput): TokenPageView {
  const { extra, owner_id: owner } = input.token;
  const isOwner = input.viewer !== null && input.viewer === owner;
  const isFigure = extra.kind === "figure" && extra.figure_id !== null;
  const menu = tokenActionMenu(extra);
  const claimable = isOwner && /^\d+$/.test(input.balance) && BigInt(input.balance) > 0n;
  return {
    title: tokenTitle(extra),
    kindLabel: isFigure ? "Famous figure" : "Person of the city",
    isFigure,
    figureId: isFigure ? extra.figure_id : null,
    rarityLabel: rarityLabel(extra.rarity),
    affection: extra.affection,
    affectionText: `Affection ${extra.affection} / 100`,
    lifeLine: `Lived ${yearText(extra.birth_year)} – ${yearText(extra.death_year)}`,
    owner,
    isOwner,
    reach: reachLine(input.stats),
    currentAction: actionOption(extra.action_id),
    menu,
    canChangeAction: isOwner && menu.length > 1,
    claimableText: claimable ? `${formatNear(input.balance)} NEAR` : null,
    listing: input.listing ? { priceText: `${formatNear(input.listing.price)} NEAR`, priceYocto: input.listing.price, seller: input.listing.seller_id } : null,
    canList: isOwner && !input.listing,
    canUnlist: isOwner && input.listing !== null,
    canBuy: input.viewer !== null && !isOwner && input.listing !== null,
    sources: extra.sources.map(source => {
      const token = input.sourceTokens[source.token_id];
      return { tokenId: source.token_id, href: chainHref({ kind: "token", tokenId: source.token_id }), name: token ? tokenTitle(token.extra) : `Token #${source.token_id}`, percentText: formatPercent(source.bps) };
    }),
    children: input.children.map(tokenId => ({ tokenId, href: chainHref({ kind: "token", tokenId }) })),
    evidenceHref: NO_EVIDENCE.test(extra.evidence_hash) ? null : `${EVIDENCE_PATH}${extra.evidence_hash}`,
  };
}

export interface MarketRow {
  tokenId: string;
  href: string;
  title: string;
  isFigure: boolean;
  figureId?: FigureId | null;
  rarityLabel: string;
  actionName: string;
  seller: string;
  priceText: string;
  priceYocto: string;
  canBuy: boolean;
}

export function marketRows(listings: readonly Listing[], tokens: Readonly<Record<string, TokenView | null>>, viewer: string | null): MarketRow[] {
  return listings.map(listing => {
    const token = tokens[listing.token_id];
    return {
      tokenId: listing.token_id,
      href: chainHref({ kind: "token", tokenId: listing.token_id }),
      title: token ? tokenTitle(token.extra) : `Token #${listing.token_id}`,
      isFigure: token?.extra.kind === "figure",
      figureId: token?.extra.kind === "figure" ? token.extra.figure_id : null,
      rarityLabel: token ? rarityLabel(token.extra.rarity) : "",
      actionName: token ? actionName(token.extra.action_id) : "",
      seller: listing.seller_id,
      priceText: `${formatNear(listing.price)} NEAR`,
      priceYocto: listing.price,
      canBuy: viewer !== null && viewer !== listing.seller_id,
    };
  });
}
