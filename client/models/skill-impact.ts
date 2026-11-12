import { vocationGains } from "../../src/vocations/view.ts";
import type { Choice, LifeState, WorldPack } from "../../src/types.ts";
import { applyStatDelta, skillEffectDelta } from "../../src/progression.ts";

/** Direct skill changes, in authored effect order, without random draws. */
export function getSkillImpact(choice: Pick<Choice, "outcomes">, life: LifeState, world: WorldPack): {
  id: string; label: string; min: number; max: number; variable: boolean;
}[] {
  if (!world.character || !life.character) return [];
  return Object.entries(world.character.skills).flatMap(([id, definition]) => {
    const initial = life.character!.skills[id] ?? definition.min;
    const changes = choice.outcomes.map(outcome => {
      let value = initial;
      const flags = { ...life.flags };
      for (const effect of outcome.effects) {
        if (effect.type === "end") break;
        if (effect.type === "flag") flags[effect.flag] = effect.value;
        if (effect.type === "skill" && effect.skill === id) value = applyStatDelta(definition, value, skillEffectDelta(effect, flags));
        if (effect.type === "vocation") value = applyStatDelta(definition, value, vocationGains(world, effect.action)[id] ?? 0);
        if (effect.type === "mastery" && effect.target === "skill" && effect.id === id) value = definition.max;
      }
      return value - initial;
    });
    const min = Math.min(...changes), max = Math.max(...changes);
    return min === 0 && max === 0 ? [] : [{ id, label: definition.label, min, max, variable: min !== max }];
  });
}
