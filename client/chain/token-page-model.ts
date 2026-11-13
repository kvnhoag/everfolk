import type { CareerGroup } from "../../chain/ids.ts";
import { actionsForGroup } from "../../chain/catalog/demo-deeds.ts";
import { FIGURE_ACTIONS, type FigureId } from "../../chain/ids.ts";
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
  if (extra.stage_title && extra.character_name) {
    return extra.kind === "figure" && extra.figure_id ? figureTitle(extra.figure_id) : `${extra.character_name} · ${extra.stage_title}`;
  }
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
    : group ? actionsForGroup(group) : [extra.action_id];
  return ids.map(id => ({ ...actionOption(id), selected: id === extra.action_id }));
}

function yearText(year: number): string {
  return Number.isSafeInteger(year) && year !== 0 ? formatYear(year) : "?";
}

const NO_EFFECT_TEXT = "Its effect on later lives is not recorded.";

export interface TokenStory { career: string; lived: string; deed: { name: string; effect: string } }

function tokenStory(extra: TokenExtra): TokenStory {
  const deed = actionOption(extra.action_id);
  return {
    career: GROUP_TITLE[extra.career_group] ?? extra.career_group,
    lived: `Lived ${yearText(extra.birth_year)} – ${yearText(extra.death_year)}`,
    deed: { name: deed.name, effect: deed.description || NO_EFFECT_TEXT },
  };
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
  portraitMedia?: string | null;
  stageInfo?: {
    stageId?: string;
    stageTitle?: string;
    fromAge?: number;
    toAge?: number;
    district?: string;
    field?: string | null;
    tier?: string | number;
  } | null;
  rarityLabel: string;
  affection: number;
  affectionText: string;
  lifeLine: string;
  story: TokenStory;
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
    kindLabel: isFigure ? "Famous figure" : extra.stage_id ? "Stage figure" : "Person of the city",
    isFigure,
    figureId: isFigure ? extra.figure_id : null,
    portraitMedia: extra.portrait_media ?? null,
    stageInfo: extra.stage_id ? {
      stageId: extra.stage_id,
      stageTitle: extra.stage_title,
      fromAge: extra.from_age,
      toAge: extra.to_age,
      district: extra.district,
      field: extra.field,
      tier: extra.tier,
    } : null,
    rarityLabel: rarityLabel(extra.rarity),
    affection: extra.affection,
    affectionText: `Affection ${extra.affection} / 100`,
    lifeLine: `Lived ${yearText(extra.birth_year)} – ${yearText(extra.death_year)}`,
    story: tokenStory(extra),
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

const EMBLEMS: Record<CareerGroup, string> = {
  letters: "literacy", military: "warfare", commerce: "reckoning", craft: "craft", sky: "astronomy", performance: "music", farming: "farming",
};

/** A skill icon standing for a career group, for people of the city who have no collectible art. */
export function careerEmblem(group: string): string {
  return Object.hasOwn(EMBLEMS, group) ? EMBLEMS[group as CareerGroup] : group;
}

export interface MarketRow {
  tokenId: string;
  href: string;
  title: string;
  isFigure: boolean;
  figureId?: FigureId | null;
  portraitMedia?: string | null;
  rarityLabel: string;
  actionName: string;
  seller: string;
  priceText: string;
  priceYocto: string;
  canBuy: boolean;
  /** Null when the token could not be read. */
  careerGroup: CareerGroup | null;
  /** Null when the token could not be read. */
  rarity: number | null;
  /** 1–100; absent when the token could not be read. */
  affection?: number;
  /** Skill icon for people of the city; null for figures, which show their art. */
  emblem?: string | null;
}

export type MarketTab = "all" | "figures" | "people";

export function marketTabs(rows: readonly MarketRow[]): { id: MarketTab; label: string; count: number }[] {
  const figures = rows.filter(row => row.isFigure).length;
  return [
    { id: "all", label: "All", count: rows.length },
    { id: "figures", label: "Famous figures", count: figures },
    { id: "people", label: "People of the city", count: rows.length - figures },
  ];
}

export function filterMarket(rows: readonly MarketRow[], tab: MarketTab): MarketRow[] {
  return rows.filter(row => tab === "all" || (tab === "figures") === row.isFigure);
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
      portraitMedia: token?.extra.portrait_media ?? null,
      rarityLabel: token ? rarityLabel(token.extra.rarity) : "",
      actionName: token ? actionName(token.extra.action_id) : "",
      seller: listing.seller_id,
      priceText: `${formatNear(listing.price)} NEAR`,
      priceYocto: listing.price,
      canBuy: viewer !== null && viewer !== listing.seller_id,
      careerGroup: token ? token.extra.career_group : null,
      rarity: token ? token.extra.rarity : null,
      ...(token ? { affection: token.extra.affection, emblem: token.extra.kind === "figure" ? null : careerEmblem(token.extra.career_group) } : {}),
    };
  });
}

export interface KeptRow { tokenId: string; href: string; title: string; isFigure: boolean; figureId: FigureId | null; portraitMedia?: string | null; rarity: number; rarityLabel: string; actionName: string; affection: number; emblem: string | null }

/** The signed-in player's own kept lives. */
export function keptRows(tokens: readonly (TokenView & { token_id: string })[]): KeptRow[] {
  return tokens.map(token => {
    const isFigure = token.extra.kind === "figure" && token.extra.figure_id !== null;
    return {
      tokenId: token.token_id, href: chainHref({ kind: "token", tokenId: token.token_id }), title: tokenTitle(token.extra), isFigure,
      figureId: isFigure ? token.extra.figure_id : null, portraitMedia: token.extra.portrait_media ?? null, rarity: token.extra.rarity, rarityLabel: rarityLabel(token.extra.rarity), actionName: actionName(token.extra.action_id),
      affection: token.extra.affection, emblem: isFigure ? null : careerEmblem(token.extra.career_group),
    };
  });
}
