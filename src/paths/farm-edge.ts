/** The village farming edge: cheaper farm inputs, and better health from farm work at home. */
import type { LifeState, WorldPack } from "../types.ts";
import type { FarmEdge } from "./types.ts";
import { FARMING_JOBS } from "../demo/types.ts";

/** Materials bought only to farm; their price follows the district's farm edge. */
const FARM_INPUTS: ReadonlySet<string> = new Set(["flax-seed"]);
const FARMING_JOB_IDS: readonly string[] = [...FARMING_JOBS, "master-cultivator", "master-household-farmer"];

/** The edge of the district the life lives in now, if it farms at home there. */
export function farmEdgeOf(world: WorldPack, life: LifeState): FarmEdge | undefined {
  if (!world.paths || !life.paths) return undefined;
  return world.paths.districts[life.paths.district]?.farmEdge;
}

/** A farm-work fee or input price after the district's edge. The payer pays it and the payee receives it. */
export function farmInputCost(world: WorldPack, life: LifeState, cost: number): number {
  const edge = farmEdgeOf(world, life);
  return edge ? Math.floor(cost * edge.inputBps / 10_000) : cost;
}

/** The cost of buying a material: farm inputs follow the district's edge, other materials do not. */
export function materialCost(world: WorldPack, life: LifeState, item: string, quantity: number): number {
  const cost = world.vocations!.materials[item].price * quantity;
  return FARM_INPUTS.has(item) ? farmInputCost(world, life, cost) : cost;
}

/** Health gained for the year `age`: farm work, or a farming job, in the home fields of an edge district. */
export function farmEdgeHealth(world: WorldPack, life: LifeState, age: number): number {
  const edge = farmEdgeOf(world, life);
  if (!edge || life.paths!.district !== life.paths!.home) return 0;
  const fieldwork = life.capabilities?.farm?.actionAge === age;
  const farmer = FARMING_JOB_IDS.includes(life.character?.jobId ?? "") && life.vocations?.workedAge !== age;
  return fieldwork || farmer ? edge.healthPerYear : 0;
}
