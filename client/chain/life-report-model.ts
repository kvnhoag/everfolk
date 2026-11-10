import { NPC_ACTIONS, RARITY_POWER_BPS, type FigureId } from "../../chain/ids.ts";
import { explorerUrl } from "./account-bar-model.ts";
import type { CareerGroup } from "../../chain/ids.ts";
import type { Evidence, LifeView, MintResult, SourceImpact } from "../../chain/types.ts";
import { formatYear } from "../../src/calendar.ts";
import type { OwnersByToken } from "./born-into-model.ts";
import {
  actionDescription, actionName, actionOption, figureName, figureTitle, GROUP_TITLE, personForAction, rarityLabel, withOwner,
  type ActionOption,
} from "./chain-copy.ts";
import { chainHref } from "./chain-route.ts";
import { computeShares } from "./mock-math.ts";

/** Pure view models for "Who shaped your life", "Mint this life?" and the reveal (Task 19). */

export interface ReportRow {
  tokenId: string;
  who: string;
  kind: "figure" | "npc";
  kindLabel: string;
  actionName: string;
  actionLabel: string;
  rarityLabel: string;
  bps: number;
  /** Share in percent (bps / 100). */
  percent: number;
  percentText: string;
}

export interface LifeReport {
  rows: ReportRow[];
  /** Share kept by the city when more than 64 sources shaped the life (the contract's cap); null otherwise. */
  unassignedPercent: string | null;
}

const KIND_LABEL = { figure: "Famous figure", npc: "Person of the city" } as const;

/** "33.34%", "50%": bps as a percentage with at most two decimals. */
export function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/u, "")}%`;
}

function sourceRow(life: LifeView, tokenId: string, bps: number, owners: OwnersByToken): ReportRow {
  const pick = life.figure_picks.find(candidate => candidate.token_id === tokenId);
  const draw = life.draws.find(candidate => candidate.token_id === tokenId);
  const kind = pick ? "figure" : "npc";
  const actionId = pick?.action_id ?? draw?.action_id ?? null;
  const name = pick ? figureName(pick.figure_id) : personForAction(actionId);
  return {
    tokenId, kind, kindLabel: KIND_LABEL[kind], who: withOwner(name, owners[tokenId]),
    actionName: actionName(actionId), actionLabel: actionDescription(actionId),
    rarityLabel: rarityLabel(pick?.rarity ?? draw?.rarity ?? null),
    bps, percent: bps / 100, percentText: formatPercent(bps),
  };
}

/** Shares use the contract's own rule (largest remainder to exactly 10 000 bps), so the numbers match what is paid. */
export function lifeReport(input: { life: LifeView; sources: readonly SourceImpact[]; owners?: OwnersByToken }): LifeReport {
  const shares = computeShares(input.sources);
  const rows = shares.map(share => sourceRow(input.life, share.token_id, share.bps, input.owners ?? {}));
  const assigned = shares.reduce((sum, share) => sum + share.bps, 0);
  return { rows, unassignedPercent: rows.length > 0 && assigned < 10_000 ? formatPercent(10_000 - assigned) : null };
}

/** The actions a newly minted NPC can take: its life's career group only. */
export function npcActionMenu(group: CareerGroup): ActionOption[] {
  return NPC_ACTIONS[group].actions.map(actionOption);
}

export function lifeSpanLine(evidence: Pick<Evidence, "birth_year" | "death_year" | "death_age">): string {
  const year = (value: number) => (Number.isSafeInteger(value) && value !== 0 ? formatYear(value) : "?");
  const years = evidence.death_age === 1 ? "1 year" : `${evidence.death_age} years`;
  return `${year(evidence.birth_year)} – ${year(evidence.death_year)} · lived ${years}`;
}

export interface LedgerRow { label: string; value: string; chips?: string[]; detail?: string }

export interface MintRevealView {
  title: string;
  number: string;
  kindLabel: string;
  isFigure: boolean;
  figureId?: FigureId | null;
  /** Skill icon for a person of the city; null for figures. */
  emblem: string | null;
  rarityLabel: string;
  affectionText: string;
  href: string;
  lead: string;
  rows: LedgerRow[];
  links: { label: string; href: string }[];
}

export interface RevealDetails {
  evidence?: Pick<Evidence, "birth_year" | "death_year" | "death_age" | "sources">;
  actionId?: string | null;
  txHash?: string | null;
  evidenceUrl?: string | null;
}

const EMBLEM: Record<CareerGroup, string> = {
  letters: "literacy", military: "warfare", commerce: "reckoning", craft: "craft", sky: "astronomy", performance: "music",
};

/** The kept life as a ledger: what it is, how strongly and how often it acts, and where it is recorded. */
export function mintRevealView(result: MintResult, careerGroup: CareerGroup, details: RevealDetails = {}): MintRevealView {
  const isFigure = result.kind === "figure" && result.figure_id !== null;
  const power = (RARITY_POWER_BPS[result.rarity] ?? RARITY_POWER_BPS[0]) / 10000;
  const rows: LedgerRow[] = [
    { label: "Kind", value: KIND_LABEL[isFigure ? "figure" : "npc"] },
    { label: "Rarity", value: `${rarityLabel(result.rarity)} · influence ×${power}`, detail: "How strongly its deed changes the lives it reaches." },
    { label: "Affection", value: `${result.affection} / 100`, detail: "How often it is drawn into other players' stories." },
  ];
  if (details.actionId) rows.push({ label: "Deed", value: actionName(details.actionId), detail: actionDescription(details.actionId) });
  if (details.evidence) rows.push({ label: "Lived", value: lifeSpanLine(details.evidence) });
  const sources = details.evidence?.sources ?? [];
  if (sources.length > 0) {
    const shares = computeShares(sources);
    rows.push({ label: "Shaped by", value: shares.length === 1 ? "1 life" : `${shares.length} lives`, chips: shares.map(share => `#${share.token_id} · ${formatPercent(share.bps)}`), detail: "They share this life's mint fee and every resale." });
  }
  const links: { label: string; href: string }[] = [];
  if (details.txHash) links.push({ label: "Mint transaction", href: explorerUrl({ tx: details.txHash }) });
  if (details.evidenceUrl) links.push({ label: "Verified evidence", href: details.evidenceUrl });
  return {
    title: isFigure && result.figure_id ? figureTitle(result.figure_id) : GROUP_TITLE[careerGroup],
    number: `No. ${result.token_id}`,
    kindLabel: KIND_LABEL[isFigure ? "figure" : "npc"],
    isFigure,
    figureId: isFigure ? result.figure_id : null,
    emblem: isFigure ? null : EMBLEM[careerGroup],
    rarityLabel: rarityLabel(result.rarity),
    affectionText: `Affection ${result.affection} / 100`,
    href: chainHref({ kind: "token", tokenId: result.token_id }),
    lead: isFigure ? "Your life became one of the city's great names." : "Your life joins the people of the city. Others may meet you at their big decisions.",
    rows,
    links,
  };
}
