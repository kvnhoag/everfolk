/** Free-play Alexandria: fields of work, districts and the people living in them. */
import type { Origin } from "../../types.ts";
import type { FieldId, PathsDefinition, TierCounts } from "../types.ts";

type Row = Record<FieldId, [demand: number, people: TierCounts]>;

/** Demand and starting people [learners, workers, masters, renowned] per district. */
const PROFILES: Record<string, { title: string; origins: string[]; rows: Row }> = {
  "delta-village": { title: "a Delta village", origins: ["tenant-farming-household", "delta-newcomers"], rows: {
    farming: [12, [4, 12, 3, 0]], clothing: [3, [1, 2, 0, 0]], ceramics: [2, [1, 1, 0, 0]], sculpture: [0, [0, 0, 0, 0]],
    research: [1, [0, 0, 0, 0]], civic: [2, [0, 1, 0, 0]], trade: [2, [0, 1, 0, 0]], soldiering: [1, [0, 1, 0, 0]] } },
  garrison: { title: "the garrison", origins: ["soldier-household"], rows: {
    farming: [4, [1, 4, 1, 0]], clothing: [1, [0, 1, 0, 0]], ceramics: [1, [0, 0, 0, 0]], sculpture: [0, [0, 0, 0, 0]],
    research: [0, [0, 0, 0, 0]], civic: [2, [0, 1, 0, 0]], trade: [2, [0, 2, 0, 0]], soldiering: [10, [3, 10, 3, 1]] } },
  estate: { title: "the estate lands", origins: ["estate-household"], rows: {
    farming: [10, [3, 10, 3, 1]], clothing: [2, [1, 2, 0, 0]], ceramics: [1, [0, 1, 0, 0]], sculpture: [1, [0, 0, 0, 0]],
    research: [1, [0, 1, 0, 0]], civic: [3, [1, 2, 0, 0]], trade: [3, [1, 2, 1, 0]], soldiering: [2, [0, 1, 0, 0]] } },
  "city-quarter": { title: "the city quarter", origins: ["artisan-household"], rows: {
    farming: [2, [0, 1, 0, 0]], clothing: [6, [3, 6, 2, 0]], ceramics: [6, [3, 6, 2, 1]], sculpture: [3, [1, 2, 1, 0]],
    research: [2, [1, 1, 0, 0]], civic: [4, [1, 3, 1, 0]], trade: [6, [2, 5, 2, 1]], soldiering: [3, [1, 2, 1, 0]] } },
  "court-quarter": { title: "the court quarter", origins: ["royal-household"], rows: {
    farming: [1, [0, 1, 0, 0]], clothing: [3, [1, 2, 1, 0]], ceramics: [2, [0, 1, 1, 0]], sculpture: [3, [1, 1, 1, 1]],
    // The Museum and the court draw famous scholars and officials: renowned people are met here, not elsewhere.
    research: [6, [3, 4, 2, 2]], civic: [6, [2, 5, 2, 2]], trade: [3, [1, 2, 1, 0]], soldiering: [4, [1, 3, 1, 1]] } },
};

const field = (title: string, practitioner: string, skills: string[], jobs: string[], specializations: string[]) =>
  ({ title, practitioner, skills, jobs, specializations });

export const ALEXANDRIA_PATHS: PathsDefinition = {
  fields: {
    farming: field("Farming", "farmer", ["farming", "reckoning"], ["farmhand", "tenant-farmer", "grain-dealer", "master-cultivator", "master-household-farmer"], ["Cultivation", "Resilience"]),
    clothing: field("Clothing", "weaver", ["craft"], ["tailor", "master-tailor"], ["Clothing"]),
    ceramics: field("Ceramics", "potter", ["pottery", "craft"], ["potter", "ceramic-decorator", "pottery-workshop-lead", "master-potter"], ["Ceramics"]),
    sculpture: field("Sculpture", "sculptor", ["sculpture", "carving", "craft"], ["wood-carver", "sculptor", "carving-workshop-lead", "sculpture-workshop-lead", "master-sculptor"], ["Sculpture"]),
    research: field("Research", "scholar", ["philosophy", "literacy", "astronomy"], ["philosophy-tutor", "scientist", "patron-supported-reader", "sky-table-calculator"], ["Research"]),
    civic: field("Civic life", "official", ["oratory", "literacy"], ["clerk", "copyist", "court-adviser", "politician"], ["Civic practice"]),
    trade: field("Trade", "trader", ["reckoning"], ["shopkeeper", "merchant", "trading-house-manager"], ["Commercial planning"]),
    soldiering: field("Soldiering", "soldier", ["warfare", "strength", "endurance"], ["soldier", "officer", "general"], ["Military practice", "Conditioning"]),
  },
  districts: Object.fromEntries(Object.entries(PROFILES).map(([id, { title, origins, rows }]) => [id, {
    title, origins,
    profile: Object.fromEntries(Object.entries(rows).map(([key, [demand, people]]) => [key, { demand, people }])) as PathsDefinition["districts"][string]["profile"],
  }])),
  pay: { minBps: 7000, maxBps: 16000, scarceBps: 12000, crowdedBps: 8500 },
  startingMaterials: { "artisan-household": { clay: 4, fuel: 2 }, "royal-household": { papyrus: 6, ink: 4 } },
  originAffinity: {
    "tenant-farming-household": { farming: 10 }, "soldier-household": { soldiering: 10 },
    "estate-household": { farming: 5, trade: 5 }, "artisan-household": { ceramics: 10, clothing: 5 },
    "royal-household": { research: 5, civic: 10 }, "delta-newcomers": { farming: 5 },
  },
};

/** Two birthplaces that make city and court lives possible. Stats follow the estate household's ranges. */
export const NEW_ORIGINS: Origin[] = [
  { id: "artisan-household", title: "A city artisan household", weight: 2, effects: [], evidence: "fictional",
    text: "You are born in a courtyard of potters and weavers in the city quarter near the harbour. Kilns smoke most mornings, clay dries by the door, and someone is always at a loom.",
    statRanges: { health: { min: 58, max: 80 }, knowledge: { min: 0, max: 3 }, wealth: { min: 15, max: 40 }, bonds: { min: 50, max: 78 } },
    sourceIds: ["household-late-period", "classical-rhakotis"] },
  { id: "royal-household", title: "A royal household", weight: 1, effects: [], evidence: "fictional",
    text: "You are born into a minor branch of Egypt's native royal family, on an estate near the court quarter. Scribes keep its accounts, tutors come to the house, and officials call on your elders.",
    statRanges: { health: { min: 64, max: 86 }, knowledge: { min: 2, max: 8 }, wealth: { min: 60, max: 90 }, bonds: { min: 45, max: 72 } },
    sourceIds: ["household-royal-kin", "classical-rhakotis"] },
];

/** Household goods for the new birthplaces, in the demo starting-resource format. */
export const NEW_ORIGIN_RESOURCES: Record<string, Record<string, { min: number; max: number }>> = {
  "artisan-household": { grain: { min: 150, max: 300 }, flax: { min: 5, max: 15 }, linen: { min: 0, max: 2 } },
  "royal-household": { grain: { min: 600, max: 900 }, silver: { min: 2, max: 4 }, gold: { min: 0, max: 1 }, linen: { min: 1, max: 3 } },
};
