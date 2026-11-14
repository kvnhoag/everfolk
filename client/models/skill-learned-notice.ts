import type { LifeState, WorldPack } from "../../src/types.ts";
import { CAPABILITY_NODES } from "./capability-layout.ts";

export interface SkillLearnedNotice { key: string; id: string; title: string; age: number; year: number }
export interface SkillTreeFocus { id: string; seq: number }

/** Skills the player learned in the current year, for the "Skill learned" notification. */
export function learnedThisYear(life: LifeState, world: WorldPack): SkillLearnedNotice[] {
  if (world.deepCapabilities) {
    const titles = new Map(world.deepCapabilities.rules.map(rule => [rule.id, rule.title]));
    return Object.entries(life.deepCapabilities?.learned ?? {})
      .filter(([, when]) => when.year === life.year)
      .map(([id, when]) => ({ key: `skill:${life.seed}:deep:${id}`, id, title: titles.get(id) ?? id, age: life.age, year: when.year }));
  }
  const learned = life.capabilities?.learned ?? {};
  const nodes = (world.capabilities?.version ?? 0) >= 2 ? world.capabilities!.nodes : CAPABILITY_NODES;
  const titles = new Map(nodes.map(node => [node.id, node.title]));
  return Object.entries(learned)
    .filter(([, when]) => when.age === life.age)
    .map(([id, when]) => ({ key: `skill:${life.seed}:${id}`, id, title: titles.get(id) ?? id, age: when.age, year: when.year }));
}
