/** Track D — Unavailable vs Locked. One resolver for engine and UI. */
import type { LifeState, WorldPack } from "../types.ts";
import type { Availability, DemoDefinition } from "./contracts.ts";
import { UNAVAILABLE_REASON } from "./types.ts";
import { activityReason, characterEffectReason } from "../character.ts";
import { matchesCondition } from "../conditions.ts";

export type AvailabilityKind = "job" | "activity" | "skill" | "accomplishment";

/** Unavailable content in this world; `undefined` definition (old worlds) means everything is playable. */
export function availability(def: DemoDefinition | undefined, kind: AvailabilityKind, id: string): Availability {
  if (!def) return { status: "playable" };
  const list = kind === "job" ? def.availability.unavailableJobs : kind === "activity" ? def.availability.unavailableActivities
    : kind === "skill" ? def.availability.unavailableSkills : def.availability.unavailableAccomplishments;
  return list.includes(id) ? { status: "unavailable", reason: UNAVAILABLE_REASON } : { status: "playable" };
}
export function isUnavailable(def: DemoDefinition | undefined, kind: AvailabilityKind, id: string): boolean {
  return availability(def, kind, id).status === "unavailable";
}

function jobLock(world: WorldPack, life: LifeState, id: string): string | undefined {
  if (!world.character?.jobs.some(job => job.id === id)) return `This world has no job '${id}'.`;
  return characterEffectReason(world, life, { type: "job", job: id }, true);
}

function skillLock(world: WorldPack, life: LifeState, id: string): string | undefined {
  const skills = world.character?.skills;
  const definition = skills?.[id];
  if (!skills || !definition) return `This world has no skill '${id}'.`;
  const current = (skill: string): number => life.character?.skills[skill] ?? 0;
  const missing = Object.entries(definition.prerequisites ?? {}).filter(([skill, threshold]) => current(skill) < threshold);
  if (!missing.length) return undefined;
  return `Training ${definition.label} requires ${missing.map(([skill, threshold]) =>
    `${skills[skill]?.label ?? skill} ${threshold} (currently ${current(skill)})`).join("; ")}.`;
}

function activityLock(world: WorldPack, life: LifeState, id: string): string | undefined {
  const activity = world.character?.activities.find(item => item.id === id);
  if (!activity) return `This world has no activity '${id}'.`;
  return activityReason(world, life, activity, matchesCondition);
}

/**
 * Full status for one piece of content: Unavailable when this demo world excludes it, Locked (with the real
 * requirement text) when it is supported but this life does not meet its requirements yet, playable otherwise.
 * Read-only; never draws randomness. Old worlds (no `world.demo`) are never Unavailable.
 */
export function availabilityWithLock(world: WorldPack, life: LifeState, kind: AvailabilityKind, id: string): Availability {
  const excluded = availability(world.demo, kind, id);
  if (excluded.status === "unavailable") return excluded;
  const reason = kind === "job" ? jobLock(world, life, id) : kind === "skill" ? skillLock(world, life, id)
    : kind === "activity" ? activityLock(world, life, id) : undefined;
  return reason ? { status: "locked", reason } : { status: "playable" };
}
