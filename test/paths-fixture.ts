/** Minimal staged world with a two-district `paths` block, shared by the paths tests. */
import type { LifeEvent, WorldPack } from "../src/types.ts";
import type { FieldId, PathsDefinition, TierCounts } from "../src/paths/index.ts";
import { FIELD_IDS } from "../src/paths/index.ts";

const none: TierCounts = [0, 0, 0, 0];

export function profile(overrides: Partial<Record<FieldId, { demand: number; people: TierCounts }>> = {}) {
  return Object.fromEntries(FIELD_IDS.map(field => [field, overrides[field] ?? { demand: 0, people: none }])) as
    Record<FieldId, { demand: number; people: TierCounts }>;
}

export function pathsDefinition(): PathsDefinition {
  const field = (title: string, practitioner: string, skills: string[], jobs: string[] = []) =>
    ({ title, practitioner, skills, jobs, specializations: [] });
  return {
    fields: {
      farming: field("Farming", "farmer", ["farming"], ["farmhand"]),
      clothing: field("Clothing", "weaver", ["craft"]),
      ceramics: field("Ceramics", "potter", ["pottery", "craft"]),
      sculpture: field("Sculpture", "sculptor", ["craft"]),
      research: field("Research", "scholar", ["literacy"]),
      civic: field("Civic life", "official", ["literacy"]),
      trade: field("Trade", "merchant", ["reckoning"]),
      soldiering: field("Soldiering", "soldier", ["warfare"], ["soldier"]),
    },
    districts: {
      village: { title: "a Delta village", origins: ["farm"], profile: profile({ farming: { demand: 8, people: [2, 6, 2, 0] }, ceramics: { demand: 2, people: [1, 1, 0, 0] } }) },
      city: { title: "the city quarter", origins: ["workshop"], profile: profile({ ceramics: { demand: 6, people: [3, 6, 2, 1] }, research: { demand: 4, people: [1, 2, 1, 1] }, soldiering: { demand: 3, people: [1, 3, 1, 0] } }) },
    },
    pay: { minBps: 7000, maxBps: 16000, scarceBps: 12000, crowdedBps: 8500 },
    originAffinity: { workshop: { ceramics: 10 } },
  };
}

const chores: LifeEvent = {
  id: "chores", title: "Chores", text: "There is work to do.", trigger: { type: "random", weight: 1 },
  stages: ["childhood", "adulthood"], maxOccurrences: 99, cooldownYears: 1, mode: "automatic", effects: [], choices: [],
};

export function pathsWorld(extra: Partial<WorldPack> = {}): WorldPack {
  return {
    schemaVersion: 1, id: "paths-test", version: "1", title: "Paths", description: "Synthetic fixture.",
    startYear: -330, maxAge: 70,
    stats: { health: { label: "Health", min: 0, max: 100, initial: 70 } }, flags: {},
    origins: [
      { id: "farm", title: "A farm", text: "Born on a farm.", weight: 1, effects: [] },
      { id: "workshop", title: "A workshop", text: "Born beside a workshop.", weight: 1, effects: [] },
    ],
    character: {
      skills: Object.fromEntries(["farming", "craft", "pottery", "literacy", "reckoning", "warfare"].map(id => [id, { label: id, min: 0, max: 100, initial: 0 }])),
      jobs: [
        { id: "farmhand", title: "Farmhand", description: "Field work.", minAge: 12, yearlyEffects: [] },
        { id: "soldier", title: "Soldier", description: "Service.", minAge: 18, yearlyEffects: [] },
      ],
      partners: [{ id: "aina", name: "Aina", ageOffset: -2, occupation: "Weaver", description: "A neighbour." }],
      activities: [{ id: "rest", text: "Rest", category: "family", outcomes: [{ id: "rest-done", text: "You rest.", weight: 1, effects: [] }] }],
      childNames: ["Niko", "Mira"],
      deathCauseDescription: "Fictional fixture causes.",
      deathCauses: [{ id: "fever", title: "A fever", text: "An illness becomes fatal.", weight: 1 }],
    },
    yearlyEffects: [], eventPacing: { minChoiceGapYears: 1, maxChoiceGapYears: 1 },
    lifeStages: {
      stages: [{ id: "infancy", title: "Infancy", minAge: 0 }, { id: "childhood", title: "Childhood", minAge: 3 }, { id: "adulthood", title: "Adulthood", minAge: 16 }],
      scopes: { personal: "childhood", work: "childhood", community: "adulthood", household: "adulthood" },
    },
    paths: pathsDefinition(),
    events: [structuredClone(chores)],
    endings: [{ id: "complete", title: "Complete", text: "Done." }], defaultEnding: "complete",
    ...extra,
  };
}
