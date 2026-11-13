import type { Effect, LifeAudience, LifeState, RoyalMetric, WorldPack } from "./types.ts";
import { applyStatDelta } from "./progression.ts";
import { isAristocratLife, isPrivilegedLife } from "./aristocracy.ts";

export const ROYAL_METRICS: readonly RoyalMetric[] = ["treasury", "influence", "stability", "security", "succession"];

/** The world opt-in preserves the rules of retained royal-origin saves. */
export function isRoyalLife(world: WorldPack, life: Pick<LifeState, "originId">): boolean {
  return world.royalty !== undefined && life.originId === world.royalty.originId;
}

export function royalAudienceAllowed(world: WorldPack, life: Pick<LifeState, "originId">, audience?: LifeAudience): boolean {
  if (audience === undefined) return true;
  if (audience === "royal") return isRoyalLife(world, life);
  if (audience === "aristocrat") return isAristocratLife(world, life);
  return !isPrivilegedLife(world, life);
}

/** No new random draws are consumed by royal bookkeeping. */
export function initialRoyalty(world: WorldPack, life: Pick<LifeState, "originId">): LifeState["royalty"] {
  if (!isRoyalLife(world, life)) return;
  return Object.fromEntries(ROYAL_METRICS.map(metric => [metric, world.royalty!.metrics[metric].initial])) as Record<RoyalMetric, number>;
}

export function applyRoyalEffect(world: WorldPack, life: LifeState, effect: Extract<Effect, { type: "royal" }>): void {
  if (!isRoyalLife(world, life) || !life.royalty) return;
  life.royalty[effect.metric] = applyStatDelta(world.royalty!.metrics[effect.metric], life.royalty[effect.metric], effect.delta);
}

export function progressRoyalty(world: WorldPack, life: LifeState): void {
  if (!isRoyalLife(world, life) || life.age < world.royalty!.minAge) return;
  for (const effect of world.royalty!.yearlyEffects) applyRoyalEffect(world, life, { type: "royal", ...effect });
}
