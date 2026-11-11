import type { ActivityAvailability, Condition, LegacyAchievementDefinition, LifeState, WorldPack } from "../src/types.ts";
import { matchesCondition } from "../src/conditions.ts";
import { practiceBlockReason } from "./skill-tree.ts";
import { formatYear } from "../src/calendar.ts";

export interface RouteRequirement { text: string; met: boolean }
export interface LateRouteNode {
  achievement: LegacyAchievementDefinition;
  activity?: ActivityAvailability;
  state: "earned" | "ready" | "locked" | "assessed";
  requirements: RouteRequirement[];
  reason?: string;
}

/** Describe the same accepted-work and skill gates the engine evaluates. */
export function routeRequirements(condition: Condition | undefined, world: WorldPack, life: LifeState): RouteRequirement[] {
  if (!condition) return [];
  const amount = (rule: { op: string; value: number }): string => {
    const value = String(rule.value);
    return rule.op === "gte" ? `${value}+` : rule.op === "gt" ? `above ${value}` : rule.op === "lt" ? `below ${value}`
      : rule.op === "lte" ? `at most ${value}` : rule.op === "ne" ? `other than ${value}` : `exactly ${value}`;
  };
  const label = (rule: Condition): string => {
    switch (rule.type) {
      case "all": return rule.conditions.map(label).join(" + ");
      case "any": return rule.conditions.map(child => `(${label(child)})`).join(" or ");
      case "skill": return `${world.character?.skills[rule.skill]?.label ?? rule.skill} ${amount(rule)}`;
      case "accomplishment": return `${world.legacy?.achievements.find(item => item.id === rule.achievement)?.title ?? rule.achievement}${rule.minYears ? ` · completed ${rule.minYears}+ years ago` : " · completed"}`;
      case "cash": return `${amount(rule)} ${world.economy?.currency.short ?? "cash"} available`;
      case "job": return rule.job === null ? "No current occupation" : `Working as ${world.character?.jobs.find(job => job.id === rule.job)?.title ?? rule.job}`;
      case "asset": return `${world.economy?.assets.find(asset => asset.id === rule.asset)?.title ?? rule.asset}: ${amount(rule)}`;
      case "stat": return `${world.stats[rule.stat]?.label ?? rule.stat}: ${amount(rule)}`;
      case "year": return `${({ gte: "From", gt: "After", lt: "Before", lte: "Through", eq: "In", ne: "Outside" })[rule.op]} ${formatYear(rule.value)}`;
      case "demo": {
        const condition = rule.condition;
        if (condition.kind === "item") return `${amount(condition)} ${condition.item} in store`;
        if (condition.kind === "reputation") return `District reputation ${amount(condition)}`;
        return "Required household or year conditions";
      }
      case "age": return `Age ${amount(rule)}`;
      case "flag": return rule.flag.includes("final") ? rule.value === false ? "Final assessment unused" : "Final assessment used"
        : `${rule.flag.replaceAll("-", " ")}: ${rule.value ? "completed" : "not active"}`;
      case "not": return rule.condition.type === "accomplishment" ? "Not already completed" : `Without: ${label(rule.condition)}`;
      default: return "Other project requirements";
    }
  };
  if (condition.type === "all") return condition.conditions.flatMap(child => routeRequirements(child, world, life));
  return [{ text: label(condition), met: matchesCondition(condition, life) }];
}

/** Availability is supplied by the engine; projecting the tree never draws or acts. */
export function buildLateSkillRoutes(world: WorldPack, life: LifeState, activities: readonly ActivityAvailability[]) {
  const definitions = world.legacy?.achievements ?? [];
  return (world.legacy?.routes ?? []).filter(route => route.stages?.length).map(route => {
    const nodes = (ids: string[]): LateRouteNode[] => ids.map(id => {
        const achievement = definitions.find(item => item.id === id)!;
        const declared = world.character?.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === id)));
        const activity = activities.find(item => item.id === declared?.id) ?? (declared ? { ...declared, available: false } : undefined);
        const earned = life.accomplishments?.some(record => record.achievementId === id);
        const assessed = achievement.kind === "ultimate" && activity && life.character?.lastActivityAges[activity.id] !== undefined;
        const reason = activity ? practiceBlockReason(activity, life) : "Earned through a life event.";
        return {
          achievement, activity,
          state: earned ? "earned" : assessed ? "assessed" : activity && !reason ? "ready" : "locked",
          requirements: [
            ...(activity?.minAge ? [{ text: `Age ${activity.minAge}+`, met: life.age >= activity.minAge }] : []),
            ...routeRequirements(activity?.when, world, life),
          ],
          ...(reason ? { reason } : {}),
        } satisfies LateRouteNode;
      });
    return {
      ...route,
      discovered: route.skillIds.some(id => (life.character?.skills[id] ?? 0) >= 20) ||
        (life.accomplishments ?? []).some(record => record.routeId === route.id),
      entries: nodes(route.achievementIds.filter(id => definitions.find(item => item.id === id)?.kind === "ordinary" &&
        !route.stages!.some(stage => stage.achievementIds.includes(id)))),
      stages: route.stages!.map(stage => ({ ...stage, nodes: nodes(stage.achievementIds) })),
    };
  });
}
