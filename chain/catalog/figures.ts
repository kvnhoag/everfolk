import type { FigureId } from "../ids.ts";
import { deepFreeze } from "./content.ts";

/** What a ranked life must show at its end to be eligible to mint as a historical figure. */
export interface FigureRequirement {
  figure: FigureId;
  title: string;
  summary: string;
  supplyCap: number;
  origins?: string[];
  jobsAny?: string[];
  minSkills?: Record<string, number>;
  minStats?: Record<string, number>;
  accomplishmentsAny?: string[];
  maxAgeAtAccomplishment?: number;
}

export const FIGURE_SUPPLY_CAP = 5;

/**
 * Thresholds sit above every job's entry requirement and were calibrated on simulated
 * playthroughs (test/chain-figure-calibration.test.ts with scripts/ranked/path-policies.ts):
 * a deliberate run of the figure's path qualifies in about 20-30% of lives (Alexander: of
 * royal-household births), an unfocused life almost never. Skill gains slow
 * sharply above 70, so the 70-80 thresholds measure years of sustained practice.
 * Ids reference worlds/alexandria-0.33.0.json.
 */
const FIGURE_LIST: FigureRequirement[] = [
  {
    figure: "alexander",
    title: "Alexander, the conqueror",
    summary: "Born to royal kin, a commander who reached the rank of general and earned a recorded military distinction while still young.",
    supplyCap: FIGURE_SUPPLY_CAP,
    origins: ["royal-household"],
    jobsAny: ["general"],
    minSkills: { warfare: 70, oratory: 50 },
    accomplishmentsAny: ["military-first-work", "military-prestige"],
    maxAgeAtAccomplishment: 32,
  },
  {
    figure: "aristotle",
    title: "Aristotle, the philosopher",
    summary: "A widely read teacher of argument who tutored students or advised the court and left a remembered philosophical work.",
    supplyCap: FIGURE_SUPPLY_CAP,
    jobsAny: ["philosophy-tutor", "court-adviser"],
    minSkills: { literacy: 76, philosophy: 76, oratory: 50 },
    minStats: { knowledge: 60 },
    accomplishmentsAny: ["philosophy-first-work", "philosophy-prestige"],
  },
  {
    figure: "euclid",
    title: "Euclid, the geometer",
    summary: "A careful reckoner and reader who worked among tables and demonstrations and left a credited piece of scholarship.",
    supplyCap: FIGURE_SUPPLY_CAP,
    jobsAny: ["sky-table-calculator", "patron-supported-reader", "philosophy-tutor"],
    minSkills: { reckoning: 80, literacy: 70 },
    minStats: { knowledge: 60 },
    accomplishmentsAny: ["astronomy-calendar-first-work", "astronomy-calendar-prestige", "philosophy-prestige"],
  },
  {
    figure: "cleomenes",
    title: "Cleomenes of Naucratis, the grain administrator",
    summary: "A trader or court official with a head for accounts who grew rich and closed recorded commercial agreements.",
    supplyCap: FIGURE_SUPPLY_CAP,
    jobsAny: ["court-adviser", "shopkeeper"],
    minSkills: { reckoning: 80, literacy: 50 },
    minStats: { wealth: 90 },
    accomplishmentsAny: ["commerce-first-work", "commerce-prestige"],
  },
];

export const FIGURES: readonly FigureRequirement[] = deepFreeze(FIGURE_LIST);
