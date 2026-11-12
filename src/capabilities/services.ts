import type { LifeState, WorldPack } from "../types.ts";
import { applyStatDelta } from "../progression.ts";
import { capabilityRewards, CAPABILITY_SERVICE_CONTRACTS, quoteCapabilityService } from "./rewards.ts";
import type { CapabilityServiceId } from "./rewards.ts";
import { CAPABILITY_OPERATIONS } from "./operations.ts";
import { recordEvidence } from "./runtime.ts";

type Contract = { node: string; pay: number; fee: number; inputs: Record<string, number>; workYears: number; reputation: number };
const contracts: Record<string, Contract> = {
  ...CAPABILITY_SERVICE_CONTRACTS,
  "garment-repair": { node: "AT10", pay: 24, fee: 2, inputs: { linen: 1, thread: 1 }, workYears: 1, reputation: 0 },
  restoration: { node: "AS10", pay: 80, fee: 5, inputs: { stone: 1, pigment: 1 }, workYears: 2, reputation: 0 },
};
const inventory = (life: LifeState): Record<string, number> => ({ ...life.vocations!.inventory, linen: life.demo!.goods.linen, flax: life.demo!.household.flax });
const idOf = (operation: string) => operation.slice("service-".length);
const payerOf = (id: string): "workshop" | "school" | "council" => id === "garment-repair" || id === "restoration" ? "workshop" : contracts[id].node.startsWith("PP") ? "council" : "school";

export function capabilityServiceReason(world: WorldPack, life: LifeState, operation: string): string | undefined {
  const id = idOf(operation), contract = contracts[id], work = life.vocations!.capabilityWork;
  if (!contract) return "Unknown service contract.";
  if (!life.capabilities?.learned[contract.node]) return `Requires ${contract.node}.`;
  if (work?.serviceProject) return work.serviceProject.serviceId === id ? undefined : "Complete the current service contract before accepting another.";
  const resources = { cash: life.economy!.cash, inventory: inventory(life), payerBudget: life.vocations!.accounts[payerOf(id)] };
  if (id in CAPABILITY_SERVICE_CONTRACTS) return quoteCapabilityService(capabilityRewards(Object.keys(life.capabilities.learned)), id as CapabilityServiceId, resources).reason;
  if (resources.cash < contract.fee) return "You cannot pay this service's access fee.";
  if (resources.payerBudget < contract.pay) return "The customer cannot reserve this service's payment.";
  if (Object.entries(contract.inputs).some(([item, quantity]) => (resources.inventory[item] ?? 0) < quantity)) return "Buy or produce the service's required materials first.";
}
function consume(life: LifeState, item: string, quantity: number): boolean {
  const ledger = life.vocations!, work = ledger.capabilityWork!;
  if (item === "linen") life.demo!.goods.linen -= quantity;
  else if (item === "flax") life.demo!.household.flax -= quantity;
  else {
    ledger.inventory[item] -= quantity;
    let remaining = quantity;
    for (const lot of ledger.lots) if (lot.item === item && remaining > 0) { const used = Math.min(remaining, lot.quantity); lot.quantity -= used; remaining -= used; }
  }
  const acquired = work.tradeAcquisitionQuantity?.[item] ?? 0, cost = work.tradeAcquisitionCost?.[item] ?? 0;
  const usedCost = acquired > 0 ? Math.ceil(cost * Math.min(acquired, quantity) / acquired) : 0;
  if (work.tradeAcquisitionQuantity) work.tradeAcquisitionQuantity[item] = Math.max(0, acquired - quantity);
  if (work.tradeAcquisitionCost) work.tradeAcquisitionCost[item] = Math.max(0, cost - usedCost);
  return acquired >= quantity;
}
/** Runs inside the engine's detached candidate. The caller owns annual-action bookkeeping. */
export function applyCapabilityService(world: WorldPack, life: LifeState, operation: string): string {
  const reason = capabilityServiceReason(world, life, operation);
  if (reason) throw new Error(reason);
  const id = idOf(operation), contract = contracts[id], ledger = life.vocations!, work = ledger.capabilityWork ??= {};
  if (!work.serviceProject) {
    let paidInputs = true;
    for (const [item, quantity] of Object.entries(contract.inputs)) paidInputs = consume(life, item, quantity) && paidInputs;
    life.economy!.cash -= contract.fee; ledger.accounts.workshop += contract.fee;
    const payer = payerOf(id);
    ledger.accounts[payer] -= contract.pay;
    work.serviceProject = { serviceId: id, completedYears: 0, workYears: contract.workYears, escrow: contract.pay, payer, paidInputs, fee: contract.fee };
  }
  const project = work.serviceProject; project.completedYears++;
  const op = CAPABILITY_OPERATIONS[operation];
  for (const [skill, gain] of [[op.primary, 3], ...op.supports.map(skill => [skill, 2])] as [string, number][]) life.character!.skills[skill] = applyStatDelta(world.character!.skills[skill], life.character!.skills[skill] ?? 0, gain);
  const complete = project.completedYears === project.workYears;
  recordEvidence(world, life, { kind: complete ? "contract" : "work", action: `service-${id}`, facts: { workCompleted: true, completedYears: project.completedYears, paidInputs: project.paidInputs, feesPaid: true, reconciled: true, paymentRecorded: complete, payment: complete ? project.escrow : 0, payerAccount: project.payer } });
  if (!complete) return `Completed a work year of ${id.replaceAll("-", " ")}. Inputs and fees are already reserved; ${project.workYears - project.completedYears} year remains.`;
  life.economy!.cash += project.escrow;
  life.demo!.reputation = Math.min(world.demo!.works.reputation.max, life.demo!.reputation + contract.reputation);
  delete work.serviceProject;
  return `Completed ${id.replaceAll("-", " ")}; the customer's reserved ${project.escrow} dr payment is transferred to you.`;
}
export function capabilityServiceCashDelta(life: LifeState, operation: string): number {
  const project = life.vocations?.capabilityWork?.serviceProject;
  if (project) return project.serviceId === idOf(operation) && project.completedYears + 1 === project.workYears ? project.escrow : 0;
  const contract = contracts[idOf(operation)];
  return contract ? (contract.workYears === 1 ? contract.pay : 0) - contract.fee : 0;
}
