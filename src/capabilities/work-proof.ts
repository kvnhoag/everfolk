/**
 * Proof from everyday work (worlds whose capability graph sets `proofFromWork`, alexandria-lives-7 and later).
 * A year spent on a yearly activity that trains a skill, or a year worked in a job, records one proof toward
 * the next open step of the matching lane. Nothing is paid, bought or consumed; no random draw is made.
 * Older revisions never call into this rule, so their saves replay exactly.
 */
import type { LifeState, WorldPack } from "../types.ts";
import type { CapabilityEvidence, CapabilityNode } from "./types.ts";
import { requirementReasons } from "./engine.ts";
import { ruleFor } from "./rules.ts";
import { militaryWorkReason, reconciledServiceYear } from "./military.ts";
import { hasServiceRole } from "../demo/service-role.ts";
import { vocationGains } from "../vocations/view.ts";
import { isTradingFocus } from "../market.ts";

/** Capability work, and so proof from it, begins at this age. */
export const WORK_PROOF_MIN_AGE = 12;
export const ACTIVITY_PROOF = "activity-proof", JOB_PROOF = "job-proof";
const PASSIVE_KINDS = new Set([ACTIVITY_PROOF, JOB_PROOF]);

/** A lane is a branch and its specialization; the trunk of a branch has none. */
export const laneOf = (node: Pick<CapabilityNode, "branch" | "specialization">): string => `${node.branch}/${node.specialization ?? "core"}`;

/** Which lanes a trained skill counts toward, in order of preference when two open steps share a depth. */
export const SKILL_LANES: Readonly<Record<string, readonly string[]>> = {
  craft: ["Handmade/core", "Handmade/Clothing"],
  pottery: ["Handmade/core", "Handmade/Ceramics"],
  carving: ["Handmade/core", "Handmade/Sculpture"],
  sculpture: ["Handmade/core", "Handmade/Sculpture"],
  literacy: ["Knowledge/core"],
  philosophy: ["Knowledge/core", "Knowledge/Research", "Knowledge/Civic practice"],
  astronomy: ["Knowledge/core", "Knowledge/Research"],
  oratory: ["Knowledge/core", "Knowledge/Civic practice"],
  reckoning: ["Trade/Commercial planning"],
  farming: ["Physique/core", "Physique/Cultivation", "Physique/Resilience"],
  strength: ["Physique/Conditioning"],
  endurance: ["Physique/Conditioning"],
  warfare: ["Physique/Military practice"],
};

/** The skills a year in each job practises, main skill first. Unlisted jobs fall back to their yearly skill effects. */
export const JOB_SKILLS: Readonly<Record<string, readonly string[]>> = {
  apprentice: ["craft"], tailor: ["craft"], "master-tailor": ["craft"],
  potter: ["pottery", "craft"], "ceramic-decorator": ["pottery", "craft"], "master-potter": ["pottery", "craft"], "pottery-workshop-lead": ["pottery", "reckoning"],
  "wood-carver": ["carving", "craft"], "carving-workshop-lead": ["carving", "reckoning"],
  sculptor: ["sculpture", "carving", "craft"], "master-sculptor": ["sculpture", "craft"], "sculpture-workshop-lead": ["sculpture", "reckoning"],
  copyist: ["literacy"], "philosophy-tutor": ["philosophy", "literacy", "oratory"], scientist: ["philosophy", "reckoning"],
  politician: ["oratory", "philosophy"], "court-adviser": ["oratory", "philosophy"],
  "sky-table-calculator": ["astronomy", "reckoning"], astrologer: ["astronomy"], "patron-supported-reader": ["astronomy", "literacy"],
  clerk: ["reckoning", "literacy"], shopkeeper: ["reckoning"], "grain-dealer": ["reckoning", "farming"],
  merchant: ["reckoning"], "trading-house-manager": ["reckoning"],
  farmhand: ["farming"], "tenant-farmer": ["farming"], "master-cultivator": ["farming"], "master-household-farmer": ["farming", "reckoning"],
  porter: ["strength", "endurance"],
  soldier: ["warfare", "strength", "endurance"], officer: ["warfare", "oratory"], general: ["warfare", "oratory"],
};

export const proofFromWork = (world: WorldPack): boolean => world.capabilities?.proofFromWork === true;

/**
 * Steps that only recorded work can prove: their recorded work supplies the next step's recorded work
 * (T2 records the cost basis T3 compares, PS8 makes the checked records PS9 cites), or their assessment examines
 * the recorded work itself (two exercises, two crops, two buyers). Project steps also need their assessment.
 * A3 stays open to practice: in these worlds A4's recorded work prepares its own clay when none is held.
 */
export const RECORDED_WORK_ONLY: ReadonlySet<string> = new Set(["T2", "PS8", "AS5", "FC8", "T10"]);
const recordedWorkOnly = (id: string): boolean => RECORDED_WORK_ONLY.has(id) || ruleFor(id)?.project === true;

const ordered = (gains: Map<string, number>): string[] => [...gains].sort((a, b) => b[1] - a[1]).map(([skill]) => skill);

