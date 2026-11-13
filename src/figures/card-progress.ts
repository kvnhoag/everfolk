import { figureRosterEntry, type FigureCardRank, type FigureCardVariant, type FigureRosterEntry } from "../../chain/catalog/figure-roster.ts";
import type { RosterFigureId } from "../../chain/catalog/figure-ranks.ts";
import type { LifeState, WorldPack } from "../types.ts";
import type { FigureAssociationRank, FigureLegendaryContributionProgress, FigurePathProgress, FigurePathStageProgress } from "./types.ts";
import { getFigurePathProgress } from "./progress.ts";

export interface FigureCardTrait {
  id: string;
  label: string;
  description: string;
  earned: boolean;
  requirement: string;
}
export interface FigureCardVariantProgress extends FigureCardVariant {
  earned: boolean;
  requirements: string[];
}
export interface FigureCardProgress {
  roster: FigureRosterEntry;
  pathProgress: FigurePathProgress | null;
  traits: FigureCardTrait[];
  contributor: {
    rank: FigureAssociationRank | null;
    title: string | null;
    nextRank: FigureAssociationRank | null;
    ready: boolean;
    nextStage: FigurePathStageProgress | FigureLegendaryContributionProgress | null;
    requirements: string[];
  };
  variants: FigureCardVariantProgress[];
  earnedPrincipalRank: "Epic" | "Legendary" | null;
}
type TraitDescription = { label: string; description: string };
const expertise: Record<RosterFigureId, TraitDescription> = {
  alexander: { label: "Campaign Logistics", description: "Repeated qualified campaign work puts provisions and operational orders into practice." },
  aristotle: { label: "Independent Inquiry", description: "Reviewed natural-history work retains observations, objections and revisions." },
  euclid: { label: "Demonstrated Proof", description: "Independent checking repairs the steps of a geometrical demonstration." },
  lysippos: { label: "Bronze Practice", description: "Actual bronze studies and revised portrait proportions develop the workshop contribution." },
  pytheas: { label: "Navigation Records", description: "Repeated sky and navigation observations support a retained voyage account." },
  menander: { label: "Rehearsed Comedy", description: "Written scenes are rehearsed, revised and tried in performance." },
  demetrius: { label: "Tested Siege Works", description: "Constructed and revised siege components carry engineering responsibility." },
  theophrastus: { label: "Seasonal Comparison", description: "Plant records are compared and revised across actual work seasons." },
  zeno: { label: "Ethical Teaching", description: "Repeated discussion preserves reasoned responses to ethical objections." },
  ptolemy: { label: "Public Stewardship", description: "Funded public supply is delivered and its accounts are reconciled." },
  cleomenes: { label: "Audited Grain Supply", description: "Repeated grain delivery and revenue accounting establish a contribution beyond wealth." },
};
const defining: Record<RosterFigureId, TraitDescription> = {
  alexander: { label: "Decisive Command", description: "A successful decisive operation completes the separately assessed campaign legacy." },
  aristotle: { label: "Body of Inquiry", description: "A coherent body of independently checked inquiry and teaching has been accepted." },
  euclid: { label: "Deductive Collection", description: "A reviewed, connected collection of demonstrations and teaching constructions has been accepted." },
  lysippos: { label: "Monumental Bronze", description: "A separately documented and reviewed bronze programme applies sculptural mastery." },
  pytheas: { label: "Checked Voyage Account", description: "An independent navigation account and its teaching copies complete the Epic legacy." },
  menander: { label: "Dramatic Body of Work", description: "A separate cycle of revised and publicly staged comedies completes the dramatic legacy." },
  demetrius: { label: "Rhodes Captured", description: "The successful alternate-history capture, rather than siege machinery or peace, earns Legendary." },
  theophrastus: { label: "Botanical Account", description: "A reviewed comparative account across seasons completes the strict Epic legacy." },
  zeno: { label: "Independent Stoa", description: "A functioning independent Stoic school, rather than attendance or an announcement, earns the working Legendary outcome." },
  ptolemy: { label: "Dynasty Founded", description: "Independent hereditary government and a working succession settlement have actually been established." },
  cleomenes: { label: "Revenue Programme", description: "An audited programme of grain administration completes the Epic legacy." },
};

/**
 * Read-only card projection over an engine-replayed life. Rarity variants are previews;
 * trait display never mints a token, changes a saved rarity or substitutes for its capstone.
 */
