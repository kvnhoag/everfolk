import type { AccomplishmentRecord, Condition, LifeState, WorldPack } from "../types.ts";
import { figureContributionStageCopy, figureContributionTitleCopy } from "../../chain/catalog/figure-contribution-copy.ts";
import { matchesCondition } from "../conditions.ts";
import { formatYear, yearAtAge } from "../calendar.ts";
import type { FigurePathDefinition, FigurePathProgress, FigurePathStageProgress, FigureLegendaryContributionProgress } from "./types.ts";

function authoredRecord(world: WorldPack, life: LifeState, achievementId: string, activityId?: string): AccomplishmentRecord | undefined {
  const definition = world.legacy?.achievements.find(achievement => achievement.id === achievementId);
  if (!definition) return;
  return life.accomplishments?.find(record => {
    if (record.achievementId !== achievementId || record.routeId !== definition.routeId || activityId && record.sourceId !== activityId) return false;
    if (!Number.isSafeInteger(record.age) || record.age < 0 || record.age > life.age || record.year > life.year || record.year !== yearAtAge(life.birthYear ?? world.startYear, record.age)) return false;
    const activity = world.character?.activities.find(candidate => candidate.id === record.sourceId);
    if (activity) {
      return record.age >= (activity.minAge ?? 0) && activity.outcomes.some(outcome =>
        outcome.id === record.outcomeId && outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId));
    }
    const event = world.events.find(candidate => candidate.id === record.sourceId);
    return event?.choices.some(choice => choice.outcomes.some(outcome =>
      outcome.id === record.outcomeId && outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))) === true;
  });
}
const readable = (id: string) => id.replaceAll("-", " ");
function requirementText(world: WorldPack, condition: Condition): string {
  const comparison = (op: string) => ({ eq: "exactly", ne: "other than", gt: "above", gte: "at least", lt: "below", lte: "at most" }[op] ?? op);
  switch (condition.type) {
    case "capability": return `${condition.learned === false ? "Do not hold" : "Learn"} ${(world.deepCapabilities?.rules.find(rule => rule.id === condition.node)?.title ?? world.capabilities?.nodes.find(rule => rule.id === condition.node)?.title) ?? condition.node} (${condition.node})`;
    case "vocation": {
      const activity = world.character?.activities.find(activity => activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === condition.action)));
      return `Complete ${condition.count} work year${condition.count === 1 ? "" : "s"}: ${activity?.text ?? readable(condition.action)}`;
    }
    case "accomplishment": return `Earn ${figureContributionTitleCopy(world.legacy?.achievements.find(item => item.id === condition.achievement)?.title ?? readable(condition.achievement))}${condition.minYears ? ` and allow ${condition.minYears} year${condition.minYears === 1 ? "" : "s"} to pass` : ""}`;
    case "skill": return `${world.character?.skills[condition.skill]?.label ?? readable(condition.skill)} ${comparison(condition.op)} ${condition.value}`;
    case "stat": return `${world.stats[condition.stat]?.label ?? readable(condition.stat)} ${comparison(condition.op)} ${condition.value}`;
    case "cash": return `Cash ${comparison(condition.op)} ${condition.value} ${world.economy?.currency.short ?? ""}`.trim();
    case "debt": return `Debt ${comparison(condition.op)} ${condition.value} ${world.economy?.currency.short ?? ""}`.trim();
    case "age": return `Age ${comparison(condition.op)} ${condition.value}`;
    case "year": return `Year ${comparison(condition.op)} ${formatYear(condition.value)}`;
    case "job": return condition.job ? `Work as ${world.character?.jobs.find(job => job.id === condition.job)?.title ?? readable(condition.job)}` : "Leave the current occupation";
    case "origin": return `Begin in ${world.origins.find(origin => origin.id === condition.origin)?.title ?? readable(condition.origin)}`;
    case "flag": return `${readable(condition.flag)}: ${condition.value ? "required" : "must be absent"}`;
    case "all": return condition.conditions.map(child => requirementText(world, child)).join("; ");
    case "any": return `Meet one of: ${condition.conditions.map(child => requirementText(world, child)).join(" / ")}`;
    case "not": return `Must not meet: ${requirementText(world, condition.condition)}`;
    default: return `Meet the authored ${readable(condition.type)} requirement`;
  }
}
/** Explain unmet gates without changing state, drawing randomness or substituting score for evidence. */
export function figurePathMissingRequirements(world: WorldPack, life: LifeState, condition: Condition): string[] {
  if (matchesCondition(condition, life)) return [];
  if (condition.type === "all") return condition.conditions.flatMap(child => figurePathMissingRequirements(world, life, child));
  return [requirementText(world, condition)];
}
/**
 * Views consume an engine-replayed life. Provenance filtering rejects unrelated, future or
 * malformed records; it does not replace replay verification for an untrusted client payload.
 */