/** Skills a yearly activity trains, largest gain first. Capability work and job applications record their own proof. */
export function activityProofSkills(world: WorldPack, activityId: string): string[] {
  const activity = world.character?.activities.find(item => item.id === activityId);
  if (!activity || activity.usesYearlyActivity === false) return [];
  const effects = activity.outcomes.flatMap(outcome => outcome.effects);
  if (effects.some(effect => effect.type === "capability" || effect.type === "job")) return [];
  const gains = new Map<string, number>();
  const add = (skill: string, gain: number) => { if (gain > 0) gains.set(skill, Math.max(gains.get(skill) ?? 0, gain)); };
  for (const effect of effects) {
    if (effect.type === "skill") add(effect.skill, effect.delta);
    if (effect.type === "vocation") for (const [skill, gain] of Object.entries(vocationGains(world, effect.action))) add(skill, gain);
  }
  return ordered(gains);
}

export function jobProofSkills(world: WorldPack, jobId: string): string[] {
  if (JOB_SKILLS[jobId]) return [...JOB_SKILLS[jobId]];
  const job = world.character?.jobs.find(item => item.id === jobId);
  const gains = new Map<string, number>();
  for (const effect of job?.yearlyEffects ?? []) if (effect.type === "skill" && effect.delta > 0) gains.set(effect.skill, Math.max(gains.get(effect.skill) ?? 0, effect.delta));
  return ordered(gains);
}

/** Civilian, service and military gates of recorded capability work, without its yearly-action, fee and materials rules. */
function openForProof(world: WorldPack, life: LifeState, node: CapabilityNode, completedAge: number): boolean {
  if (recordedWorkOnly(node.id) || life.capabilities!.learned[node.id] || requirementReasons(world, life, node.id).length) return false;
  if (hasServiceRole(life) && !/^[MPB]/.test(node.id)) return false;
  if (/^M/.test(node.id) && militaryWorkReason(life, node.id)) return false;
  // Service-lane steps settle against an actual funded, fully rationed service year, as recorded work does.
  return !/^M(?:[5-9]|10)$/.test(node.id) || reconciledServiceYear(life, completedAge);
}

/** The lowest-depth open step on the skills' lanes; ties go to the earlier skill and lane. */
export function nextProofNode(world: WorldPack, life: LifeState, skills: readonly string[], completedAge = life.age - 1): string | undefined {
  if (!world.capabilities || !life.capabilities) return undefined;
  let best: CapabilityNode | undefined;
  for (const skill of skills) for (const lane of SKILL_LANES[skill] ?? []) {
    for (const node of world.capabilities.nodes) {
      if (laneOf(node) !== lane || best && node.depth >= best.depth) continue;
      if (openForProof(world, life, node, completedAge)) best = node;
    }
  }
  return best?.id;
}

function record(world: WorldPack, life: LifeState, age: number, year: number, kind: string, source: string, skills: string[]): void {
  const nodeId = nextProofNode(world, life, skills, age);
  if (!nodeId) return;
  const evidence = life.capabilities!.evidence;
  if (evidence.some(e => e.nodeId === nodeId && e.age === age && e.data.qualifies === true)) return;
  const data: CapabilityEvidence["data"] = { qualifies: true, source, skill: skills.find(skill => (SKILL_LANES[skill] ?? []).length) ?? skills[0] };
  evidence.push({ nodeId, age, year, kind, data });
}

/**
 * Called when a yearly activity is taken, before its effects: like recorded work, the step must already be open,
 * so the practice that first reaches a step's skill level does not also prove that step.
 */
export function recordActivityProof(world: WorldPack, life: LifeState, activityId: string): void {
  if (!proofFromWork(world) || !life.capabilities || life.age < WORK_PROOF_MIN_AGE) return;
  const skills = activityProofSkills(world, activityId);
  if (skills.length) record(world, life, life.age, life.year, ACTIVITY_PROOF, activityId, skills);
}

/** Called once per settled year, after the age increment and before capabilities are evaluated. */
export function recordWorkProofs(world: WorldPack, life: LifeState, completedAge: number): void {
  if (!proofFromWork(world) || !life.capabilities || !life.character || completedAge < WORK_PROOF_MIN_AGE) return;
  // A job counts when it was actually worked: the year was not set aside for other work or market trading.
  const jobId = life.character.jobId;
  if (jobId && life.vocations?.workedAge !== completedAge && !isTradingFocus(world, life, completedAge)) {
    record(world, life, completedAge, life.year - 1, JOB_PROOF, jobId, jobProofSkills(world, jobId));
  }
}

/** Passive proofs are plain work years; farm steps add them to harvest receipts in proof-from-work worlds. */
export function passiveProofs(world: WorldPack, life: LifeState, nodeId: string): CapabilityEvidence[] {
  if (!proofFromWork(world)) return [];
  return (life.capabilities?.evidence ?? []).filter(e => e.nodeId === nodeId && PASSIVE_KINDS.has(e.kind) && e.data.qualifies === true);
}
