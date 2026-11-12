import type { Condition, WorldPack } from "../types.ts";
import type { FigurePathDefinition } from "./types.ts";

const ID = /^[a-z][a-z0-9-]*$/;
type Data = Record<string, unknown>;
/** Validate every authored reference and the work/achievement gates before a new pack can run. */
export function validateFigurePaths(input: unknown, world: WorldPack, condition: (value: unknown, path: string) => void): asserts input is FigurePathDefinition[] {
  function fail(path: string, message: string): never { throw new Error(`Invalid world at ${path}: ${message}`); }
  const obj = (value: unknown, path: string, fields: string[], required = fields): Data => {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail(path, "expected plain JSON object");
    for (const key of Reflect.ownKeys(value as object)) {
      if (typeof key !== "string" || !fields.includes(key)) fail(path, "unknown field");
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!("value" in descriptor) || !descriptor.enumerable) fail(path, "expected JSON data properties");
    }
    for (const key of required) if (!Object.hasOwn(value, key)) fail(path + "." + key, "missing required field");
    return value as Data;
  };
  const text = (value: unknown, path: string, maximum = 4000): string => {
    if (typeof value !== "string" || !value.trim() || value.length > maximum) fail(path, "expected bounded nonempty text");
    return value;
  };
  const id = (value: unknown, path: string) => { const result = text(value, path, 100); if (!ID.test(result)) fail(path, "expected lowercase id"); return result; };
  const integer = (value: unknown, path: string, low: number, high: number): number => {
    if (!Number.isSafeInteger(value) || (value as number) < low || (value as number) > high) fail(path, "expected bounded whole number");
    return value as number;
  };
  const array = (value: unknown, path: string, low: number, high: number): unknown[] => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < low || value.length > high) fail(path, "expected bounded JSON array");
    for (let i = 0; i < value.length; i++) { const descriptor = Object.getOwnPropertyDescriptor(value, String(i)); if (!descriptor || !("value" in descriptor)) fail(path, "expected dense data array"); }
    if (Reflect.ownKeys(value).length !== value.length + 1) fail(path, "array has extra properties");
    return value;
  };
  if (!world.capabilities || !world.legacy || !world.character || !world.vocations || !world.demo) fail("world.figurePaths", "figure paths require the deep-tree, achievement, work and household systems");
  const paths = array(input, "world.figurePaths", 1, 32), usedIds = new Set<string>(), usedAchievements = new Set<string>();
  const activities = new Map(world.character.activities.map(activity => [activity.id, activity]));
  const achievements = new Map(world.legacy.achievements.map(achievement => [achievement.id, achievement]));
  const mandatory = (rule: Condition | undefined, predicate: (rule: Condition) => boolean): boolean => {
    if (!rule) return false;
    if (rule.type === "all") return rule.conditions.some(child => mandatory(child, predicate));
    if (rule.type === "any") return rule.conditions.length > 0 && rule.conditions.every(child => mandatory(child, predicate));
    return predicate(rule);
  };
  const checksAchievement = (rule: Condition | undefined, achievement: string) => mandatory(rule, child => child.type === "accomplishment" && child.achievement === achievement);
  const source = (path: string, figureId: string, value: Data) => {
    const activityId = id(value.activityId, path + ".activityId"), achievementId = id(value.achievementId, path + ".achievementId");
    const activity = activities.get(activityId), achievement = achievements.get(achievementId);
    if (!activity || !achievement || achievement.routeId !== "figure-" + figureId) fail(path, "unknown or mismatched title source/achievement");
    if (!activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === achievementId))) fail(path, "title source does not award its achievement");
    if (usedAchievements.has(achievementId)) fail(path, "achievement is reused across figure-path stages");
    usedAchievements.add(achievementId);
    return { activity, achievement, activityId, achievementId };
  };
  for (let index = 0; index < paths.length; index++) {
    const path = `world.figurePaths[${index}]`, value = obj(paths[index], path, ["id", "name", "summary", "baseRank", "maximumRank", "sources", "encounter", "tradition", "stages", "capstone", "promotion"], ["id", "name", "summary", "baseRank", "maximumRank", "sources", "encounter", "stages", "capstone"]);
    const figureId = id(value.id, path + ".id"); if (usedIds.has(figureId)) fail(path, "duplicate figure"); usedIds.add(figureId);
    text(value.name, path + ".name", 200); text(value.summary, path + ".summary");
    if (!["Epic", "Legendary"].includes(value.baseRank as string) || !["Epic", "Legendary"].includes(value.maximumRank as string) || value.baseRank === "Legendary" && value.maximumRank !== "Legendary") fail(path, "invalid principal ranks");
    for (const [i, sourceValue] of array(value.sources, path + ".sources", 1, 12).entries()) {
      const sourcePath = `${path}.sources[${i}]`, item = obj(sourceValue, sourcePath, ["title", "url"]);
      text(item.title, sourcePath + ".title", 300); const urlText = text(item.url, sourcePath + ".url", 2000);
      try { const url = new URL(urlText); if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) fail(sourcePath, "expected public source URL"); } catch { fail(sourcePath, "invalid source URL"); }
    }
    const encounter = obj(value.encounter, path + ".encounter", ["access", "fromYear", "toYear", "location", "activityId", "achievementId"], ["fromYear", "location", "activityId", "achievementId"]);
    if (encounter.access !== undefined && encounter.access !== "direct" && encounter.access !== "circle") fail(path, "unknown encounter access mode");
    const firstYear = integer(encounter.fromYear, path, -10000, 10000), lastYear = encounter.toYear === undefined ? undefined : integer(encounter.toYear, path, firstYear, 10000);
    text(encounter.location, path, 500); const entry = source(path + ".encounter", figureId, encounter);
    if (!mandatory(entry.activity.when, rule => rule.type === "year" && rule.op === "gte" && rule.value >= firstYear) || lastYear !== undefined && !mandatory(entry.activity.when, rule => rule.type === "year" && rule.op === "lte" && rule.value <= lastYear)) fail(path + ".encounter", "encounter activity must enforce its historical window");
    if (value.tradition !== undefined) {
      const tradition = obj(value.tradition, path + ".tradition", ["fromYear", "location", "activityId", "achievementId"]);
      const from = integer(tradition.fromYear, path, lastYear === undefined ? firstYear : lastYear + 1, 10000); text(tradition.location, path, 500);
      const access = source(path + ".tradition", figureId, tradition);
      if (!mandatory(access.activity.when, rule => rule.type === "year" && rule.op === "gte" && rule.value >= from)) fail(path, "tradition access must enforce its start year");
    }
    let previous: string | undefined;
    const stageWork = new Set<string>();
    for (const [i, stageValue] of array(value.stages, path + ".stages", 3, 3).entries()) {
      const stagePath = `${path}.stages[${i}]`, stage = obj(stageValue, stagePath, ["rank", "title", "traditionTitle", "achievementId", "activityId", "workActionId", "workYears", "description", "requires"]);
      if (stage.rank !== ["Uncommon", "Rare", "Epic"][i]) fail(stagePath, "association stages must be Uncommon, Rare, Epic in order");
      for (const field of ["title", "traditionTitle", "description"]) text(stage[field], stagePath + "." + field);
      const workId = id(stage.workActionId, stagePath), years = integer(stage.workYears, stagePath, 1, 10), work = world.vocations.actions[workId];
      if (!work || work.kind !== "work" || work.practice || stageWork.has(workId)) fail(stagePath, "each contribution needs its own real project work");
      stageWork.add(workId); condition(stage.requires, stagePath + ".requires");
      const title = source(stagePath, figureId, stage), required = stage.requires as Condition;
      const workGate = (rule: Condition) => rule.type === "vocation" && rule.action === workId && rule.count >= years;
      if (!mandatory(required, workGate) || !mandatory(title.activity.when, workGate)) fail(stagePath, "title must require its completed project years");
      if (previous && (!checksAchievement(required, previous) || !checksAchievement(title.activity.when, previous))) fail(stagePath, "contribution titles must require the previous earned tier");
      previous = title.achievementId;
    }
    const capstone = obj(value.capstone, path + ".capstone", ["title", "achievementId", "activityId", "description", "requires", "attemptAchievementId"], ["title", "achievementId", "activityId", "description", "requires"]);
    text(capstone.title, path, 300); text(capstone.description, path); condition(capstone.requires, path + ".capstone.requires");
    const final = source(path + ".capstone", figureId, capstone), capRule = capstone.requires as Condition;
    if (capstone.attemptAchievementId !== undefined) {
      const attempt = source(path + ".capstone.attemptAchievementId", figureId, { activityId: capstone.activityId, achievementId: capstone.attemptAchievementId });
      if (!mandatory(final.activity.when, rule => rule.type === "not" && rule.condition.type === "accomplishment" && rule.condition.achievement === attempt.achievementId)) fail(path, "one-shot capstone must reject an already resolved attempt");
    }
    if (!checksAchievement(capRule, previous!) || !checksAchievement(final.activity.when, previous!)) fail(path, "figure-defining capstone requires the Epic contribution");
    const independentWork = (rule: Condition) => rule.type === "vocation" && !stageWork.has(rule.action) && rule.count >= 2 && world.vocations!.actions[rule.action]?.kind === "work";
    if (!mandatory(capRule, independentWork) || !mandatory(final.activity.when, independentWork)) fail(path, "special title needs separate sustained capstone work");
    if (value.promotion !== undefined) {
      const promotion = obj(value.promotion, path + ".promotion", ["achievementId", "activityId", "milestone", "title", "alternateHistory", "provisional", "attemptAchievementId"], ["achievementId", "activityId", "milestone", "title", "alternateHistory"]);
      const expected = ({ demetrius: "rhodes-captured", ptolemy: "ptolemaic-dynasty-founded", zeno: "stoic-school-established" } as Record<string, string>)[figureId];
      if (!expected || promotion.milestone !== expected || value.baseRank !== "Epic" || value.maximumRank !== "Legendary") fail(path, "promotion must match its figure's successful defining milestone");
      if (typeof promotion.alternateHistory !== "boolean" || figureId === "demetrius" && promotion.alternateHistory !== true || promotion.provisional !== undefined && typeof promotion.provisional !== "boolean") fail(path, "invalid promotion branch metadata");
      text(promotion.title, path, 300); const promoted = source(path + ".promotion", figureId, promotion);
      if (promotion.attemptAchievementId !== undefined) {
        const attempt = source(path + ".promotion.attemptAchievementId", figureId, { activityId: promotion.activityId, achievementId: promotion.attemptAchievementId });
        if (!mandatory(promoted.activity.when, rule => rule.type === "not" && rule.condition.type === "accomplishment" && rule.condition.achievement === attempt.achievementId)) fail(path, "one-shot promotion must reject an already resolved attempt");
      }
      if (promoted.activityId !== final.activityId && !checksAchievement(promoted.activity.when, final.achievementId)) fail(path, "promotion source must require its earned capstone");
      if (promoted.activityId === final.activityId && !promoted.activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === promoted.achievementId) && outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === final.achievementId))) fail(path, "successful milestone must be paired with actual capstone completion");
    } else if (value.baseRank !== value.maximumRank) fail(path, "conditional principal needs an explicit successful milestone");
  }
}
