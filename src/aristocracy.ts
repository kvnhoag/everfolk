import type { AristocratMetric, Effect, LifeState, WorldPack } from "./types.ts";
import { applyStatDelta } from "./progression.ts";

export const ARISTOCRAT_METRICS: readonly AristocratMetric[] = ["treasury", "standing", "prosperity", "loyalty", "inheritance"];

/** Birth routes are enabled by the life's own immutable world revision. */
export function isAristocratLife(world: WorldPack, life: Pick<LifeState, "originId">): boolean {
  return world.aristocracy !== undefined && life.originId === world.aristocracy.originId;
}

export function isPrivilegedLife(world: WorldPack, life: Pick<LifeState, "originId">): boolean {
  return isAristocratLife(world, life) || world.royalty !== undefined && life.originId === world.royalty.originId;
}

/** Initialization adds no random draw and leaves earlier aristocrat births alone. */
export function initialAristocracy(world: WorldPack, life: Pick<LifeState, "originId">): LifeState["aristocracy"] {
  if (!isAristocratLife(world, life)) return;
  return Object.fromEntries(ARISTOCRAT_METRICS.map(metric => [metric, world.aristocracy!.metrics[metric].initial])) as Record<AristocratMetric, number>;
}

export function applyAristocratEffect(world: WorldPack, life: LifeState, effect: Extract<Effect, { type: "aristocrat" }>): void {
  if (!isAristocratLife(world, life) || !life.aristocracy) return;
  life.aristocracy[effect.metric] = applyStatDelta(world.aristocracy!.metrics[effect.metric], life.aristocracy[effect.metric], effect.delta);
}

export function progressAristocracy(world: WorldPack, life: LifeState): void {
  if (!isAristocratLife(world, life) || life.age < world.aristocracy!.minAge) return;
  for (const effect of world.aristocracy!.yearlyEffects) applyAristocratEffect(world, life, { type: "aristocrat", ...effect });
}
