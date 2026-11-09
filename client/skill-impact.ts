import type { Choice, LifeState, WorldPack } from "../src/types.ts";
import { applyStatDelta } from "../src/progression.ts";

/** Direct skill changes, in authored effect order, without random draws. */
export function getSkillImpact(choice: Pick<Choice, "outcomes">, life: LifeState, world: WorldPack): {
  id: string; label: string; min: number; max: number; variable: boolean;
}[] {
  if (!world.character || !life.character) return [];
  return Object.entries(world.character.skills).flatMap(([id, definition]) => {
    const initial = life.character!.skills[id] ?? definition.min;
    const changes = choice.outcomes.map(outcome => {
      let value = initial;
      for (const effect of outcome.effects) {
        if (effect.type === "end") break;
        if (effect.type === "skill" && effect.skill === id) value = applyStatDelta(definition, value, effect.delta);
        if (effect.type === "mastery" && effect.target === "skill" && effect.id === id) value = definition.max;
      }
      return value - initial;
    });
    const min = Math.min(...changes), max = Math.max(...changes);
    return min === 0 && max === 0 ? [] : [{ id, label: definition.label, min, max, variable: min !== max }];
  });
}
