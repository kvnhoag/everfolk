import type { AristocratMetric, Choice, LifeState, RoyalMetric, WorldPack } from "../../src/types.ts";
import { applyStatDelta } from "../../src/progression.ts";
import { getOutcomeProbabilities } from "../../src/outcomes.ts";
import { isRoyalLife, ROYAL_METRICS } from "../../src/royalty.ts";
import { ARISTOCRAT_METRICS, isAristocratLife } from "../../src/aristocracy.ts";

export interface ChoiceStatImpact {
  id: string;
  label: string;
  /** Actual bounded stat deltas across the possible direct outcomes. */
  min: number;
  max: number;
  variable: boolean;
}

export interface ChoiceImpact {
  stats: ChoiceStatImpact[];
  /** Multiple weighted branches can differ in narrative or life facts too. */
  hasVariableOutcomes: boolean;
  /** At least one branch explicitly ends the life. */
  canEndLife: boolean;
  /** Direct authored fatal-outcome probability, separate from annual mortality. */
  deathRisk: number;
}

export interface AccomplishmentPreview {
  id: string;
  title: string;
  kind: "ordinary" | "prestige" | "ultimate";
  probability: number;
}

/** Only direct, not-yet-earned cards count; accepted outcomes remain the authority. */
export function getAccomplishmentPreviews(choice: Choice, life: LifeState, world: WorldPack): AccomplishmentPreview[] {
  const rewards = new Map<string, AccomplishmentPreview>();
  const earned = new Set(life.accomplishments?.map(record => record.achievementId));
  for (const { outcome, probability } of getOutcomeProbabilities(world, life, choice)) {
    const counted = new Set<string>();
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type !== "accomplishment" || counted.has(effect.achievement) || earned.has(effect.achievement)) continue;
      counted.add(effect.achievement);
      const achievement = world.legacy?.achievements.find(item => item.id === effect.achievement);
      if (!achievement || probability <= 0) continue;
      const preview = rewards.get(achievement.id) ?? { id: achievement.id, title: achievement.title, kind: achievement.kind, probability: 0 };
      preview.probability = Math.min(1, preview.probability + probability);
      rewards.set(achievement.id, preview);
    }
  }
  return [...rewards.values()];
}

/** Royal funds and standing are separate from personal cash and attributes. */
export function getRoyalImpact(choice: Choice, life: LifeState, world: WorldPack): ChoiceStatImpact[] {
  if (!world.royalty || !life.royalty || !isRoyalLife(world, life) || !choice.outcomes.length) return [];
  const initial = life.royalty;
  const definitions = world.royalty.metrics;
  const branches = choice.outcomes.map(outcome => {
    const metrics: Record<RoyalMetric, number> = { ...initial };
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "royal") metrics[effect.metric] = applyStatDelta(definitions[effect.metric], metrics[effect.metric], effect.delta);
    }
    return metrics;
  });
  return ROYAL_METRICS.flatMap(metric => {
    const deltas = branches.map(branch => branch[metric] - initial[metric]);
    const min = Math.min(...deltas), max = Math.max(...deltas);
    return min === 0 && max === 0 ? [] : [{ id: metric, label: definitions[metric].label, min, max, variable: min !== max }];
  });
}

/** Estate previews preserve sequential bounds, just like accepted estate effects. */
export function getAristocratImpact(choice: Choice, life: LifeState, world: WorldPack): ChoiceStatImpact[] {
  if (!world.aristocracy || !life.aristocracy || !isAristocratLife(world, life) || !choice.outcomes.length) return [];
  const initial = life.aristocracy, definitions = world.aristocracy.metrics;
  const branches = choice.outcomes.map(outcome => {
    const metrics: Record<AristocratMetric, number> = { ...initial };
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "aristocrat") metrics[effect.metric] = applyStatDelta(definitions[effect.metric], metrics[effect.metric], effect.delta);
    }
    return metrics;
  });
  return ARISTOCRAT_METRICS.flatMap(metric => {
    const deltas = branches.map(branch => branch[metric] - initial[metric]);
    const min = Math.min(...deltas), max = Math.max(...deltas);
    return min === 0 && max === 0 ? [] : [{ id: metric, label: definitions[metric].label, min, max, variable: min !== max }];
  });
}

/**
 * Preview only the choice's direct effects, without drawing an outcome or changing
 * the life. Annual rules, queued events and later mortality are separate actions.
 * Applying growth and bounds after each stat effect mirrors the engine's order.
 */
export function getChoiceImpact(choice: Choice, life: LifeState, world: WorldPack): ChoiceImpact {
  if (choice.outcomes.length === 0) throw new Error("This choice has no possible outcomes.");
  let canEndLife = false;
  const branches = choice.outcomes.map(outcome => {
    const stats = { ...life.stats };
    for (const effect of outcome.effects) {
      if (effect.type === "end") { canEndLife = true; break; }
      if (effect.type === "mastery" && effect.target === "stat") {
        stats[effect.id] = world.stats[effect.id].max;
        continue;
      }
      if (effect.type !== "stat") continue;
      const definition = world.stats[effect.stat];
      stats[effect.stat] = applyStatDelta(definition, stats[effect.stat], effect.delta);
    }
    return stats;
  });
  let fatalWeight = 0;
  for (const { outcome, probability } of getOutcomeProbabilities(world, life, choice)) {
    const ending = outcome.effects.find(effect => effect.type === "end");
    if (ending?.type === "end" && world.endings.find(item => item.id === ending.ending)?.kind === "death") fatalWeight += probability;
  }

  return {
    stats: Object.entries(world.stats).map(([id, definition]) => {
      let min = Infinity;
      let max = -Infinity;
      for (const branch of branches) {
        const change = branch[id] - life.stats[id];
        const delta = change === 0 ? 0 : change; // Do not expose a negative zero.
        min = Math.min(min, delta);
        max = Math.max(max, delta);
      }
      return { id, label: definition.label, min, max, variable: min !== max };
    }),
    hasVariableOutcomes: choice.outcomes.length > 1,
    canEndLife,
    deathRisk: fatalWeight,
  };
}

function signedDelta(value: number): string {
  // Remove binary floating-point noise while retaining small nonzero changes.
  const readable = Number(value.toPrecision(12));
  return readable === 0 ? "0" : `${readable > 0 ? "+" : ""}${readable}`;
}

/** A range is a set of possible effects, never a promised or average outcome. */
export function formatImpactDelta(min: number, max = min): string {
  return min === max ? signedDelta(min) : `${signedDelta(min)}…${signedDelta(max)}`;
}
