import type { ActivityAvailability, LifeState, WorldPack } from "../../src/types.ts";
import { isRoyalLife } from "../../src/royalty.ts";
import { isAristocratLife } from "../../src/aristocracy.ts";
import { buildLateSkillRoutes } from "./late-skill-routes.ts";

const royalRoutes = new Set(["royal-diplomacy", "royal-guardianship", "royal-stewardship"]);
const estateRoutes = new Set(["estate-restoration", "estate-patronage", "estate-inheritance"]);

export function isHouseholdTitleRoute(route: { id: string }): boolean {
  return royalRoutes.has(route.id) || estateRoutes.has(route.id);
}

/** Class projects appear with their earned-work path instead of twice in the council. */
export function isHouseholdTitleProject(activity: { id: string }): boolean {
  return activity.id.startsWith("household-title-");
}

/** A pure projection of existing routes and accepted accomplishment records. */
export function buildHouseholdTitlePaths(world: WorldPack, life: LifeState, activities: readonly ActivityAvailability[]) {
  const ids = isRoyalLife(world, life) ? royalRoutes : isAristocratLife(world, life) ? estateRoutes : undefined;
  if (!ids) return [];
  return buildLateSkillRoutes(world, life, activities).filter(route => ids.has(route.id)).map(route => {
    const steps = [...new Map([...route.entries, ...route.stages.flatMap(stage => stage.nodes)]
      .map(node => [node.achievement.id, node])).values()];
    return {
      ...route,
      steps,
      completed: steps.filter(node => node.state === "earned").length,
      next: steps.find(node => node.state !== "earned"),
      titleNode: steps.find(node => node.achievement.kind === "ultimate"),
    };
  });
}

export function householdProjectCooldown(activity: ActivityAvailability, life: LifeState): string {
  const years = activity.cooldownYears ?? 1;
  const lastAge = life.character?.lastActivityAges[activity.id];
  const remaining = lastAge === undefined ? 0 : Math.max(0, years - (life.age - lastAge));
  return `${activity.usesYearlyActivity === false ? "Does not use" : "Uses"} this year’s major activity. Project cooldown: ${years} ${years === 1 ? "year" : "years"}.${remaining ? ` Next attempt in ${remaining} ${remaining === 1 ? "year" : "years"}.` : ""}`;
}
