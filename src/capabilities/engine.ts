import type { LifeState, WorldPack } from "../types.ts";
import type { CapabilityState } from "./types.ts";
import { ruleFor } from "./rules.ts";
import { performWork, workQuote } from "./work.ts";
import { applyFarmWork, farmWorkReason, farmProofProgress, settleFarmCapabilities } from "./farming.ts";
import { applyStatDelta } from "../progression.ts";
import { syncEconomyStat } from "../economy.ts";
import { practiceGain } from "../paths/affinity.ts";
import { hasServiceRole } from "../demo/service-role.ts";
import { militaryWorkReason, settleMilitaryProofs } from "./military.ts";

export function initialCapabilities(): CapabilityState { return { learned: {}, evidence: [], costBasis: {}, reservedPayment: 0 }; }
export function requirementReasons(world: WorldPack, life: LifeState, id: string): string[] {
  const node = world.capabilities?.nodes.find(node => node.id === id);
  if (!node || !life.capabilities) return ["This world's saved rules do not enable this capability."];
  const reasons: string[] = [];
  for (const parent of node.prerequisites.all) if (!life.capabilities.learned[parent]) reasons.push(`Learn ${world.capabilities?.nodes.find(n=>n.id===parent)?.title ?? parent} first.`);
  for(const [stat,value]of Object.entries(node.minimumStats ?? {})) if(life.stats[stat]<value) reasons.push(`${world.stats[stat].label} ${value} required; you have ${Math.floor(life.stats[stat])}.`);
  for (const [skill, value] of Object.entries(node.minimumProficiency)) {
    if ((life.character?.skills[skill] ?? 0) < value) reasons.push(`${world.character?.skills[skill]?.label ?? skill} ${value} required; you have ${Math.floor(life.character?.skills[skill] ?? 0)}.`);
  }
  if (node.anyProficiency && !node.anyProficiency.some(group => Object.entries(group).every(([skill, value]) => (life.character?.skills[skill] ?? 0) >= value))) reasons.push(`Requires ${node.anyProficiency.map(group => Object.entries(group).map(([skill,value]) => `${world.character?.skills[skill]?.label ?? skill} ${value}`).join(" and ")).join(" or ")}.`);
  return reasons;
}
export function capabilityProgress(world: WorldPack, life: LifeState, id: string): { done: number; required: number; complete: boolean } {
  if (id.startsWith("F")) return farmProofProgress(world, life, id);
  const required = ruleFor(id)?.years ?? 1;
  const accepted = life.capabilities?.evidence.filter(e => e.nodeId === id && e.data.qualifies === true) ?? [];
  let done = new Set(accepted.map(e => e.age)).size;
  if (id === "AS5" && !["clay-model", "wood-relief-practice"].every(kind => accepted.some(e => e.data.exercise === kind))) done = Math.min(done, 1);
  if (id === "T10" && new Set(accepted.map(e => e.data.payer)).size < 2) done = Math.min(done, 1);
  if (ruleFor(id)?.project && !accepted.some(e => e.data.completedAssessment === true)) done = Math.min(done, required - 1);
  return { done, required, complete: done >= required };
}
/** Evaluator reads recorded receipts; skill values alone never award a capability. */
export function evaluateCapabilities(world: WorldPack, life: LifeState): void {
  if (!world.capabilities || !life.capabilities) return;
  for (const node of world.capabilities.nodes) {
    if (life.capabilities.learned[node.id] || requirementReasons(world, life, node.id).length) continue;
    const parentsLearnedAge = Math.max(-1, ...node.prerequisites.all.map(id => life.capabilities!.learned[id]?.age ?? Infinity));
    const evidence = life.capabilities.evidence.filter(e => e.nodeId === node.id && e.data.qualifies === true);
    if (evidence.some(e => e.age < parentsLearnedAge) || !capabilityProgress(world, life, node.id).complete) continue;
    life.capabilities.learned[node.id] = { age: life.age, year: life.year };
  }
}
export function capabilityReason(world: WorldPack, life: LifeState, id: string): string | undefined {
  if (!world.capabilities || !life.capabilities || !life.vocations || !life.character || !life.economy) return "This world does not enable capability work.";
  if (!world.capabilities.nodes.some(node => node.id === id)) return "Unknown capability.";
  if (life.phase === "ended") return "This life has ended.";
  if (life.age < 12) return "Capability work begins at age 12. Explore the paths while you grow.";
  if (life.capabilities.workedAge === life.age || life.vocations.workedAge === life.age) return "This year's work action has already been used.";
  if (hasServiceRole(life) && !(world.capabilities.version===2 && /^[MPB]/.test(id))) return "Leave military service before taking a year of civilian work.";
  const militaryBlock=militaryWorkReason(life,id);
  if(militaryBlock)return militaryBlock;
  if (life.vocations.project) return "Finish the workshop project before registering a capability assessment.";
  if (life.capabilities.project && life.capabilities.project.nodeId !== id) return "Finish the registered assessment before starting another project.";
  const requirements = requirementReasons(world, life, id);
  if (requirements.length) return requirements[0];
  return id.startsWith("F") ? farmWorkReason(world, life, id) : workQuote(world, life, id).reason;
}
function gains(world: WorldPack, life: LifeState, id: string): void {
  const node = world.capabilities!.nodes.find(n=>n.id===id)!;
  const rule = ruleFor(id);
  const source = rule?.recipe ? world.vocations!.recipes[rule.recipe] : rule;
  const primary = id.startsWith("F") ? "farming" : source?.primary ?? Object.keys(node.minimumProficiency)[0];
  const supports = id.startsWith("F") ? world.capabilities?.version===2 ? ["strength","endurance"] : ["reckoning"] : source?.supports ?? [];
  for (const [skill, amount] of [[primary,3], ...supports.slice(0,2).map(skill => [skill,2])] as [string,number][]) {
    const definition = world.character!.skills[skill];
    // Paths worlds: work in a field the life is drawn to teaches a little faster.
    if (definition) life.character!.skills[skill] = applyStatDelta(definition, life.character!.skills[skill], practiceGain(world, life, skill, amount));
  }
  if(world.capabilities?.version===2 && (id.startsWith("P") || id.startsWith("M"))) life.stats.knowledge=applyStatDelta(world.stats.knowledge,life.stats.knowledge,id.startsWith("P")?2:1);
}
export function applyCapability(world: WorldPack, life: LifeState, id: string): string {
  const reason = capabilityReason(world, life, id);
  if (reason) throw new Error(reason);
  let text: string;
  if (id.startsWith("F")) {
    const result = applyFarmWork(world, life, id);
    text = result.text;
  } else {
    const evidence = performWork(world, life, id);
    if(world.capabilities?.version===2 && /^M(?:[5-9]|10)$/.test(id)) Object.assign(evidence.data,{qualifies:false,awaitingService:true});
    life.capabilities!.evidence.push(evidence);
    text = `${world.capabilities!.nodes.find(n=>n.id===id)!.title}: completed recorded ${evidence.kind} work. Materials ${evidence.data.materialsPaid} dr; fees ${evidence.data.feePaid} dr; quoted payment ${evidence.data.quotedPayment} dr.${evidence.data.awaitingService ? " Proof awaits the actual service-year accounts." : ""}${life.capabilities!.project ? " Assessment saved; remaining work can resume in a later year." : ""}`;
  }
  gains(world, life, id);
  life.capabilities!.workedAge = life.age;
  life.vocations!.workedAge = life.age;
  life.character!.lastActivityAge = life.age;
  evaluateCapabilities(world, life);
  syncEconomyStat(world, life);
  return text;
}
export function settleCapabilities(world: WorldPack, life: LifeState, completedAge: number): void {
  if (!world.capabilities || !life.capabilities) return;
  settleFarmCapabilities(world, life, completedAge);
  settleMilitaryProofs(world,life,completedAge);
  evaluateCapabilities(world, life);
}
