import { biographyFor } from "./figure-biographies.ts";
import { deepFreeze } from "./content.ts";

// Figure-linked paths are available in retained published worlds and the current lives-10 contribution release; ranked NFT rules remain separate.
/** Agreed roster policy, used by new free-play figure paths. Deployed/retained NFT minting is unchanged. */
export const FIGURE_RANK_POLICY = deepFreeze([
  { figureId: "alexander", baseRank: "Legendary", maximumRank: "Legendary" },
  { figureId: "aristotle", baseRank: "Legendary", maximumRank: "Legendary" },
  { figureId: "euclid", baseRank: "Legendary", maximumRank: "Legendary" },
  { figureId: "lysippos", baseRank: "Legendary", maximumRank: "Legendary" },
  { figureId: "pytheas", baseRank: "Epic", maximumRank: "Epic" },
  { figureId: "menander", baseRank: "Legendary", maximumRank: "Legendary" },
  { figureId: "demetrius", baseRank: "Epic", maximumRank: "Legendary", milestone: "rhodes-captured", alternateHistory: true },
  { figureId: "theophrastus", baseRank: "Epic", maximumRank: "Epic" },
  // Working interpretation of 'Zeno could push Legend': an established independent Stoic school.
  { figureId: "zeno", baseRank: "Epic", maximumRank: "Legendary", milestone: "stoic-school-established", provisionalGate: true },
  { figureId: "ptolemy", baseRank: "Epic", maximumRank: "Legendary", milestone: "ptolemaic-dynasty-founded" },
  { figureId: "cleomenes", baseRank: "Epic", maximumRank: "Epic" },
] as const);

export type RosterFigureId = typeof FIGURE_RANK_POLICY[number]["figureId"];
export type RosterRank = "Epic" | "Legendary";
type Resolution = "attempted" | "failed" | "succeeded";
/** These records must come from resolved, verified play; skills, dates and claimed intentions are insufficient. */
export type ResolvedFigureMilestone =
  | { figureId: "demetrius"; milestone: "rhodes-captured"; resolution: Resolution; branch: "historical" | "alternate-history" }
  | { figureId: "ptolemy"; milestone: "ptolemaic-dynasty-founded"; resolution: Resolution; branch: "historical" | "alternate-history" }
  | { figureId: "zeno"; milestone: "stoic-school-established"; resolution: Resolution; branch: "historical" | "alternate-history" };

/** Pure design resolver; it neither mints nor changes existing tokens. */
export function rosterRankFor(figureId: RosterFigureId, milestones: readonly ResolvedFigureMilestone[] = []): {
  rank: RosterRank; rarity: 3 | 4; title: string; alternateHistory: boolean;
} {
  const rule = FIGURE_RANK_POLICY.find(item => item.figureId === figureId);
  if (!rule) throw new Error(`Unknown roster figure: ${figureId}`);
  const promoted = "milestone" in rule && milestones.some(record =>
    record.figureId === figureId && record.milestone === rule.milestone && record.resolution === "succeeded"
      && (!("alternateHistory" in rule && rule.alternateHistory) || record.branch === "alternate-history"));
  const rank = promoted ? rule.maximumRank : rule.baseRank;
  let title = biographyFor(figureId).title;
  if (figureId === "ptolemy" && !promoted) title = "Ptolemy I Soter";
  if (figureId === "zeno" && !promoted) title = "Zeno of Citium";
  return { rank, rarity: rank === "Legendary" ? 4 : 3, title,
    alternateHistory: Boolean(promoted && "alternateHistory" in rule && rule.alternateHistory) };
}
