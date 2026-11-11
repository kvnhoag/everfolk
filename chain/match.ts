import type { LifeState } from "../src/types.ts";
import { CAREER_GROUP_JOBS, FIGURES } from "./catalog/index.ts";
import type { FigureRequirement } from "./catalog/index.ts";
import type { CareerGroup, FigureId } from "./ids.ts";

const DEFAULT_CAREER_GROUP: CareerGroup = "performance";

/** job id → its group and its tier (index within the group's lowest-to-highest list). */
const JOB_TIERS = new Map(Object.entries(CAREER_GROUP_JOBS).flatMap(([group, jobs]) =>
  jobs.map((job, tier) => [job, { group: group as CareerGroup, tier }] as const)));

/**
 * Jobs the life held, each with the position it was last seen at. The engine journals an `activity`
 * entry named after the job for every year worked, and the job at death is on the character.
 */
function jobsHeld(state: LifeState): Map<string, number> {
  const held = new Map<string, number>();
  state.journal.forEach((entry, index) => {
    if (entry.type === "activity" && JOB_TIERS.has(entry.id)) held.set(entry.id, index);
  });
  const current = state.character?.jobId;
  if (current && JOB_TIERS.has(current)) held.set(current, state.journal.length);
  return held;
}

/** Highest-tier job ever held; equal tiers go to the job held most recently. */
export function peakJobOf(state: LifeState): string | null {
  let peak: { job: string; tier: number; seen: number } | null = null;
  for (const [job, seen] of jobsHeld(state)) {
    const tier = JOB_TIERS.get(job)!.tier;
    if (!peak || tier > peak.tier || (tier === peak.tier && seen > peak.seen)) peak = { job, tier, seen };
  }
  return peak?.job ?? null;
}

export function careerGroupOf(state: LifeState): CareerGroup {
  const peak = peakJobOf(state);
  return peak ? JOB_TIERS.get(peak)!.group : DEFAULT_CAREER_GROUP;
}

function meetsAll(values: Record<string, number>, minimums: Record<string, number> | undefined): boolean {
  return Object.entries(minimums ?? {}).every(([id, minimum]) => (values[id] ?? 0) >= minimum);
}

function qualifies(state: LifeState, figure: FigureRequirement, held: ReadonlyMap<string, number>): boolean {
  if (figure.origins?.length && !figure.origins.includes(state.originId)) return false;
  if (figure.jobsAny?.length && !figure.jobsAny.some(job => held.has(job))) return false;
  if (!meetsAll(state.character?.skills ?? {}, figure.minSkills)) return false;
  if (!meetsAll(state.stats, figure.minStats)) return false;
  if (!figure.accomplishmentsAny?.length) return true;
  const maxAge = figure.maxAgeAtAccomplishment ?? Number.POSITIVE_INFINITY;
  return (state.accomplishments ?? []).some(record =>
    figure.accomplishmentsAny!.includes(record.achievementId) && record.age <= maxAge);
}

/** Figures whose requirements the finished life meets, in catalog order. */
export function matchFigures(state: LifeState, figures: readonly FigureRequirement[] = FIGURES): FigureId[] {
  const held = jobsHeld(state);
  return figures.filter(figure => qualifies(state, figure, held)).map(figure => figure.figure);
}
