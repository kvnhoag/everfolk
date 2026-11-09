import type { Effect, LifeState, StatRange, WorldPack } from "../src/types.ts";
import { getNetWorth } from "../src/economy.ts";

export interface BirthRollStat {
  id: string;
  label: string;
  value: number;
  range?: StatRange;
  currency?: string;
}

export type BirthRollPhase = "waiting" | "rolling" | "settled";
export const BIRTH_ROLL_DURATION_MS = 3_200;
export const BIRTH_ORIGIN_REVEAL_MS = 420;

/** A display model only: the simulation has already chosen all these values. */
export function getBirthRollStats(world: WorldPack, life: LifeState): BirthRollStat[] {
  const origin = world.origins.find(item => item.id === life.originId);
  const birthEffects: Effect[] = [...origin?.effects ?? []];
  for (const entry of life.journal) {
    if (entry.age !== 0 || entry.type !== "event") continue;
    const event = world.events.find(item => item.id === entry.id);
    if (event?.mode === "automatic") birthEffects.push(...event.effects ?? []);
  }
  return Object.entries(world.stats).map(([id, definition]) => {
    const value = life.stats[id];
    let range = origin?.statRanges?.[id] ?? definition.initialRange ?? { min: definition.initial, max: definition.initial };
    range = { ...range };
    for (const effect of birthEffects) {
      if (effect.type !== "stat" || effect.stat !== id) continue;
      const clamp = (number: number) => Math.max(definition.min, Math.min(definition.max, number));
      range = { min: clamp(range.min + effect.delta), max: clamp(range.max + effect.delta) };
    }
    // Later actions are not part of a birth draw. Never label their values with
    // an earlier range, including imported records or terminal birth outcomes.
    const isBirthValue = life.age === 0 && life.commands.length === 0 && value >= range.min && value <= range.max;
    if (world.economy?.stat === id && life.economy) {
      const moneyValue = getNetWorth(world, life);
      const moneyRange = { min: range.min * world.economy.unitsPerPoint, max: range.max * world.economy.unitsPerPoint };
      const hasDirectFinance = birthEffects.some(effect => effect.type === "cash" || effect.type === "debt" || effect.type === "asset");
      return { id, label: "Wealth", value: moneyValue, currency: world.economy.currency.short,
        ...(isBirthValue && !hasDirectFinance && moneyValue >= moneyRange.min && moneyValue <= moneyRange.max ? { range: moneyRange } : {}) };
    }
    return { id, label: definition.label, value, ...(isBirthValue ? { range } : {}) };
  });
}

export function getBirthRollFrame(elapsedMs: number, statCount: number): {
  originRevealed: boolean;
  complete: boolean;
  phases: BirthRollPhase[];
} {
  const elapsed = Math.max(0, elapsedMs);
  const complete = elapsed >= BIRTH_ROLL_DURATION_MS;
  const count = Math.max(0, Math.floor(statCount));
  return {
    originRevealed: elapsed >= BIRTH_ORIGIN_REVEAL_MS,
    complete,
    phases: Array.from({ length: count }, (_, index) => {
      const startsAt = BIRTH_ORIGIN_REVEAL_MS + index * Math.min(180, 2_000 / Math.max(1, count));
      const settlesAt = 900 + (index + 1) * (2_300 / Math.max(1, count));
      return elapsed >= settlesAt ? "settled" : elapsed >= startsAt ? "rolling" : "waiting";
    }),
  };
}

/** Independent cosmetic samples; this never reads or advances life.rngState. */
export function getCosmeticBirthValue(stat: BirthRollStat, seed: string, frame: number): number {
  const range = stat.range;
  if (!range || !Number.isSafeInteger(range.min) || !Number.isSafeInteger(range.max) || range.min >= range.max) return stat.value;
  const key = `${seed}:birth-display:${stat.id}:${Math.max(0, Math.floor(frame))}`;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) hash = Math.imul(hash ^ key.charCodeAt(index), 16777619);
  const span = BigInt(range.max) - BigInt(range.min) + 1n;
  return Number(BigInt(range.min) + BigInt(hash >>> 0) % span);
}
