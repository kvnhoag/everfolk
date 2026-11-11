/** Lead — assembles `alexandria-demo-1` from the ranked world plus every track's content. Pure. */
import type { CharacterActivity, Condition, JobDefinition, LifeEvent, WorldPack } from "../types.ts";
import type { DemoContent } from "./content/types.ts";
import { DEMO_CONFIG, FUTURE_PATHS, PLAYABLE_JOBS, UNAVAILABLE_ROUTES, UNAVAILABLE_SKILLS } from "./config.ts";
import { DEMO_WORLD_VERSION, FARMING_SKILL } from "./types.ts";
import { FARMING_CONTENT } from "./content/farming.ts";
import { MARKET_CONTENT } from "./content/market.ts";
import { SERVICE_CONTENT } from "./content/service.ts";
import { WORKS_CONTENT } from "./content/works.ts";
import { AGENTS_CONTENT } from "./content/agents.ts";
import { WORLD_CONTENT } from "./content/world.ts";

/** Minimum the shared contract needs so the world validates before tracks add content. */
const BASE_CONTENT: DemoContent = {
  skills: {
    [FARMING_SKILL]: { label: "Farming", min: 0, max: 100, initial: 0, description: "Working land: ploughing, sowing, watering and harvest.", branch: "Land", tier: 1 },
  },
  jobs: [
    { id: "farmhand", title: "Farmhand", description: "Work the household plot under the head of the household.", minAge: 12, yearlyEffects: [{ type: "skill", skill: FARMING_SKILL, delta: 2 }] },
    { id: "tenant-farmer", title: "Tenant farmer", description: "Run the household plot, pay the rent and decide what to sell.", minAge: 16, requirements: { [FARMING_SKILL]: 15 }, yearlyEffects: [{ type: "skill", skill: FARMING_SKILL, delta: 2 }] },
    { id: "grain-dealer", title: "Grain dealer", description: "Buy, store and sell grain, including to the army under contract.", minAge: 20, requirements: { [FARMING_SKILL]: 30, reckoning: 25 }, yearlyEffects: [{ type: "skill", skill: "reckoning", delta: 1 }] },
  ],
};

export const DEMO_CONTENT: readonly DemoContent[] = [BASE_CONTENT, FARMING_CONTENT, MARKET_CONTENT, SERVICE_CONTENT, WORKS_CONTENT, AGENTS_CONTENT, WORLD_CONTENT];

function byId<T extends { id: string }>(items: readonly T[], replacements: readonly T[] | undefined, additions: readonly T[] | undefined, label: string): T[] {
  const replaced = items.map(item => replacements?.find(next => next.id === item.id) ?? item);
  for (const added of additions ?? []) if (replaced.some(item => item.id === added.id)) throw new Error(`Duplicate ${label}: ${added.id}`);
  return [...replaced, ...(additions ?? [])];
}

/** A condition no life can meet: used for references to origins this world no longer has. */
const NEVER: Condition = { type: "age", op: "lt", value: 0 };

/** Conditions naming a dropped origin can never hold, so they become `NEVER` (pure; returns a new tree). */
function retireOrigins<T>(value: T, kept: ReadonlySet<string>): T {
  if (Array.isArray(value)) return value.map(item => retireOrigins(item, kept)) as T;
  if (value === null || typeof value !== "object") return value;
  const data = value as Record<string, unknown>;
  if (data.type === "origin" && typeof data.origin === "string" && Object.keys(data).length === 2 && !kept.has(data.origin)) return { ...NEVER } as T;
  return Object.fromEntries(Object.entries(data).map(([key, item]) => [key, retireOrigins(item, kept)])) as T;
}

export function buildDemoWorld(ranked: WorldPack, content: readonly DemoContent[] = DEMO_CONTENT): WorldPack {
  const world = structuredClone(ranked) as WorldPack;
  const character = world.character!;
  let jobs: JobDefinition[] = character.jobs, activities: CharacterActivity[] = character.activities, events: LifeEvent[] = world.events;
  for (const part of content) {
    jobs = byId(jobs, part.replaceJobs, part.jobs, "job");
    activities = byId(activities, undefined, part.activities, "activity");
    events = byId(events.filter(event => !part.removeEvents?.includes(event.id)), part.replaceEvents, part.events, "event");
    Object.assign(character.skills, part.skills ?? {});
    if (part.origins) world.origins = structuredClone(part.origins);
    if (part.replaceInfluences && world.influences) world.influences = byId(world.influences, part.replaceInfluences, undefined, "influence");
    if (world.legacy) {
      world.legacy.routes = byId(world.legacy.routes, undefined, part.routes, "route");
      world.legacy.achievements = byId(world.legacy.achievements, undefined, part.achievements, "achievement");
    }
  }
  const origins = new Set(world.origins.map(origin => origin.id));
  character.jobs = jobs;
  character.activities = retireOrigins(activities, origins);
  world.events = retireOrigins(events, origins);
  if (world.influences) world.influences = retireOrigins(world.influences, origins);
  world.version = DEMO_WORLD_VERSION;
  world.title = `${ranked.title} — Grain and Service`;
  const unavailableRoutes = new Set(UNAVAILABLE_ROUTES);
  world.demo = {
    ...structuredClone(DEMO_CONFIG),
    availability: {
      playableJobs: [...PLAYABLE_JOBS],
      unavailableJobs: jobs.map(job => job.id).filter(id => !PLAYABLE_JOBS.includes(id)),
      unavailableActivities: activities.filter(activity => activity.outcomes.some(outcome => outcome.effects.some(effect =>
        effect.type === "skill" && effect.delta > 0 && UNAVAILABLE_SKILLS.includes(effect.skill)))).map(activity => activity.id),
      unavailableSkills: UNAVAILABLE_SKILLS.filter(id => id in character.skills),
      unavailableAccomplishments: (world.legacy?.achievements ?? []).filter(item => unavailableRoutes.has(item.routeId)).map(item => item.id),
      futurePaths: structuredClone(FUTURE_PATHS),
    },
  };
  return world;
}
