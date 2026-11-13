import type { Choice, LifeState, WorldPack } from "../../src/types.ts";
import { severeEpisodeFatalityProbability } from "../../src/health.ts";
import { relationshipSupport } from "../../src/relationships.ts";
import { getOutcomeProbabilities } from "../../src/outcomes.ts";

/** Risk of recorded severe episodes only; ordinary illness and later choices are separate. */
export function severeHealthRisk(life: LifeState, world: WorldPack, choice?: Choice): { min: number; max: number; expected: number } | undefined {
  const episodes = life.health?.conditions.filter(condition => condition.severe);
  if (!world.health?.mortalityCalibration || !episodes?.length || life.phase === "ended") return;
  const isCareChoice = choice && life.pendingEventId === world.health.careDecision && world.events.find(event => event.id === world.health!.careDecision)?.choices.some(item => item.id === choice.id);
  if (choice && !isCareChoice && !choice.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "care"))) return;
  const support = relationshipSupport(world, life);
  const branches = choice ? getOutcomeProbabilities(world, life, choice) : [{ outcome: { effects: [] }, probability: 1 }];
  const probabilities = branches.map(({ outcome, probability }) => {
    if (outcome.effects.some(effect => effect.type === "end")) return { risk: 0, probability };
    let survival = 1;
    for (const episode of episodes) {
      let care = episode.care;
      for (const effect of outcome.effects) {
        if (effect.type === "end") break;
        if (effect.type === "care") care = Math.min(1, care + effect.amount);
      }
      survival *= 1 - severeEpisodeFatalityProbability(world, life, episode, care, support);
    }
    return { risk: 1 - survival, probability };
  });
  return { min: Math.min(...probabilities.map(branch => branch.risk)), max: Math.max(...probabilities.map(branch => branch.risk)), expected: probabilities.reduce((sum, branch) => sum + branch.risk * branch.probability, 0) };
}

export function formatHealthRisk(risk: { min: number; max: number }): string {
  const percent = (value: number) => Number((value * 100).toFixed(1));
  return risk.min === risk.max ? `${percent(risk.min)}%` : `${percent(risk.min)}-${percent(risk.max)}%`;
}
