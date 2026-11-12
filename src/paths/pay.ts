/** Scarcity scales only pay that a finite account already funds; no money is created. */
import type { LifeState, WorldPack } from "../types.ts";
import { FIELD_IDS } from "./types.ts";
import type { FieldId } from "./types.ts";
import { fieldNeedBps } from "./needs.ts";

/** Base nodes outside a specialization that still belong to one field. */
const BRANCH_FIELDS: Record<string, FieldId> = { Physique: "farming", Knowledge: "research" };

export function fieldOfNode(world: WorldPack, nodeId: string): FieldId | null {
  const node = world.capabilities?.nodes.find(item => item.id === nodeId);
  if (!node || !world.paths) return null;
  if (node.specialization) return FIELD_IDS.find(field => world.paths!.fields[field].specializations.includes(node.specialization!)) ?? null;
  return BRANCH_FIELDS[node.branch] ?? null;
}

export function scaledPay(world: WorldPack, life: LifeState, field: FieldId | null, pay: number): number {
  if (field === null || !world.paths || !life.paths) return pay;
  return Math.floor(pay * fieldNeedBps(life, field) / 10_000);
}

/** Why pay differs from the usual, or undefined when the field is steady. Shown wherever scaled pay is. */
export function needNote(world: WorldPack, life: LifeState, field: FieldId | null): string | undefined {
  if (field === null || !world.paths || !life.paths) return undefined;
  const need = life.paths.needs[field];
  if (need.label === "steady") return undefined;
  const definition = world.paths.fields[field], place = world.paths.districts[life.paths.district].title;
  const times = `${(need.bps / 10_000).toFixed(1)}×`;
  return need.label === "scarce"
    ? `${definition.practitioner.charAt(0).toUpperCase()}${definition.practitioner.slice(1)}s are scarce in ${place}, so this pays ${times} the usual.`
    : `${definition.title} is crowded in ${place}, so this pays ${times} the usual.`;
}
