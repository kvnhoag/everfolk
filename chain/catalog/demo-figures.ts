import type { FigureRequirement } from "./figures.ts";
import { FIGURES } from "./figures.ts";
import { RANKED_WORLD_VERSION, usesDemoCatalog, type FigureId } from "../ids.ts";
import { CONVOY_DISTINCTION } from "../../src/demo/types.ts";
import { deepFreeze } from "./content.ts";

/** A delivered army supply contract. Workflow 1 adds this accomplishment to the demo world. */
export const ARMY_SUPPLY_CONTRACT = "army-supply-contract";
/** Reputation a grain dealer must hold before Cleomenes is in reach. Starts at 20. */
export const CLEOMENES_MIN_REPUTATION = 40;

const ranked = (id: FigureId): FigureRequirement => {
  const figure = FIGURES.find(item => item.figure === id);
  if (!figure) throw new Error(`Missing ranked figure ${id}`);
  return figure;
};

const DEMO_FIGURE_LIST: FigureRequirement[] = [
  {
    figure: "alexander",
    title: ranked("alexander").title,
    summary: "A soldier who served, trained hard at warfare, and earned distinction leading a convoy while still young.",
    supplyCap: ranked("alexander").supplyCap,
    jobsAny: ["soldier"],
    minSkills: { warfare: 70 },
    accomplishmentsAny: [CONVOY_DISTINCTION],
    maxAgeAtAccomplishment: 32,
    stages: ["youth", "adulthood"],
    minAge: 14,
    maxAge: 32,
  },
  ranked("aristotle"),
  ranked("euclid"),
  {
    figure: "cleomenes",
    title: ranked("cleomenes").title,
    summary: "A grain dealer with a head for accounts who grew rich, kept a good name, and delivered a supply contract to the army.",
    supplyCap: ranked("cleomenes").supplyCap,
    jobsAny: ["grain-dealer"],
    minSkills: { reckoning: 80 },
    minStats: { wealth: 90 },
    accomplishmentsAny: [ARMY_SUPPLY_CONTRACT],
    minReputation: CLEOMENES_MIN_REPUTATION,
    stages: ["adulthood", "later-life"],
    minAge: 30,
  },
];

export const DEMO_FIGURES: readonly FigureRequirement[] = deepFreeze(DEMO_FIGURE_LIST);

/** Ranked-1 keeps its current standards. The demo world uses the soldier and grain-dealer standards. */
export function figuresForWorld(worldVersion: string): readonly FigureRequirement[] {
  return usesDemoCatalog(worldVersion) ? DEMO_FIGURES : FIGURES;
}

export function isRankedWorldVersion(worldVersion: string): boolean {
  return worldVersion === RANKED_WORLD_VERSION;
}
