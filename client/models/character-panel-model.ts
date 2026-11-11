import type { ActivityAvailability, Condition, LifeState, WorldPack } from "../../src/types.ts";

export type CharacterSection = "career" | "skills" | "wealth" | "relationships" | "children";

export const CHARACTER_SECTIONS: { id: CharacterSection; label: string }[] = [
  { id: "career", label: "Career" },
  { id: "skills", label: "Skills" },
  { id: "wealth", label: "Wealth" },
  { id: "relationships", label: "Relationships" },
  { id: "children", label: "Family" },
];

/** Show life management when it becomes part of the character's life. */
export function visibleCharacterSections(life: LifeState, world: WorldPack, hasRelationships: boolean): typeof CHARACTER_SECTIONS {
  const firstJobAge = Math.min(...(world.character?.jobs.map(job => job.minAge) ?? []));
  return CHARACTER_SECTIONS.filter(section => {
    if (section.id === "career") return Boolean(life.character?.jobId) || life.age >= firstJobAge;
    if (section.id === "wealth") return Boolean(world.economy && life.economy);
    if (section.id === "relationships") return world.character?.extendedSocialRoles === true || life.age >= 18 && hasRelationships;
    if (section.id === "children") return Boolean(life.character?.family?.length) || life.age >= 12 || Boolean(life.character?.children.length);
    return true;
  });
}

function needsChildren(condition?: Condition): boolean {
  if (!condition) return false;
  if (condition.type === "children") return condition.op === "gt" && condition.value >= 0 || (condition.op === "gte" || condition.op === "eq") && condition.value > 0;
  if (condition.type === "all") return condition.conditions.some(needsChildren);
  if (condition.type === "any") return condition.conditions.length > 0 && condition.conditions.every(needsChildren);
  return false;
}

/** Family planning and childcare appear only once those actions are relevant. */
export function visibleFamilyActivities(life: LifeState, activities: readonly ActivityAvailability[]): ActivityAvailability[] {
  return activities.filter(activity => {
    if (activity.category !== "family" || life.age < (activity.minAge ?? 0)) return false;
    const arrangesCare = activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "care"));
    if (arrangesCare && !life.health?.conditions.length) return false;
    if (needsChildren(activity.when) && !life.character?.children.length) return false;
    const startsFamily = activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "child"));
    return !startsFamily || life.character?.relationshipStatus === "married";
  });
}

export function characterActivitySummary(life: LifeState, activities: readonly ActivityAvailability[]): string {
  if (life.phase === "choice") return "Make the pending choice to continue.";
  if (life.phase === "ended") return "Life ended.";
  const hasMinorAction = activities.some(activity => activity.usesYearlyActivity === false && activity.available);
  if (life.character?.lastActivityAge === life.age) return hasMinorAction ? "Yearly activity used. Other actions are still available." : "Action used. You can act again next year.";
  if (activities.some(activity => activity.usesYearlyActivity !== false && activity.available)) return "Choose one activity this year.";
  if (hasMinorAction) return "Other actions are available below.";
  const firstActivityAge = Math.min(...activities.filter(activity => activity.usesYearlyActivity !== false).map(activity => activity.minAge ?? 0));
  return life.age < firstActivityAge ? "Activities unlock as you grow." : "No activities available right now.";
}
