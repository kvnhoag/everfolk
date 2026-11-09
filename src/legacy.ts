import type { AccomplishmentRecord, LegacyRouteProgress, LifeState, WorldPack } from "./types.ts";

/** Reading progression never changes a life or consumes its random stream. */
export function getAccomplishments(world: WorldPack, state: LifeState): readonly AccomplishmentRecord[] {
  return world.legacy ? state.accomplishments ?? [] : [];
}

export function getLegacyRoutes(world: WorldPack, state: LifeState): readonly LegacyRouteProgress[] {
  const records = getAccomplishments(world, state);
  return (world.legacy?.routes ?? []).map(route => {
    const earned = records.filter(record => record.routeId === route.id);
    const next = route.achievementIds.map(id => world.legacy!.achievements.find(item => item.id === id)!)
      .find(item => !earned.some(record => record.achievementId === item.id));
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
  const record: AccomplishmentRecord = {
    id: `${achievementId}:${state.age}`, achievementId, routeId: definition.routeId,
    title: definition.title, description: definition.description, kind: definition.kind,
    name: legacyText(world, state, definition.nameTemplate), age: state.age, year: state.year,
    sourceId, outcomeId, people: [...definition.people],
  };
  state.accomplishments.push(record);
  return record;
}
