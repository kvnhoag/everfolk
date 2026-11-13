import type { ActivityAvailability, Condition, LegacyAchievementDefinition, LifeState, WorldPack } from "../../src/types.ts";
import { matchesCondition } from "../../src/conditions.ts";
import { practiceBlockReason } from "./skill-tree.ts";
import { royalAudienceAllowed } from "../../src/royalty.ts";
import { formatMoney } from "./wealth.ts";

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
  const label = (rule: Condition): string => {
    switch (rule.type) {
      case "all": return rule.conditions.map(label).join(" + ");
      case "any": return rule.conditions.map(child => `(${label(child)})`).join(" or ");
      case "skill": return `${world.character?.skills[rule.skill]?.label ?? rule.skill} ${rule.value}${rule.op === "gte" ? "+" : ""}`;
      case "accomplishment": return `${world.legacy?.achievements.find(item => item.id === rule.achievement)?.title ?? rule.achievement}${rule.minYears ? ` · completed ${rule.minYears}+ years ago` : " · completed"}`;
      case "cash": return `${rule.value}+ ${world.economy?.currency.short ?? "cash"} available`;
      case "age": return `Age ${rule.value}${rule.op === "gte" ? "+" : ""}`;
      case "royal": {
        const comparison = { eq: "at", ne: "other than", gt: "above", gte: "at least", lt: "below", lte: "at most" }[rule.op];
        const value = rule.metric === "treasury" ? formatMoney(rule.value, world) : rule.value;
        return `${world.royalty?.metrics[rule.metric].label ?? rule.metric} ${comparison} ${value}`;
      }
      case "aristocrat": {
        const comparison = { eq: "at", ne: "other than", gt: "above", gte: "at least", lt: "below", lte: "at most" }[rule.op];
        const value = rule.metric === "treasury" ? formatMoney(rule.value, world) : rule.value;
        return `${world.aristocracy?.metrics[rule.metric].label ?? rule.metric} ${comparison} ${value}`;
      }
      case "flag": return `${rule.value === false ? "Without: " : ""}${world.flags[rule.flag]?.label ?? rule.flag}`;
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
  return (world.legacy?.routes ?? []).filter(route => route.stages?.length && route.achievementIds.some(id =>
    life.accomplishments?.some(record => record.achievementId === id) || world.character?.activities.some(activity => royalAudienceAllowed(world, life, activity.audience) && activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === id))))).map(route => {
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
          ].filter((requirement, index, requirements) => requirements.findIndex(item => item.text === requirement.text) === index),
          ...(reason ? { reason } : {}),
        } satisfies LateRouteNode;
      });
    return {
      ...route,
      discovered: route.skillIds.some(id => (life.character?.skills[id] ?? 0) >= 20) ||
        (life.accomplishments ?? []).some(record => record.routeId === route.id),
      entries: nodes(route.achievementIds.filter(id => definitions.some(item => item.id === id && !item.figure && item.kind === "ordinary") &&
        !route.stages!.some(stage => stage.achievementIds.includes(id)))),
      stages: route.stages!.map(stage => ({ ...stage, nodes: nodes(stage.achievementIds) })),
    };
  });
}
