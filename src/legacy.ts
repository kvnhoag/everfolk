import { getFigurePathProgress } from "./figures/progress.ts";
import type { AccomplishmentRecord, LegacyRouteProgress, LifeState, WorldPack } from "./types.ts";

/** Reading progression never changes a life or consumes its random stream. */
export function getAccomplishments(world: WorldPack, state: LifeState): readonly AccomplishmentRecord[] {
  return world.legacy ? state.accomplishments ?? [] : [];
}

export function getLegacyRoutes(world: WorldPack, state: LifeState): readonly LegacyRouteProgress[] {
  const records = getAccomplishments(world, state);
  return (world.legacy?.routes ?? []).map(route => {
    const earned = records.filter(record => record.routeId === route.id);
    const achieved = (id: string) => earned.some(record => record.achievementId === id);
    const definitions = route.achievementIds.map(id => world.legacy!.achievements.find(item => item.id === id)!);
    const firstWork = definitions.filter(item => !item.figure && item.kind === "ordinary" && !route.stages?.some(stage => stage.achievementIds.includes(item.id)));
    const assessed = (id: string) => definitions.find(item => item.id === id)?.kind === "ultimate" &&
      world.character?.activities.some(activity => state.character?.lastActivityAges[activity.id] !== undefined &&
        activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "accomplishment" && effect.achievement === id)));
    const nextId = route.stages && firstWork.some(item => achieved(item.id))
      ? route.stages.find(stage => !stage.achievementIds.some(achieved) && !stage.achievementIds.every(assessed))?.achievementIds[0]
      : undefined;
    const next = route.stages
      ? nextId ? definitions.find(item => item.id === nextId) : !firstWork.some(item => achieved(item.id)) ? firstWork[0] : undefined
      : definitions.find(item => !achieved(item.id));
    return { ...route, earned, ...(next ? { next } : {}) };
  });
}

/** All names come from this life; there is no wall clock, service or extra RNG. */
export function legacyText(world: WorldPack, state: LifeState, text: string): string {
  if (!world.legacy) return text;
  return text.replace(/\{name\}/g, () => state.character?.name ?? "the maker")
    .replace(/\{work:([a-z][a-z0-9-]*)\}/g, (_match, id: string) =>
      state.accomplishments?.find(record => record.achievementId === id)?.name ?? "the earlier work");
}

export function awardAccomplishment(
  world: WorldPack, state: LifeState, achievementId: string, sourceId: string, outcomeId: string,
): AccomplishmentRecord | undefined {
  const definition = world.legacy?.achievements.find(item => item.id === achievementId);
  if (!definition || !state.accomplishments) throw new Error("Accomplishment requires a legacy-enabled life.");
  if (state.accomplishments.some(record => record.achievementId === achievementId)) return undefined;
  const figurePath = world.figurePaths?.find(path => path.stages.some(stage => stage.achievementId === achievementId) || path.capstone.achievementId === achievementId || path.promotion?.achievementId === achievementId);
  const figureStage = figurePath?.stages.find(stage => stage.achievementId === achievementId);
  const figureProgress = figurePath ? getFigurePathProgress(world, figurePath, state) : undefined;
  const figureName = figureStage ? figureProgress?.encounterMode === "tradition" ? figureStage.traditionTitle : figureStage.title : undefined;
  const figureTitle = figureStage ? `${figureStage.rank} contribution to ${figurePath!.name}` : figurePath?.promotion?.achievementId === achievementId ? `Legendary figure outcome${figurePath.promotion.alternateHistory ? " · Alternate history" : ""}` : figurePath ? `${figurePath.baseRank} figure title` : undefined;
  const record: AccomplishmentRecord = {
    id: `${achievementId}:${state.age}`, achievementId, routeId: definition.routeId,
    title: figureTitle ?? definition.title, description: definition.description, kind: definition.kind,
    name: figureName ?? legacyText(world, state, definition.nameTemplate), age: state.age, year: state.year,
    sourceId, outcomeId, people: [...definition.people],
    ...(definition.figure ? { figure: { ...definition.figure } } : {}),
  };
  state.accomplishments.push(record);
  return record;
}
