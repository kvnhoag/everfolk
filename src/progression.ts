import type { Effect, LifeState, StatDefinition } from "./types.ts";

/** The strongest remembered interest changes only a positive training budget.
 * It is applied before the existing growth curve, never compounded or rounded. */
export function skillEffectDelta(effect: Extract<Effect, { type: "skill" }>, flags: LifeState["flags"]): number {
  if (effect.delta <= 0 || !effect.gainModifiers?.length) return effect.delta;
  let multiplier = 1;
  for (const modifier of effect.gainModifiers) if (flags[modifier.flag] === true) multiplier = Math.max(multiplier, modifier.multiplier);
  return effect.delta * Math.min(1.2, multiplier);
}

/**
 * Spend an authored positive reward across each reached growth band. Penalties
 * and definitions without a curve retain the original bounded arithmetic.
 * This pure helper is shared by simulation and previews.
 */
export function applyStatDelta(definition: StatDefinition, current: number, delta: number): number {
  const bound = (value: number): number => Math.max(definition.min, Math.min(definition.max, value));
  const curve = definition.gainCurve;
  if (!curve?.length || delta <= 0) return bound(current + delta);

  let value = bound(current);
  let budget = delta;
  // A bounded loop also handles gains too small to change a floating-point
  // value: they cannot trap progression in a repeated same-band calculation.
  for (let index = 0; index < curve.length && budget > 0 && value < definition.max; index++) {
    const band = curve[index];
    const ceiling = Math.min(definition.max, curve[index + 1]?.from ?? definition.max);
    if (value >= ceiling || value < band.from) continue;
    if (!Number.isFinite(band.multiplier) || band.multiplier <= 0) throw new Error("Growth multipliers must be finite and positive.");
    const cost = (ceiling - value) / band.multiplier;
    if (budget >= cost) {
      value = ceiling;
      budget -= cost;
    } else {
      value = Math.min(ceiling, value + budget * band.multiplier);
      budget = 0;
    }
  }
  return bound(value);
}