export function getFigurePathProgress(world: WorldPack, path: FigurePathDefinition, life: LifeState): FigurePathProgress {
  const direct = authoredRecord(world, life, path.encounter.achievementId, path.encounter.activityId);
  const validDirect = direct && direct.year >= path.encounter.fromYear && (path.encounter.toYear === undefined || direct.year <= path.encounter.toYear) ? direct : undefined;
  const tradition = path.tradition ? authoredRecord(world, life, path.tradition.achievementId, path.tradition.activityId) : undefined;
  const validTradition = tradition && path.tradition && tradition.year >= path.tradition.fromYear ? tradition : undefined;
  const encounterRecord = validDirect ?? validTradition;
  const encounterMode = validDirect ? path.encounter.access ?? "direct" : validTradition ? "tradition" : null;
  let previous = encounterRecord;
  const stages: FigurePathStageProgress[] = path.stages.map(authoredDefinition => {
    const definition = figureContributionStageCopy(authoredDefinition);
    const candidate = authoredRecord(world, life, definition.achievementId, definition.activityId);
    const record = candidate && previous && candidate.age >= previous.age ? candidate : undefined;
    const missingRequirements = figurePathMissingRequirements(world, life, definition.requires);
    if (!previous) missingRequirements.unshift("Complete the preceding encounter or contribution stage");
    const result: FigurePathStageProgress = { definition, earned: Boolean(record), ready: !record && Boolean(previous) && missingRequirements.length === 0, missingRequirements, ...(record ? { record } : {}) };
    previous = record;
    return result;
  });
  const candidate = authoredRecord(world, life, path.capstone.achievementId, path.capstone.activityId);
  const capstoneRecord = candidate && previous && candidate.age >= previous.age ? candidate : undefined;
  const capstoneAttemptRecord = path.capstone.attemptAchievementId ? authoredRecord(world, life, path.capstone.attemptAchievementId, path.capstone.activityId) : undefined;
  const capstoneAttempted = Boolean(capstoneRecord || capstoneAttemptRecord && previous && capstoneAttemptRecord.age >= previous.age);
  const promotionRecord = path.promotion ? authoredRecord(world, life, path.promotion.achievementId, path.promotion.activityId) : undefined;
  const promoted = Boolean(promotionRecord && capstoneRecord && promotionRecord.age >= capstoneRecord.age);
  const promotionAttempt = path.promotion?.attemptAchievementId ? authoredRecord(world, life, path.promotion.attemptAchievementId, path.promotion.activityId) : undefined;
  const promotionOutcome = promoted ? "succeeded" : promotionAttempt && capstoneRecord && promotionAttempt.age >= capstoneRecord.age ? "failed" : "not-attempted";
  const principalRank = promoted ? path.maximumRank : path.baseRank;
  const principalTitle = promoted && path.promotion ? path.promotion.title : path.name;
  const alternateHistory = Boolean(promoted && path.promotion?.alternateHistory);
  const missingRequirements = figurePathMissingRequirements(world, life, path.capstone.requires);
  if (!previous) missingRequirements.unshift("Complete all contribution stages");
  const capstone = { definition: path.capstone, attempted: capstoneAttempted, failed: capstoneAttempted && !capstoneRecord, earned: Boolean(capstoneRecord), ready: !capstoneAttempted && Boolean(previous) && missingRequirements.length === 0, missingRequirements, ...(capstoneRecord ? { record: capstoneRecord } : {}) };
  const earned = stages.filter(stage => stage.earned).at(-1);
  let legendaryContribution: FigureLegendaryContributionProgress | null = null;
  if (path.legendaryContribution) {
    const definition = path.legendaryContribution;
    const candidate = authoredRecord(world, life, definition.achievementId, definition.activityId);
    const senior = stages.at(-1)?.record;
    const orderedAfter = (record: AccomplishmentRecord, predecessor: AccomplishmentRecord) => record.age >= predecessor.age &&
      (life.accomplishments?.indexOf(record) ?? -1) > (life.accomplishments?.indexOf(predecessor) ?? -1);
    const record = candidate && senior && promoted && promotionRecord && orderedAfter(candidate, senior) && orderedAfter(candidate, promotionRecord) ? candidate : undefined;
    const missingRequirements = figurePathMissingRequirements(world, life, definition.requires);
    if (!senior) missingRequirements.unshift("Complete and record the senior Rare contribution");
    if (!promoted) missingRequirements.unshift("Earn this figure's successful Legendary outcome first");
    legendaryContribution = { definition, earned: Boolean(record), ready: !record && Boolean(senior) && promoted && missingRequirements.length === 0,
      missingRequirements: [...new Set(missingRequirements)], ...(record ? { record } : {}) };
  }
  const available = (activityId: string) => {
    const activity = world.character?.activities.find(item => item.id === activityId);
    return Boolean(activity && life.phase === "ready" && life.age >= (activity.minAge ?? 0) && matchesCondition(activity.when, life));
  };
  return {
    definition: path, encounterMode, ...(encounterRecord ? { encounterRecord } : {}),
    directAvailable: !encounterRecord && life.year >= path.encounter.fromYear && (path.encounter.toYear === undefined || life.year <= path.encounter.toYear) && available(path.encounter.activityId),
    traditionAvailable: !encounterRecord && Boolean(path.tradition && life.year >= path.tradition.fromYear && available(path.tradition.activityId)),
    principalRank, principalTitle, promoted, promotionOutcome, alternateHistory, provisionalPromotion: Boolean(path.promotion?.provisional),
    associationRank: legendaryContribution?.earned ? "Epic" : earned?.definition.rank ?? null,
    associationTitle: legendaryContribution?.earned ? encounterMode === "tradition" ? legendaryContribution.definition.traditionTitle : legendaryContribution.definition.title : earned ? encounterMode === "tradition" ? earned.definition.traditionTitle : earned.definition.title : null,
    stages, legendaryContribution, nextStage: stages.find(stage => !stage.earned) ?? null, capstone,
    specialTitle: capstoneRecord ? { title: promoted ? principalTitle : path.capstone.title, rank: principalRank, alternateHistory, record: capstoneRecord } : null,
  };
}
export function getFigurePaths(world: WorldPack, life: LifeState): FigurePathProgress[] {
  return (world.figurePaths ?? []).map(path => getFigurePathProgress(world, path, life));
}
