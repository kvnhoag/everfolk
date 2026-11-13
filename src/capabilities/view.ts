import type { LifeState, WorldPack } from "../types.ts";
import type { CommissionTerms } from "./types.ts";
import type { CapabilityView } from "./types.ts";
import { capabilityAction } from "./catalog.ts";
import { capabilityReason, capabilityProgress, eligibleJobsForAssessment, isAssessmentNode, requirementReasons } from "./engine.ts";
import { farmWorkQuote } from "./farming.ts";
import { workQuote } from "./work.ts";
import { capabilityCatalog } from "./attribute-catalog.ts";

/** Pure view: opening the map never trains, awards nodes, reserves money or draws randomness. */
export function capabilityView(world: WorldPack, life: LifeState): CapabilityView {
  const enabled = Boolean(world.capabilities && life.capabilities);
  return { enabled, nodes: (world.capabilities?.nodes ?? capabilityCatalog(3)).map(node => {
    if (!enabled) return { id: node.id, state: "unavailable" as const, reasons: ["This saved world keeps its earlier progression rules. Start a new free-play life to use this tree."], progress: { done: 0, required: 1 }, actionId: null, actionLabel: "Unavailable in this world", requirementText: [] };
    const learned = Boolean(life.capabilities!.learned[node.id]);
    const requirements = requirementReasons(world, life, node.id);
    const reason = capabilityReason(world, life, node.id);
    const progress = capabilityProgress(world, life, node.id);
    let price = "";
    let terms: CommissionTerms | undefined;
    const isActiveProject = life.capabilities!.project?.nodeId === node.id;
    if (node.id.startsWith("F") && (!requirements.length || isActiveProject)) {
      const quote = farmWorkQuote(world, life, node.id);
      price = ` · ${quote.grainSeed} grain seed${quote.flaxSeed ? ` · ${quote.flaxSeed} flax seed` : ""} · ${quote.fee + quote.contingencyCost} dr costs`;
    }
    if (!node.id.startsWith("F") && (!requirements.length || isActiveProject)) {
      const quote = workQuote(world, life, node.id);
      terms = quote.terms;
      price = ` · ${quote.basket.cost + quote.fee} dr costs${quote.pay ? ` · ${quote.pay} dr payment` : ""}`;
    }
    const eligibleJobs = !learned && !node.id.startsWith("F") && !requirements.length && isAssessmentNode(node.id)
      ? eligibleJobsForAssessment(world, life, node.id)
      : undefined;
    return { id: node.id, state: learned ? "learned" as const : requirements.length || reason ? "locked" as const : "available" as const,
      reasons: reason ? [reason] : [], progress: { done: progress.done, required: progress.required },
      actionId: capabilityAction(node.id), actionLabel: `${learned ? "Use learned method" : "Work on this capability"}${price}`,
      requirementText: [...Object.entries(node.minimumProficiency).map(([id,value]) => `${world.character?.skills[id]?.label ?? id} ${value}`), ...Object.entries(node.minimumStats ?? {}).map(([id,value])=>`${world.stats[id]?.label ?? id} ${value}`), ...(node.anyProficiency ? [node.anyProficiency.map(group => Object.entries(group).map(([id,value]) => `${world.character?.skills[id]?.label ?? id} ${value}`).join(" + ")).join(" or ")] : [])],
      ...(terms ? { terms } : {}),
      ...(eligibleJobs ? { eligibleJobs } : {}) };
  }) };
}
