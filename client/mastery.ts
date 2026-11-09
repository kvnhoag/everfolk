import type { Choice, LifeState, WorldPack } from "../src/types.ts";
import { getOutcomeProbabilities } from "../src/outcomes.ts";
import { applyStatDelta } from "../src/progression.ts";

export interface MasteryPreview {
  target: "stat" | "skill";
  id: string;
  label: string;
  cap: number;
  /** Normalized direct probability that the mastered value finishes at its cap. */
  probability: number;
}

/** Cap labels accompany ordinary actual-delta previews; they promise no raised cap. */
export function getMasteryPreviews(choice: Choice, life: LifeState, world: WorldPack): MasteryPreview[] {
  const previews = new Map<string, MasteryPreview>();
  for (const { outcome, probability } of getOutcomeProbabilities(world, life, choice)) {
    const stats = { ...life.stats }, skills = { ...life.character?.skills };
    const candidates = new Map<string, Omit<MasteryPreview, "probability">>();
    for (const effect of outcome.effects) {
      if (effect.type === "end") break;
      if (effect.type === "stat") stats[effect.stat] = applyStatDelta(world.stats[effect.stat], stats[effect.stat], effect.delta);
      if (effect.type === "skill" && world.character) skills[effect.skill] = applyStatDelta(world.character.skills[effect.skill], skills[effect.skill], effect.delta);
      if (effect.type !== "mastery") continue;
      const definition = effect.target === "stat" ? world.stats[effect.id] : world.character?.skills[effect.id];
      const current = effect.target === "stat" ? life.stats[effect.id] : life.character?.skills[effect.id];
      if (!definition || current === undefined || current >= definition.max) continue;
      const key = `${effect.target}:${effect.id}`;
      if (effect.target === "stat") stats[effect.id] = definition.max;
      else skills[effect.id] = definition.max;
      candidates.set(key, { target: effect.target, id: effect.id, label: definition.label, cap: definition.max });
    }
    for (const [key, candidate] of candidates) {
      const final = candidate.target === "stat" ? stats[candidate.id] : skills[candidate.id];
      if (final !== candidate.cap) continue;
      const previous = previews.get(key);
      previews.set(key, { ...candidate, probability: (previous?.probability ?? 0) + probability });
    }
  }
  return [...previews.values()];
}
