import type { LifeState, WorldPack } from "../../src/types.ts";

/** Keep small late gains visible without displaying an unearned threshold. */
export function formatSkillValue(value: number, boundary = Infinity): number {
  const digits = value >= 95 ? 3 : value >= 70 ? 2 : 1;
  const rounded = Number(value.toFixed(digits));
  const safe = value < boundary && rounded >= boundary
    ? Math.min(Math.floor(value * 1000) / 1000, (Math.ceil(boundary * 1000) - 1) / 1000)
    : rounded;
  return Object.is(safe, -0) ? 0 : safe;
}

export interface SkillGrowthBand {
  from: number;
  to: number;
  multiplier: number;
  percent: number;
}

export interface SkillGrowthProfile {
  multiplier: number;
  percent: number;
  bands: SkillGrowthBand[];
  hasRareMastery: boolean;
  atCap: boolean;
}

/** Derived from the retained world's real curve and exceptional reward effects. */
export function skillGrowthProfile(world: WorldPack, life: LifeState, skillId: string): SkillGrowthProfile | undefined {
  const definition = world.character?.skills[skillId];
  const value = life.character?.skills[skillId];
  const curve = definition?.gainCurve;
  if (!definition || value === undefined || !curve?.length) return;
  // Valid world packs already satisfy this. A partial draft should not advertise
  // a rate that the simulation could not use.
  if (curve.some((band, index) => !Number.isFinite(band.from) || !Number.isFinite(band.multiplier) || band.multiplier <= 0 ||
    band.from < definition.min || band.from >= definition.max || index > 0 && band.from <= curve[index - 1].from)) return;
  if (curve[0].from !== definition.min) return;
  const bands = curve.map((band, index) => ({ ...band, to: curve[index + 1]?.from ?? definition.max, percent: band.multiplier * 100 }));
  const clamped = Math.max(definition.min, Math.min(definition.max, value));
  const active = bands.find(band => clamped >= band.from && clamped < band.to) ?? bands.at(-1)!;
  const hasRareMastery = world.events.some(event => event.rarity === "rare" && event.choices.some(choice => choice.outcomes.some(outcome => {
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "mastery" && effect.target === "skill" && effect.id === skillId) return true;
    }
    return false;
  })));
  return { multiplier: active.multiplier, percent: active.percent, bands, hasRareMastery, atCap: value >= definition.max };
}
