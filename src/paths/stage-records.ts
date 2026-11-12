/** One record per completed life stage: what a stage figure is later minted from. */
import type { LifeState, WorldPack } from "../types.ts";
import { lifeStageAt } from "../life-stages/index.ts";
import { FIELD_IDS } from "./types.ts";
import type { FieldId, StageRecord, Tier } from "./types.ts";
import { fieldOfNode } from "./pay.ts";

const FIELD_AFFINITY_MIN = 20, RENOWN_REPUTATION = 60, MASTER_DEPTH = 8, TOP_DEPTH = 10, CHILD_UNTIL = 12;

function mainField(world: WorldPack, life: LifeState): FieldId | null {
  const jobId = life.character?.jobId;
  const byJob = jobId ? FIELD_IDS.find(field => world.paths!.fields[field].jobs.includes(jobId)) : undefined;
  if (byJob) return byJob;
  const [best] = [...FIELD_IDS].sort((a, b) => life.paths!.affinity[b] - life.paths!.affinity[a]);
  return life.paths!.affinity[best] >= FIELD_AFFINITY_MIN ? best : null;
}

function learnedDepths(world: WorldPack, life: LifeState, field: FieldId): number[] {
  return Object.keys(life.capabilities?.learned ?? {})
    .filter(id => fieldOfNode(world, id) === field)
    .map(id => world.capabilities!.nodes.find(node => node.id === id)!.depth);
}

function tierOf(world: WorldPack, life: LifeState, field: FieldId | null): Tier {
  if (!field) return "learner";
  const depths = learnedDepths(world, life, field), jobId = life.character?.jobId ?? "";
  if (depths.includes(TOP_DEPTH) && (life.demo?.reputation ?? 0) >= RENOWN_REPUTATION) return "renowned";
  if (jobId.startsWith("master-") || depths.some(depth => depth >= MASTER_DEPTH)) return "master";
  if (world.paths!.fields[field].jobs.includes(jobId)) return "worker";
  return "learner";
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const TIER_PREFIX: Record<Tier, string> = { learner: "Apprentice ", worker: "", master: "Master ", renowned: "Renowned " };

function titleOf(world: WorldPack, life: LifeState, field: FieldId | null, tier: Tier, toAge: number): string {
  const district = world.paths!.districts[life.paths!.district].title;
  if (!field) {
    const origin = world.origins.find(item => item.id === life.originId)?.title ?? "a household";
    return toAge < CHILD_UNTIL ? `Child of ${origin.charAt(0).toLowerCase()}${origin.slice(1)}` : `Resident of ${district}`;
  }
  return capital(`${TIER_PREFIX[tier]}${world.paths!.fields[field].practitioner} of ${district}`);
}

function topSkills(life: LifeState): Record<string, number> {
  const skills = Object.entries(life.character?.skills ?? {}).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return Object.fromEntries(skills);
}

export function recordStage(world: WorldPack, life: LifeState, stageId: string, fromAge: number, toAge: number): StageRecord {
  const field = mainField(world, life), tier = tierOf(world, life, field);
  const within = (age: number): boolean => age >= fromAge && age <= toAge;
  const successors = (life.paths!.successors ?? []).filter(item => within(item.age)).map(item => `${item.name} (${item.relation})`);
  return {
    stageId, title: titleOf(world, life, field, tier, toAge), fromAge, toAge, district: life.paths!.district, field, tier,
    jobId: life.character?.jobId ?? null, topSkills: topSkills(life),
    nodes: Object.keys(life.capabilities?.learned ?? {}),
    reputation: life.demo?.reputation ?? 0,
    accomplishments: (life.accomplishments ?? []).filter(item => within(item.age)).map(item => item.achievementId),
    mentors: life.paths!.practitioners.filter(item => within(item.metAge)).map(item => item.name),
    ...(successors.length ? { successors } : {}),
  };
}

/** Appends the record of the stage that `age` belongs to, ending at `toAge`. Idempotent per stage. */
export function closeStage(world: WorldPack, life: LifeState, age: number, toAge: number): void {
  const stage = lifeStageAt(world, age);
  if (!stage || !life.paths || life.stageRecords?.some(record => record.stageId === stage.id)) return;
  life.stageRecords = [...life.stageRecords ?? [], recordStage(world, life, stage.id, stage.minAge, toAge)];
}

export function stageRecordsView(_world: WorldPack, life: LifeState): readonly StageRecord[] {
  return life.stageRecords ?? [];
}
