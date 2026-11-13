import type { Condition, WorldPack } from "../types.ts";
import type { FigureAssociationRank } from "./types.ts";

export const CONTRIBUTION_TIER_WORLD_VERSION = "alexandria-lives-7";
export const DEEP_CONTRIBUTION_TIER_WORLD_VERSION = "alexandria-figures-2";
const earned = (achievement: string): Condition => ({ type: "accomplishment", achievement });
const absent = (achievement: string): Condition => ({ type: "not", condition: earned(achievement) });

/** New rank policy is authored into a new revision; retained commands and IDs keep their own pack. */
export function buildContributionTierWorld(base: WorldPack): WorldPack {
  if (!["alexandria-lives-6", "alexandria-figures-1"].includes(base.version) || !base.figurePaths?.length ||
    !base.character || !base.legacy || base.figurePaths.some(path => path.contributionTiering !== undefined)) {
    throw new Error("Contribution tiering requires a retained lives-6 or figures-1 figure world.");
  }
  const world = structuredClone(base);
  world.version = base.version === "alexandria-lives-6" ? CONTRIBUTION_TIER_WORLD_VERSION : DEEP_CONTRIBUTION_TIER_WORLD_VERSION;
  world.description += " Contribution cards stay below the principal figure's earned tier; Epic recognition follows a successful Legendary outcome.";
  for (const path of world.figurePaths!) {
    path.contributionTiering = "below-principal";
    const ranks: readonly FigureAssociationRank[] = path.baseRank === "Epic" ? ["Common", "Uncommon", "Rare"] : ["Uncommon", "Rare", "Epic"];
    const route = world.legacy!.routes.find(route => route.id === `figure-${path.id}`);
    if (!route?.stages) throw new Error(`Missing retained legacy route for ${path.id}.`);
    for (let index = 0; index < path.stages.length; index++) {
      const stage = path.stages[index], oldRank = stage.rank, nextRank = ranks[index];
      stage.rank = nextRank;
      const claim = world.character!.activities.find(activity => activity.id === stage.activityId)!;
      claim.text = claim.text.replaceAll(`${oldRank} contribution`, `${nextRank} contribution`);
      for (const outcome of claim.outcomes) outcome.text = outcome.text.replaceAll(`${oldRank} contribution`, `${nextRank} contribution`);
      const legacyStage = route.stages.find(item => item.achievementIds.includes(stage.achievementId));
      if (legacyStage) legacyStage.title = `${nextRank} contribution`;
    }
    if (!path.promotion) continue;
    const senior = path.stages.at(-1)!;
    const achievementId = `fig-${path.id}-legendary-contribution`, activityId = `figure-${path.id}-claim-legendary-contribution`;
    const title = `Distinguished ${senior.title}`, traditionTitle = `Distinguished ${senior.traditionTitle}`;
    const description = `The senior contribution receives Epic recognition only after ${path.name}'s successful Legendary achievement. Earlier Rare contributions remain separately recorded.`;
    const requires: Condition = { type: "all", conditions: [earned(senior.achievementId), earned(path.promotion.achievementId), absent(achievementId)] };
    path.legendaryContribution = { rank: "Epic", title, traditionTitle, description, achievementId, activityId, requires };
    const sourceIds = [...(world.legacy!.achievements.find(item => item.id === senior.achievementId)?.sourceIds ?? [])];
    world.legacy!.achievements.push({ id: achievementId, routeId: route.id, title: traditionTitle, description, kind: "prestige",
      nameTemplate: `{name}: ${traditionTitle}`, people: [], evidence: "historically-inspired", sourceIds });
    route.achievementIds.push(achievementId);
    route.stages.push({ title: "Epic contribution after a Legendary outcome", achievementIds: [achievementId] });
    world.character!.activities.push({ id: activityId, text: `Record the Epic contribution after ${path.name}'s Legendary achievement`, category: "career", minAge: 18, usesYearlyActivity: false, when: requires,
      outcomes: [{ id: `${activityId}-accepted`, text: description, weight: 1, effects: [{ type: "accomplishment", achievement: achievementId }] }] });
  }
  return world;
}
