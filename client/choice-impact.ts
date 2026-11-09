import type { Choice, LifeState, WorldPack } from "../src/types.ts";

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

/**
 * Preview only the choice's direct effects, without drawing an outcome or changing
 * the life. Annual rules, queued events and later mortality are separate actions.
 * Applying bounds after each stat effect mirrors the engine's effect order.
 */
export function getChoiceImpact(choice: Choice, life: LifeState, world: WorldPack): ChoiceImpact {
  if (choice.outcomes.length === 0) throw new Error("This choice has no possible outcomes.");
  let canEndLife = false;
  const branches = choice.outcomes.map(outcome => {
    const stats = { ...life.stats };
    for (const effect of outcome.effects) {
      if (effect.type === "end") { canEndLife = true; break; }
      if (effect.type !== "stat") continue;
      const definition = world.stats[effect.stat];
      stats[effect.stat] = Math.max(definition.min, Math.min(definition.max, stats[effect.stat] + effect.delta));
    }
    return stats;
  });
  const maximumWeight = Math.max(...choice.outcomes.map(outcome => outcome.weight));
  let totalWeight = 0, fatalWeight = 0;
  for (const outcome of choice.outcomes) {
    const scaled = outcome.weight / maximumWeight;
    totalWeight += scaled;
    const ending = outcome.effects.find(effect => effect.type === "end");
    if (ending?.type === "end" && world.endings.find(item => item.id === ending.ending)?.kind === "death") fatalWeight += scaled;
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
    deathRisk: fatalWeight / totalWeight,
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
