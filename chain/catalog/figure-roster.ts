import { FIGURE_IDS, type FigureId } from "../ids.ts";
import { biographyFor, type FigureBiography } from "./figure-biographies.ts";
import { FIGURE_RANK_POLICY, type RosterFigureId, type RosterRank } from "./figure-ranks.ts";
import { deepFreeze } from "./content.ts";
import promotionRecords from "./figure-promotions.json" with { type: "json" };

export type FigureCardRank = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
export interface FigureCardVariant {
  rank: RosterRank;
  title: string;
  condition: string;
  /** The achieved promotion story; historical research remains in the base biography. */
  biography?: string;
  requiredMilestone?: "rhodes-captured" | "ptolemaic-dynasty-founded" | "stoic-school-established";
}
export interface FigureRosterEntry {
  id: RosterFigureId;
  name: string;
  title: string;
  biography: FigureBiography;
  baseRank: RosterRank;
  maximumRank: RosterRank;
  variants: readonly FigureCardVariant[];
  /** Only these four IDs may be sent to the retained contract. */
  legacyFigureId?: FigureId;
  art: { src: string; placeholder: boolean };
  archetype: string;
  tags: readonly string[];
}
const presentation: Record<RosterFigureId, { name: string; archetype: string; tags: string[] }> = {
  alexander: { name: "Alexander the Great", archetype: "Campaign Commander", tags: ["Command", "Logistics", "Decisive Operations"] },
  aristotle: { name: "Aristotle", archetype: "Peripatetic Inquirer", tags: ["Inquiry", "Independent Review", "Teaching"] },
  euclid: { name: "Euclid", archetype: "Geometer", tags: ["Demonstration", "Construction", "Deductive Order"] },
  lysippos: { name: "Lysippos", archetype: "Bronze Sculptor", tags: ["Bronze", "Portraiture", "Measured Form"] },
  pytheas: { name: "Pytheas of Massalia", archetype: "Navigator", tags: ["Voyage Records", "Astronomy", "Navigation"] },
  menander: { name: "Menander", archetype: "New Comedy Dramatist", tags: ["Writing", "Rehearsal", "Staged Comedy"] },
  demetrius: { name: "Demetrius the Besieger", archetype: "Siege Engineer", tags: ["Siege Works", "Engineering", "Rhodes"] },
  theophrastus: { name: "Theophrastus", archetype: "Botanical Investigator", tags: ["Plant Records", "Comparison", "Seasons"] },
  zeno: { name: "Zeno of Citium", archetype: "Stoic Teacher", tags: ["Ethics", "Public Teaching", "Independent School"] },
  ptolemy: { name: "Ptolemy I Soter", archetype: "Dynastic Statesman", tags: ["Administration", "Public Supply", "Succession"] },
  cleomenes: { name: "Cleomenes of Naucratis", archetype: "Revenue Administrator", tags: ["Grain Accounts", "Audit", "Supply"] },
};
const promotions = promotionRecords as Record<keyof typeof promotionRecords, Omit<FigureCardVariant, "rank">>;

/** Complete presentation roster. It does not expand contract IDs or rewrite a kept token's rarity. */
export const FIGURE_ROSTER: readonly FigureRosterEntry[] = deepFreeze(FIGURE_RANK_POLICY.map(policy => {
  const biography = biographyFor(policy.figureId), display = presentation[policy.figureId];
  const legacyFigureId = FIGURE_IDS.find(id => id === policy.figureId);
  const title = policy.figureId === "ptolemy" || policy.figureId === "zeno" ? display.name : biography.title;
  const variants: FigureCardVariant[] = [{
    rank: policy.baseRank, title,
    condition: "Complete the contribution ladder and earn this figure's separate defining capstone.",
  }];
  if (policy.figureId === "demetrius" || policy.figureId === "ptolemy" || policy.figureId === "zeno") variants.push({ rank: "Legendary", ...promotions[policy.figureId] });
  return {
    id: policy.figureId, name: display.name, title, biography, baseRank: policy.baseRank, maximumRank: policy.maximumRank,
    variants, ...(legacyFigureId ? { legacyFigureId } : {}),
    art: { src: legacyFigureId ? `/assets/figures/${policy.figureId}-front.png` : `/assets/figure-placeholders/${policy.figureId}.png`, placeholder: !legacyFigureId },
    archetype: display.archetype, tags: display.tags,
  };
}));

export function figureRosterEntry(id: string): FigureRosterEntry | undefined {
  return FIGURE_ROSTER.find(figure => figure.id === id);
}

/** Principal previews tell the selected variant story without changing historical records. */
export function figureCardBiography(figure: FigureRosterEntry, rank: FigureCardRank): string {
  return figure.variants.find(variant => variant.rank === rank)?.biography ?? figure.biography.biography;
}
