import type { Choice, LifeState, WorldPack } from "../../src/types.ts";
import { severeEpisodeFatalityProbability } from "../../src/health.ts";
import { relationshipSupport } from "../../src/relationships.ts";
import { getOutcomeProbabilities } from "../../src/outcomes.ts";
import { applyStatDelta } from "../../src/progression.ts";

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

/** True when an active condition returned or lingered from an earlier age. */
export function hasReturningIllness(life: LifeState): boolean {
  return (life.health?.conditions ?? []).some(
    condition => condition.sinceAge < life.age || (condition.severe?.lingered ?? 0) > 0 || condition.lastProgressAge >= condition.sinceAge,
  );
}

/** Combined death probability across direct fatal outcomes, severe episodes, and critical ordinary conditions. */
export function choiceDeathRisk(life: LifeState, world: WorldPack, choice: Choice): { min: number; max: number; expected: number } | undefined {
  if (life.phase === "ended") return undefined;
  const severe = severeHealthRisk(life, world, choice);
  const branches = getOutcomeProbabilities(world, life, choice);
  const model = world.health;
  const conditions = life.health?.conditions ?? [];
  const nonSevere = conditions.filter(condition => !condition.severe);
  const support = relationshipSupport(world, life);
  const ageLoss = model?.declineBands.find(band => life.age >= band.minAge && life.age <= band.maxAge)?.healthLoss ?? 0;

  let directFatal = 0;
  const branchRisks = branches.map(({ outcome, probability }) => {
    const endEffect = outcome.effects.find(effect => effect.type === "end");
    if (endEffect?.type === "end") {
      const isDeath = world.endings.find(item => item.id === endEffect.ending)?.kind === "death";
      if (isDeath) directFatal += probability;
      return { risk: isDeath ? 1 : 0, probability };
    }
    let survival = 1;
    if (model && conditions.length > 0 && choice) {
      const isCareChoice = life.pendingEventId === model.careDecision
        && world.events.find(event => event.id === model.careDecision)?.choices.some(item => item.id === choice.id);
      const affectsHealthOrCare = isCareChoice || outcome.effects.some(effect =>
        effect.type === "care" || (effect.type === "stat" && effect.stat === model.stat));
      if (affectsHealthOrCare) {
        for (const episode of conditions.filter(condition => condition.severe)) {
          let care = episode.care;
          for (const effect of outcome.effects) {
            if (effect.type === "care") care = Math.min(1, care + effect.amount);
          }
          survival *= 1 - severeEpisodeFatalityProbability(world, life, episode, care, support);
        }
        if (nonSevere.length > 0) {
          let healthAfter = life.stats[model.stat];
          let careGain = 0;
          for (const effect of outcome.effects) {
            if (effect.type === "care") careGain += effect.amount;
            else if (effect.type === "stat" && effect.stat === model.stat) {
              healthAfter = applyStatDelta(world.stats[model.stat], healthAfter, effect.delta);
            } else if (effect.type === "mastery" && effect.target === "stat" && effect.id === model.stat) {
              healthAfter = world.stats[model.stat].max;
            }
          }
          const healthAtProgress = Math.max(world.stats[model.stat].min, healthAfter - ageLoss);
          if (nonSevere.length <= 4) {
            let ordinaryFatal = 0;
            const totalSubsets = 1 << nonSevere.length;
            for (let mask = 0; mask < totalSubsets; mask++) {
              let maskProb = 1;
              let totalLoss = 0;
              let minThreshold = Infinity;
              let anyProgressed = false;
              for (let i = 0; i < nonSevere.length; i++) {
                const active = nonSevere[i];
                const def = model.conditions.find(item => item.id === active.id);
                if (!def) continue;
                const care = Math.min(1, Math.max(0, active.care + careGain));
                const recovery = Math.min(1, Math.max(0, def.recoveryChance + care * def.careRecoveryBonus + support * model.supportRecoveryBonus));
                const fails = (mask & (1 << i)) !== 0;
                maskProb *= fails ? 1 - recovery : recovery;
                if (fails) {
                  anyProgressed = true;
                  totalLoss += def.healthLoss * (1 - care * 0.5 - support * 0.25);
                  minThreshold = Math.min(minThreshold, def.fatalHealthThreshold);
                }
              }
              if (anyProgressed && healthAtProgress - totalLoss <= minThreshold) ordinaryFatal += maskProb;
            }
            survival *= 1 - ordinaryFatal;
          }
        }
      }
    }
    return { risk: 1 - survival, probability };
  });

  const nonZero = branchRisks.some(item => item.risk > 0);
  if (!nonZero && (!severe || severe.max <= 0) && directFatal <= 0) return undefined;
  const risks = branchRisks.map(item => item.risk);
  const expected = branchRisks.reduce((sum, item) => sum + item.risk * item.probability, 0);
  const min = Math.min(...risks);
  const max = Math.max(...risks);
  return expected > 0 || max > 0 ? { min, max, expected } : undefined;
}

/** Plain danger text for upfront option cards, e.g. "Risk of death: 56%". */
export function formatDeathRiskText(risk: { min: number; max: number; expected: number } | undefined): string | null {
  if (!risk || risk.expected <= 0) return null;
  if (risk.expected < 0.0001) return "Risk of death: less than 0.01%";
  const decimals = risk.expected < 0.01 ? 2 : 1;
  return `Risk of death: ${Number((risk.expected * 100).toFixed(decimals))}%`;
}
