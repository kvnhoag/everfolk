import { annualHouseholdRations, annualAnimalRations, capabilityFarmSettlementFacts } from "./farming.ts";
import type { LifeState, WorldPack } from "../types.ts";
import type { TradeCommand } from "../demo/types.ts";
import type { CapabilityEvidence, CapabilityState } from "./types.ts";
import { evaluateCapabilities, recordCapabilityEvidence } from "./evaluate.ts";
import { capabilityRewards } from "./rewards.ts";

export const initialCapabilities = (): CapabilityState => ({ learned: {}, evidence: [] });
export function syncCapabilities(world: WorldPack, life: LifeState): void {
  if (!world.deepCapabilities || !life.deepCapabilities) return;
  const result = evaluateCapabilities({ skills: life.character?.skills ?? {}, stats: life.stats, reputation: life.demo?.reputation ?? 0, year: life.year, state: life.deepCapabilities, rules: world.deepCapabilities.rules });
  life.deepCapabilities = result.state;
  for (const id of result.newlyLearned) {
    const rule = world.deepCapabilities.rules.find(node => node.id === id)!;
    life.journal.push({ type: "activity", id: `capability-${id}`, age: life.age, year: life.year, text: `Learned ${rule.title}. ${rule.rewardDescription}` });
  }
}
export function recordEvidence(world: WorldPack, life: LifeState, record: Omit<CapabilityEvidence, "id" | "year" | "successful">): string {
  if (!world.deepCapabilities || !life.deepCapabilities) return "";
  const id = `proof-${life.year}-${life.deepCapabilities.evidence.length}-${record.action}`;
  life.deepCapabilities = recordCapabilityEvidence(life.deepCapabilities, { ...record, id, year: life.year, successful: true });
  const assessment = life.vocations?.capabilityWork?.assessment;
  if (assessment && record.kind !== "assessment") assessment.evidenceIds.push(id);
  return id;
}
export function recordFarmSettlement(world: WorldPack, life: LifeState, beforeGrain: number, beforeDebt: number): void {
  if (!world.deepCapabilities || !life.deepCapabilities || !life.demo || !life.vocations || life.age < 12) return;
  const work = life.vocations.capabilityWork, plan = work?.farmPlan;
  if (!plan || plan.age !== life.age - 1 || work?.farmWorkAge !== life.age - 1) return;
  const facts = capabilityFarmSettlementFacts(world, life);
  recordEvidence(world, life, { kind: "harvest", action: "annual-settlement", facts: {
    ...facts, grainBefore: beforeGrain, grainAfter: life.demo.household.grain,
    newEmergencyDebt: Math.max(0, (life.economy?.debt ?? 0) - beforeDebt),
  } });
}
export function recordAcceptedTrade(world: WorldPack, life: LifeState, command: TradeCommand, cashBefore: number): void {
  if (!world.deepCapabilities || !life.vocations || !life.demo) return;
  const work = life.vocations.capabilityWork ??= {};
  const paid = Math.abs((life.economy?.cash ?? cashBefore) - cashBefore);
  work.tradeAcquisitionCost ??= {}; work.tradeAcquisitionQuantity ??= {};
  let realizedMargin = 0, costRecorded = command.side === "buy";
  if (command.side === "buy") {
    work.tradeAcquisitionCost[command.item] = (work.tradeAcquisitionCost[command.item] ?? 0) + paid;
    work.tradeAcquisitionQuantity[command.item] = (work.tradeAcquisitionQuantity[command.item] ?? 0) + command.quantity;
  } else {
    const acquired = work.tradeAcquisitionQuantity[command.item] ?? 0;
    const basis = acquired > 0 ? Math.ceil((work.tradeAcquisitionCost[command.item] ?? 0) * Math.min(acquired, command.quantity) / acquired) : 0;
    costRecorded = acquired >= command.quantity;
    realizedMargin = costRecorded ? paid - basis : 0;
    work.tradeAcquisitionCost[command.item] = Math.max(0, (work.tradeAcquisitionCost[command.item] ?? 0) - basis);
    work.tradeAcquisitionQuantity[command.item] = Math.max(0, acquired - command.quantity);
  }
  recordEvidence(world, life, { kind: "trade", action: command.side === "buy" ? "purchase" : "sale", facts: { item: command.item, quantity: command.quantity, paidInputs: costRecorded, costRecorded, feesPaid: true, reconciled: true, payment: paid, paymentRecorded: true, realizedMargin, supplierDebt: 0, buyerAccount: command.counterparty, deadlineMet: true } });
  syncCapabilities(world, life);
}
export function protectedGrain(world: WorldPack, life: LifeState): number {
  if (!world.deepCapabilities || !life.demo) return 0;
  const rewards = capabilityRewards(Object.keys(life.deepCapabilities?.learned ?? {}));
  const seed = (life.demo.household.plots - life.demo.household.flaxPlots) * 10;
  const rations = annualHouseholdRations(world.demo!, life) + annualAnimalRations(world.demo!, life);
  return rewards.farm.protectedReserve ? seed + rations : rewards.farm.seedReserve ? seed : 0;
}
