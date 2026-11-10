import type { Draw, FigurePick } from "../../chain/types.ts";
import { actionDescription, actionName, figureName, FIGURE_DEEDS, personForAction, rarityLabel, withOwner } from "./chain-copy.ts";

/** Pure view models for the ranked entry, the birth world and the draw beat (Task 18). */

export const EMPTY_WORLD_LINE = "No famous figures shape this world yet.";

/** Owner account by token id; missing owners are simply left out of the line. */
export type OwnersByToken = Readonly<Record<string, string>>;

/** "Euclid (alice.testnet) has opened a school." for each figure active in this life. */
export function bornIntoLines(picks: readonly FigurePick[], owners: OwnersByToken): string[] {
  if (picks.length === 0) return [EMPTY_WORLD_LINE];
  return picks.map(pick => {
    const deed = (FIGURE_DEEDS as Record<string, string>)[pick.action_id] ?? `is at work: ${actionName(pick.action_id).toLowerCase()}`;
    return `${withOwner(figureName(pick.figure_id), owners[pick.token_id])} ${deed}.`;
  });
}

export interface DrawBeatView {
  status: "waiting" | "nobody" | "drawn";
  title: string;
  detail: string;
  who: string;
  actionName: string;
  rarityLabel: string;
  tokenId: string | null;
}

/** The short beat at a key decision: waiting for the draw, nobody, or who stepped in and what they did. */
export function drawBeatView(draw: Draw | null, pending: boolean, owner?: string): DrawBeatView {
  const blank = { who: "", actionName: "", rarityLabel: "", tokenId: null };
  if (pending || !draw) return { status: "waiting", title: "Someone in the city noticed your choice…", detail: "Waiting to see who steps in.", ...blank };
  if (!draw.token_id) return { status: "nobody", title: "No one stepped in this time.", detail: "This choice is yours alone.", ...blank };
  return {
    status: "drawn",
    title: "Someone in the city noticed your choice.",
    detail: actionDescription(draw.action_id),
    who: withOwner(personForAction(draw.action_id), owner),
    actionName: actionName(draw.action_id),
    rarityLabel: rarityLabel(draw.rarity),
    tokenId: draw.token_id,
  };
}

/** `GET /api/ranked/config` (lane E2). */
export interface RankedConfig { contract_id: string; rpc_url: string; world_version: string; verifier_public_key: string }

const ACCOUNT_ID = /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

/** Returns null for anything that is not a usable config, so the entry stays closed. */
export function parseRankedConfig(value: unknown): RankedConfig | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const fields = ["contract_id", "rpc_url", "world_version", "verifier_public_key"] as const;
  if (!fields.every(field => typeof record[field] === "string" && (record[field] as string).length > 0)) return null;
  const config = Object.fromEntries(fields.map(field => [field, record[field] as string])) as unknown as RankedConfig;
  if (!ACCOUNT_ID.test(config.contract_id) || !/^https?:\/\//.test(config.rpc_url)) return null;
  return config;
}

export type RankedAvailability = "checking" | "available" | "unavailable";

export function rankedEntryView(availability: RankedAvailability): { disabled: boolean; note: string } {
  if (availability === "available") return { disabled: false, note: "A life recorded for keeps. Real players can shape it, and you can keep it." };
  if (availability === "checking") return { disabled: true, note: "Checking whether ranked lives are open…" };
  return { disabled: true, note: "Ranked lives are unavailable right now. Free play works as usual." };
}
