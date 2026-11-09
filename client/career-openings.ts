import type { Choice, Condition, WorldPack } from "../src/types.ts";

function needsFact(condition: Condition | undefined, flag: string): boolean {
  if (!condition) return false;
  if (condition.type === "flag") return condition.flag === flag && condition.value;
  if (condition.type === "all" || condition.type === "any") return condition.conditions.some(child => needsFact(child, flag));
  return false;
}

/** Explain where a recommendation leads using the actual acceptance rules. */
export function careerOpeningNotes(choice: Choice, world: WorldPack): string[] {
  if (!choice.opportunity || !world.character) return [];
  const successIds = new Set(choice.opportunity.outcomeIds);
  const facts = choice.outcomes.filter(outcome => successIds.has(outcome.id)).flatMap(outcome =>
    outcome.effects.flatMap(effect => effect.type === "flag" && effect.value ? [effect.flag] : []));
  const openings = new Set<string>(), applications = new Set<string>();
  for (const activity of world.character.activities) {
    const jobs = activity.outcomes.flatMap(outcome => outcome.effects.flatMap(effect => effect.type === "job" && effect.job ? [effect.job] : []));
    for (const jobId of jobs) {
      const title = world.character.jobs.find(job => job.id === jobId)?.title;
      if (!title) continue;
      if (facts.some(flag => needsFact(activity.when, flag))) openings.add(title);
      else if (activity.outcomes.some(outcome => outcome.weightModifiers?.some(modifier => facts.some(flag => needsFact(modifier.when, flag))))) applications.add(title);
    }
  }
  return [
    ...(openings.size ? [`Opens: ${[...openings].join(", ")}. Skills still required.`] : []),
    ...(applications.size ? [`Helps applications: ${[...applications].join(", ")}.`] : []),
  ];
}
