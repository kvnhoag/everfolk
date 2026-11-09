import type { Choice, LifeState, Outcome, WorldPack } from "./types.ts";
import { matchesCondition } from "./conditions.ts";
import { relationshipOutcomeWeight } from "./relationships.ts";

/** Relative odds use the same current snapshot for play and all previews. */
export function outcomeWeight(world: WorldPack, state: LifeState, outcome: Outcome): number {
  let weight = relationshipOutcomeWeight(world, state, outcome);
  for (const modifier of outcome.weightModifiers ?? []) {
    if (matchesCondition(modifier.when, state)) weight *= modifier.multiplier;
  }
  return weight;
}

/** No draw, mutation or projected effect is performed while calculating odds. */
export function getOutcomeProbabilities(world: WorldPack, state: LifeState, choice: Choice): { outcome: Outcome; probability: number }[] {
  const weights = choice.outcomes.map(outcome => outcomeWeight(world, state, outcome));
  const maximum = Math.max(...weights);
  const scaled = weights.map(weight => weight / maximum);
  const total = scaled.reduce((sum, weight) => sum + weight, 0);
  return choice.outcomes.map((outcome, i) => ({ outcome, probability: scaled[i] / total }));
}

export function getOpportunityPreview(world: WorldPack, state: LifeState, choice: Choice): {
  label: string; probability: number; factors: { reason: string; multiplier: number }[];
} | undefined {
  if (!choice.opportunity) return;
  const successes = new Set(choice.opportunity.outcomeIds);
  const factors: { reason: string; multiplier: number }[] = [];
  for (const outcome of choice.outcomes) for (const modifier of outcome.weightModifiers ?? []) {
    if (!matchesCondition(modifier.when, state) || modifier.multiplier === 1) continue;
    // A heavier refusal has the opposite meaning to a heavier success.
    const multiplier = successes.has(outcome.id) ? modifier.multiplier : 1 / modifier.multiplier;
    if (!factors.some(factor => factor.reason === modifier.reason && factor.multiplier === multiplier)) factors.push({ reason: modifier.reason, multiplier });
  }
  return {
    label: choice.opportunity.label,
    probability: getOutcomeProbabilities(world, state, choice).reduce((sum, branch) => sum + (successes.has(branch.outcome.id) ? branch.probability : 0), 0),
    factors,
  };
}