export function getFigureCardProgress(world: WorldPack, life: LifeState, id: string): FigureCardProgress | undefined {
  const roster = figureRosterEntry(id);
  if (!roster) return;
  const definition = world.figurePaths?.find(path => path.id === id);
  const promotionVariant = roster.variants.find(variant => variant.requiredMilestone);
  const compatible = definition && definition.baseRank === roster.baseRank && definition.maximumRank === roster.maximumRank
    && (promotionVariant ? definition.promotion?.milestone === promotionVariant.requiredMilestone : !definition.promotion);
  const path = compatible ? getFigurePathProgress(world, definition, life) : null;
  const first = path?.stages[0], middle = path?.stages.at(-2), senior = path?.stages.at(-1);
  const cap = path?.definition.contributionTiering === "below-principal" ? path.principalRank === "Legendary" ? "Epic" : "Rare"
    : path?.stages.at(-1)?.definition.rank ?? (roster.baseRank === "Epic" ? "Rare" : "Epic");
  const specialist = expertise[roster.id], signature = defining[roster.id];
  const conditional = roster.baseRank !== roster.maximumRank;
  const stageTitle = (stage: FigurePathStageProgress | FigureLegendaryContributionProgress) => path?.encounterMode === "tradition" ? stage.definition.traditionTitle : stage.definition.title;
  const traits: FigureCardTrait[] = [
    {
      id: `${roster.id}-proven-contribution`, label: "Proven Contribution",
      description: "A useful first project has been completed with its learned prerequisites.",
      earned: first?.earned === true || first?.ready === true,
      requirement: first ? `Complete the qualified project years and meet the requirements for ${stageTitle(first)}.` : "Complete and record the first contribution in this figure's historical path.",
    },
    {
      id: `${roster.id}-specialist`, ...specialist, earned: middle?.earned === true || middle?.ready === true,
      requirement: middle ? `Complete the qualified project years and meet the requirements for ${stageTitle(middle)}.` : "Complete the qualified specialist contribution projects and record the title.",
    },
    {
      id: `${roster.id}-enduring-impact`, label: "Enduring Impact",
      description: "Sustained specialist work meets this route's senior-contribution requirements.",
      earned: senior?.earned === true || senior?.ready === true,
      requirement: senior ? `Complete the qualified project years and meet the requirements for ${stageTitle(senior)}; the current contribution cap is ${cap}.` : "Complete and record the senior contribution projects.",
    },
    {
      id: `${roster.id}-defining-legacy`, ...signature,
      earned: conditional ? path?.promoted === true : path?.capstone.earned === true,
      requirement: conditional ? roster.variants.find(variant => variant.rank === "Legendary")!.condition : `Earn the separately assessed ${roster.title} capstone.`,
    },
  ];
  const recognition = path?.legendaryContribution;
  const next = path?.nextStage ?? (path?.promoted && recognition && !recognition.earned ? recognition : null);
  const contributorRequirements = next
    ? next.ready ? [`Record ${stageTitle(next)} to receive the ${next.definition.rank} contribution title.`] : [...next.missingRequirements]
    : path ? [] : ["Begin this figure's historical contribution path."];
  const variants = roster.variants.map(variant => {
    const earned = path?.capstone.earned === true && (variant.rank === roster.baseRank || path.promoted);
    let requirements: string[];
    if (earned) requirements = [];
    else if (!path) requirements = [variant.condition];
    else if (path.capstone.failed) requirements = ["The defining attempt was unsuccessful. Its contribution titles remain, but it cannot be repeated."];
    else if (variant.requiredMilestone) {
      requirements = [
        ...(!path.capstone.earned ? path.capstone.missingRequirements : []),
        path.promotionOutcome === "failed" ? "The defining promotion attempt failed and cannot be repeated." : variant.condition,
      ];
    } else requirements = path.capstone.ready ? ["Record the accepted figure-defining capstone."] : [...path.capstone.missingRequirements];
    return { ...variant, earned, requirements };
  });
  return {
    roster, pathProgress: path, traits, variants,
    contributor: { rank: path?.associationRank ?? null, title: path?.associationTitle ?? null, nextRank: next?.definition.rank ?? (path ? null : "Common"), ready: next?.ready === true, nextStage: next ?? null, requirements: contributorRequirements },
    earnedPrincipalRank: path?.specialTitle?.rank ?? null,
  };
}

/** Preview selection is constrained to a figure's authored variants; it grants no progression. */
export function canPreviewFigureRank(id: string, rank: FigureCardRank): boolean {
  return figureRosterEntry(id)?.variants.some(variant => variant.rank === rank) === true;
}
