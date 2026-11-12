/** The player's district and its people, changing yearly by rule on a derived seeded stream. */
import type { LifeState, WorldPack } from "../types.ts";
import { nextRandom, seedToUint32 } from "../random.ts";
import { FIELD_IDS } from "./types.ts";
import type { FieldId, PathsState, TierCounts } from "./types.ts";
import { refreshNeeds } from "./needs.ts";
import { putItem } from "../capabilities/inventory.ts";

const BPS = 10_000;
const LEAVE_BPS = 500, LEARNER_PROMOTE_BPS = 2000, WORKER_PROMOTE_BPS = 500, RENOWN_CHANCE = 0.005;
const WAR_SOLDIER_LOSS_BPS = 1500, LOW_FLOOD_FARMER_LOSS_BPS = 1000, BUSY_SCARCE_BPS = 14_000;

/** A random source separate from the life's main stream, so district detail never rerolls gameplay. */
export function derivedStream(life: LifeState, purpose: string): () => number {
  let state = seedToUint32(`${life.seed}:paths:${purpose}`);
  return () => {
    const draw = nextRandom(state);
    state = draw.state;
    return draw.value;
  };
}

/** `count × bps`, with the fractional part rounded up by chance. */
function share(count: number, bps: number, random: () => number): number {
  const exact = count * bps;
  return Math.floor(exact / BPS) + (random() < (exact % BPS) / BPS ? 1 : 0);
}

/** Places the birthplace's materials in the vocation inventory. Returns whether anything was added. */
export function applyStartingMaterials(world: WorldPack, life: LifeState): boolean {
  const materials = world.paths?.startingMaterials?.[life.originId];
  if (!materials || !life.vocations) return false;
  for (const [item, quantity] of Object.entries(materials)) if (quantity > 0) putItem(life, item, quantity);
  return true;
}

export function districtOf(world: WorldPack, originId: string): string {
  const districts = world.paths!.districts;
  return Object.keys(districts).find(id => districts[id].origins.includes(originId)) ?? Object.keys(districts)[0];
}

export function initialPaths(world: WorldPack, life: LifeState): PathsState {
  const definition = world.paths!;
  const home = districtOf(world, life.originId);
  const random = derivedStream(life, "people:0");
  // ±1 variation; a tier the district does not have stays empty.
  const vary = (count: number): number => count === 0 ? 0 : Math.max(0, count + Math.floor(random() * 3) - 1);
  const people = Object.fromEntries(FIELD_IDS.map(field =>
    [field, definition.districts[home].profile[field].people.map(vary) as TierCounts])) as PathsState["people"];
  const background = definition.originAffinity?.[life.originId] ?? {};
  const affinity = Object.fromEntries(FIELD_IDS.map(field => [field, background[field] ?? 0])) as PathsState["affinity"];
  const paths: PathsState = { home, district: home, needs: {} as PathsState["needs"], people, affinity,
    lastPractice: {}, practitioners: [], introductions: [], moves: [] };
  refreshNeeds(world, { ...life, paths });
  return paths;
}

function turnover([learners, workers, masters, renowned]: TierCounts, random: () => number): TierCounts {
  const left: TierCounts = [learners, workers, masters, renowned].map(count => count - share(count, LEAVE_BPS, random)) as TierCounts;
  const toWorkers = share(left[0], LEARNER_PROMOTE_BPS, random);
  const toMasters = share(left[1], WORKER_PROMOTE_BPS, random);
  const toRenowned = left[2] > 0 && random() < RENOWN_CHANCE ? 1 : 0;
  return [left[0] - toWorkers, left[1] + toWorkers - toMasters, left[2] + toMasters - toRenowned, left[3] + toRenowned];
}

function lose(counts: TierCounts, tier: number, amount: number): TierCounts {
  const next = [...counts] as TierCounts;
  next[tier] = Math.max(0, next[tier] - amount);
  return next;
}

/** One year of the district: leavers, promotions, newcomers to scarce fields, war and flood losses. */
export function advanceDistrict(world: WorldPack, life: LifeState): void {
  const paths = life.paths!;
  const random = derivedStream(life, `district:${life.age}`);
  const people = { ...paths.people };
  for (const field of FIELD_IDS) {
    let counts = turnover(people[field], random);
    const need = paths.needs[field];
    if (need.label === "scarce") counts = [counts[0] + (need.bps >= BUSY_SCARCE_BPS ? 2 : 1), counts[1], counts[2], counts[3]];
    people[field] = counts;
  }
  const year = life.demo?.year;
  if (year && year.army !== "quiet") {
    const soldiers = people.soldiering[1];
    if (soldiers > 0) people.soldiering = lose(people.soldiering, 1, Math.max(1, Math.floor(soldiers * WAR_SOLDIER_LOSS_BPS / BPS)));
    for (const field of FIELD_IDS) if (field !== "soldiering") people[field] = lose(people[field], 0, 1);
  }
  if (year?.flood === "low") {
    const farmers = people.farming[1];
    if (farmers > 0) people.farming = lose(people.farming, 1, Math.max(1, Math.floor(farmers * LOW_FLOOD_FARMER_LOSS_BPS / BPS)));
  }
  paths.people = people as Record<FieldId, TierCounts>;
  refreshNeeds(world, life);
}
