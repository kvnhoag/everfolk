import type { FigureCardRank, FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import type { FigurePathProgress } from "../../src/figures/types.ts";
import { orderedVariantRanks } from "./figure-card-carousel.ts";

const EPIC_CONTRIBUTION_RANKS: readonly FigureCardRank[] = ["Common", "Uncommon", "Rare"];
const LEGENDARY_CONTRIBUTION_RANKS: readonly FigureCardRank[] = ["Common", "Uncommon", "Rare", "Epic"];
const isContributionRank = (rank: FigureCardRank) => rank !== "Legendary";

/** Exact world metadata preserves retained grades; new catalogue previews stay below the principal. */
export function contributionCardRanks(figure: FigureRosterEntry, progress?: FigurePathProgress | null): FigureCardRank[] {
  if (progress) {
    const ranks: FigureCardRank[] = progress.stages.map(stage => stage.definition.rank);
    if (progress.definition.legendaryContribution && progress.promoted && progress.principalRank === "Legendary") ranks.push("Epic");
    const allowed = ranks.filter(rank => isContributionRank(rank) && !(progress.definition.contributionTiering === "below-principal" && progress.principalRank === "Epic" && rank === "Epic"));
    if (allowed.length) return orderedVariantRanks([...new Set(allowed)]);
  }
  return [...(figure.baseRank === "Epic" ? EPIC_CONTRIBUTION_RANKS : LEGENDARY_CONTRIBUTION_RANKS)];
}

/** A principal never accepts contributor options; context cannot manufacture Legendary contribution. */
export function figureCardRanks(figure: FigureRosterEntry, mode: "principal" | "contribution", context?: readonly FigureCardRank[]): FigureCardRank[] {
  if (mode === "principal") return orderedVariantRanks(figure.variants.map(variant => variant.rank));
  const allowed = context?.filter(isContributionRank);
  return allowed?.length ? orderedVariantRanks([...new Set(allowed)]) : contributionCardRanks(figure);
}
