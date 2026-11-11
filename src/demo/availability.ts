/** Track D — Unavailable vs Locked. One resolver for engine and UI. */
import type { Availability, DemoDefinition } from "./contracts.ts";
import { UNAVAILABLE_REASON } from "./types.ts";

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
