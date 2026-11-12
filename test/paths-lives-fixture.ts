/** The shipped free-play world with a test-only paths block (before the content task adds the real one). */
import type { LifeState, WorldPack } from "../src/types.ts";
import type { PathsDefinition } from "../src/paths/index.ts";
import { refreshNeeds } from "../src/paths/index.ts";
import shipped from "../worlds/demo/alexandria-lives-4.json" with { type: "json" };
import { profile } from "./paths-fixture.ts";

export function livesWithPaths(): WorldPack {
  const world = structuredClone(shipped) as unknown as WorldPack;
  if (world.paths) return world;
  const field = (title: string, practitioner: string, skills: string[], jobs: string[], specializations: string[]) =>
    ({ title, practitioner, skills, jobs, specializations });
  const paths: PathsDefinition = {
    fields: {
      farming: field("Farming", "farmer", ["farming"], ["farmhand"], ["Cultivation", "Resilience"]),
      clothing: field("Clothing", "weaver", ["craft"], ["tailor"], ["Clothing"]),
      ceramics: field("Ceramics", "potter", ["pottery", "craft"], ["potter"], ["Ceramics"]),
      sculpture: field("Sculpture", "sculptor", ["sculpture", "craft"], ["sculptor"], ["Sculpture"]),
      research: field("Research", "scholar", ["philosophy", "literacy"], ["philosophy-tutor"], ["Research"]),
      civic: field("Civic life", "official", ["oratory", "literacy"], ["clerk"], ["Civic practice"]),
      trade: field("Trade", "trader", ["reckoning"], ["shopkeeper"], ["Commercial planning"]),
      soldiering: field("Soldiering", "soldier", ["warfare"], ["soldier", "officer", "general"], []),
    },
    districts: {
      village: { title: "a Delta village", origins: world.origins.map(origin => origin.id), profile: profile({
        research: { demand: 4, people: [1, 4, 0, 0] }, soldiering: { demand: 6, people: [1, 6, 0, 0] }, trade: { demand: 4, people: [1, 4, 0, 0] },
      }) },
    },
    pay: { minBps: 7000, maxBps: 16000, scarceBps: 12000, crowdedBps: 8500 },
  };
  world.paths = paths;
  return world;
}

/** A mutable copy with the given people working in one field, needs refreshed. */
export function staffed(world: WorldPack, life: LifeState, field: keyof PathsDefinition["fields"], workers: number): LifeState {
  const copy = structuredClone(life) as LifeState;
  copy.paths!.people[field] = [0, workers, 0, 0];
  refreshNeeds(world, copy);
  return copy;
}
