import type { Choice, LifeState, WorldPack } from "../src/types.ts";

export interface EarlyInfluence {
  routeId: string;
  flag: string;
  title: string;
  memory: string;
  skills: { id: string; label: string; multiplier: number }[];
  multiplier: number;
}
export interface EarlyInfluencePreview extends EarlyInfluence { possible: boolean; reinforced: boolean }

/** Read the actual training rules rather than promising a separate UI-only bonus. */
export function earlyInfluences(world: WorldPack): EarlyInfluence[] {
  if (!world.character) return [];
  return (world.legacy?.routes ?? []).flatMap(route => {
    const flag = route.earlyInterestFlag;
    if (!flag || !world.flags[flag]) return [];
    const gains = new Map<string, number>();
    for (const activity of world.character!.activities) for (const outcome of activity.outcomes) for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (activity.category !== "training" || effect.type !== "skill" || effect.delta <= 0) continue;
      for (const modifier of effect.gainModifiers ?? []) if (modifier.flag === flag) gains.set(effect.skill, Math.max(gains.get(effect.skill) ?? 1, modifier.multiplier));
    }
    const skills = Object.entries(world.character!.skills).flatMap(([id, skill]) => gains.has(id) ? [{ id, label: skill.label, multiplier: gains.get(id)! }] : []);
    return [{ routeId: route.id, flag, title: route.title, memory: world.flags[flag].label, skills, multiplier: Math.max(1, ...skills.map(skill => skill.multiplier)) }];
  });
}

export function activeEarlyInfluences(world: WorldPack, life: LifeState): EarlyInfluence[] {
  return earlyInfluences(world).filter(item => life.flags[item.flag]);
}

/** Preview only flags actually reached in an outcome; never spend RNG or change the life. */
export function previewEarlyInfluences(choice: Pick<Choice, "outcomes">, world: WorldPack, life: LifeState): EarlyInfluencePreview[] {
  return earlyInfluences(world).flatMap(item => {
    const count = choice.outcomes.filter(outcome => {
      let active = Boolean(life.flags[item.flag]), touched = false;
      for (const effect of outcome.effects) {
        if (effect.type === "end") return false;
        if (effect.type === "flag" && effect.flag === item.flag) { active = effect.value; touched = true; }
      }
      return touched && active;
    }).length;
    return count ? [{ ...item, possible: count < choice.outcomes.length, reinforced: Boolean(life.flags[item.flag]) }] : [];
  });
}

export function practiceBonus(multiplier: number): string {
  return `+${Number(((multiplier - 1) * 100).toFixed(1))}%`;
}
