import type { Condition, WorldPack } from "../../src/types.ts";
import type { CapabilityNode } from "../../src/capabilities/types.ts";

export interface CapabilityPresentation {
  sources: string[];
  crossover: boolean;
  keySkill: boolean;
  titles: string[];
  milestone: boolean;
}
function requiresNode(condition: Condition | undefined, id: string): boolean {
  if (!condition) return false;
  if (condition.type === "capability") return condition.node === id;
  return condition.type === "all" && condition.conditions.some(child => requiresNode(child, id));
}

/** Presentation follows real graph dependencies and career gates, never reward-text guesses. */
export function capabilityPresentations(nodes: readonly CapabilityNode[], world: WorldPack): Map<string, CapabilityPresentation> {
  const byId = new Map(nodes.map(node => [node.id, node]));
  return new Map(nodes.map(node => {
    const sources = [...new Set(node.prerequisites.all.map(id => byId.get(id)?.branch).filter((branch): branch is string => Boolean(branch)))];
    const jobIds = new Set(world.character?.activities.filter(activity => requiresNode(activity.when, node.id))
      .flatMap(activity => activity.outcomes.flatMap(outcome => outcome.effects.flatMap(effect => effect.type === "job" && effect.job ? [effect.job] : []))));
    const titles = world.character?.jobs.filter(job => jobIds.has(job.id)).map(job => job.title) ?? [];
    const keySkill = nodes.filter(child => child.prerequisites.all.includes(node.id)).length > 1;
    return [node.id, { sources, crossover: sources.length > 1, keySkill, titles, milestone: titles.length > 0 || keySkill || node.depth === 10 }];
  }));
}

export function firstSentence(text: string): string {
  const end = text.search(/\.(?:\s|$)/);
  return end < 0 ? text : text.slice(0, end + 1);
}
