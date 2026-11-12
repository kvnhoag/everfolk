/** Field needs of the player's district: scarce fields pay more, crowded ones less. Pure reads. */
import type { LifeState, WorldPack } from "../types.ts";
import { FIELD_IDS } from "./types.ts";
import type { FieldId, NeedLabel, PathsState } from "./types.ts";

const NEUTRAL_BPS = 10_000;

export interface FieldNeed {
  field: FieldId;
  title: string;
  needBps: number;
  label: NeedLabel;
  working: number;
  reason: string;
}

/** Workers, masters and renowned people; learners do not yet meet a district's needs. */
export function working(paths: PathsState, field: FieldId): number {
  const [, workers, masters, renowned] = paths.people[field];
  return workers + masters + renowned;
}

function needOf(world: WorldPack, paths: PathsState, field: FieldId): { bps: number; label: NeedLabel } {
  const { pay, districts } = world.paths!;
  const demand = districts[paths.district].profile[field].demand;
  // A field the district does not rely on is neutral rather than "crowded".
  const raw = demand === 0 ? NEUTRAL_BPS : Math.round(NEUTRAL_BPS * demand / Math.max(1, working(paths, field)));
  const bps = Math.min(pay.maxBps, Math.max(pay.minBps, raw));
  const label: NeedLabel = bps >= pay.scarceBps ? "scarce" : bps <= pay.crowdedBps ? "crowded" : "steady";
  return { bps, label };
}

/** Recompute the needs cache for the player's district. Call after people or the district change. */
export function refreshNeeds(world: WorldPack, life: LifeState): void {
  const paths = life.paths!;
  paths.needs = Object.fromEntries(FIELD_IDS.map(field => [field, needOf(world, paths, field)])) as PathsState["needs"];
}

/** The cached pay multiplier for a field; 1× outside paths worlds. */
export function fieldNeedBps(life: LifeState, field: FieldId): number {
  return life.paths?.needs[field].bps ?? NEUTRAL_BPS;
}

export function fieldNeedsView(world: WorldPack, life: LifeState): FieldNeed[] {
  const paths = life.paths;
  if (!world.paths || !paths) return [];
  const district = world.paths.districts[paths.district];
  return FIELD_IDS.map(field => {
    const definition = world.paths!.fields[field];
    const count = working(paths, field), demand = district.profile[field].demand;
    const plural = `${definition.practitioner}s`;
    const reason = count === 0
      ? `No ${plural} working in ${district.title}${demand > 0 ? `, which needs ${demand}` : ""}.`
      : `${count} ${count === 1 ? definition.practitioner : plural} working where ${district.title} needs ${demand}.`;
    const { bps, label } = paths.needs[field];
    return { field, title: definition.title, needBps: bps, label, working: count, reason };
  });
}
