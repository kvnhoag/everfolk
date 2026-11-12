/** Farming assessments settle against real household receipts, never a work-button click. */
import type { LifeState, WorldPack } from "../types.ts";
import type { CapabilityEvidence } from "./types.ts";
import { hasServiceRole } from "../demo/service-role.ts";

const BPS = 10_000;
const GRAIN_SEED_PER_PLOT = 10;
const FLAX_SEED_PER_PLOT = 2;
const CHANNEL_FEE_PER_PLOT = 8;
const EXTENSION_FEE = 80;
const INSPECTION_FEE = 4;
const EXTENSION_CAPACITY = 500;
const EXTENSION_UPKEEP = 4;
const FARM_IDS = ["F1", "F2", "F3S", "F3W", "F4", "FC5", "FC6", "FC7", "FC8", "FC9", "FC10", "FR5", "FR6", "FR7", "FR8", "FR9", "FR10"];
const WATER_WORK = new Set(["F3W", "FC7", "FC10", "FR10"]);
const CARE_WORK = new Set(["F3S", "FC6", "FC10"]);
const REQUIRED: Record<string, number> = { FC6: 2, FC7: 2, FC8: 2, FC9: 2, FC10: 2, FR8: 2, FR9: 2, FR10: 3 };
const has = (life: LifeState, id: string) => Boolean(life.capabilities?.learned[id]);
const enabled = (world: WorldPack, life: LifeState) => Boolean(world.capabilities && life.capabilities && world.demo && life.demo);
const value = (entry: CapabilityEvidence | undefined, key: string): number => typeof entry?.data[key] === "number" ? entry.data[key] as number : 0;
const latest = (life: LifeState, kind: string, age: number) => [...(life.capabilities?.evidence ?? [])].reverse().find(entry => entry.kind === kind && entry.age === age);

/** The future food obligation uses the same household membership and ration ages as settlement. */
export function farmRationNeed(world: Pick<WorldPack, "demo">, life: LifeState, age = life.age + 1): number {
  if (!world.demo || !life.demo) return 0;
  const h = world.demo.household;
  const share = (memberAge: number) => memberAge >= h.childWorkAge ? 100 : Math.floor(h.childRationBps / 100);
  let units = hasServiceRole(life) ? 0 : share(age);
  if (life.demo.household.parents !== "gone") units += 200;
  if (life.character?.relationshipStatus === "married") units += 100;
  for (const child of life.character?.children ?? []) units += share(Math.max(0, age - child.birthAge));
  return Math.floor(h.adultRation * units / 100);
}
function animalNeed(world: Pick<WorldPack, "demo">, life: LifeState): number {
  if (!world.demo || !life.demo) return 0;
  return life.demo.household.animals.ox * world.demo.household.animalFeed.ox
    + life.demo.household.animals.donkey * world.demo.household.animalFeed.donkey;
}
function seeds(life: LifeState, mode = life.capabilities?.farm?.actionAge === life.age ? life.capabilities.farm.mode : "ordinary"): { grain: number; flax: number } {
  const h = life.demo!.household;
  return { grain: Math.max(0, h.plots - h.flaxPlots) * (mode === "dense" ? 20 : GRAIN_SEED_PER_PLOT), flax: h.flaxPlots * FLAX_SEED_PER_PLOT };
}
/** Grain an ordinary sowing of the household's grain plots needs. */
export function ordinarySeedGrain(life: LifeState): number { return seeds(life, "ordinary").grain; }
function material(life: LifeState, item: string): number { return life.vocations?.inventory[item] ?? 0; }
function consumeMaterial(life: LifeState, item: string, amount: number): void {
  if (!amount) return;
  const ledger = life.vocations!;
  ledger.inventory[item] = (ledger.inventory[item] ?? 0) - amount;
  let remaining = amount;
  for (const lot of ledger.lots.filter(lot => lot.item === item)) {
    const used = Math.min(remaining, lot.quantity); lot.quantity -= used; remaining -= used;
  }
}
function pay(life: LifeState, fee: number): void {
  if (!fee) return;
  life.economy!.cash -= fee;
  life.vocations!.accounts.workshop += fee;
}
function modeFor(life: LifeState, nodeId: string): string {
  if (nodeId === "FC5" && has(life, "FC5")) return "dense";
  if (nodeId === "FC9" && has(life, "FC9")) return "conservative";
  if (nodeId === "FC10" && has(life, "FC10")) {
    const previous = life.capabilities?.farm?.mode;
    if (previous === "dense" && has(life, "FC5") || previous === "conservative" && has(life, "FC9")) return previous!;
  }
  return "ordinary";
}
function workFee(life: LifeState, nodeId: string): number {
  const plots = life.demo!.household.plots;
  if (nodeId === "FR7") return has(life, "FR7") && !life.capabilities!.farm?.extension ? EXTENSION_FEE : INSPECTION_FEE;
  return WATER_WORK.has(nodeId) ? CHANNEL_FEE_PER_PLOT * plots : 0;
}

/** A selected contingency plan buys only available stock with cash left after its explicit work fee. */
function contingency(life: LifeState, world: WorldPack, nodeId: string): { quantity: number; cost: number } {
  if (!has(life, "FR9") || !["FR9", "FR10"].includes(nodeId)) return { quantity: 0, cost: 0 };
  const years = nodeId === "FR10" && has(life, "FR10") ? 2 : 1;
  const target = farmRationNeed(world, life) * years + animalNeed(world, life) + seeds(life, modeFor(life, nodeId)).grain;
  const price = life.demo!.town.prices.grain.sell;
  const budget = Math.max(0, life.economy!.cash - workFee(life, nodeId) - (life.capabilities?.farm?.extension ? EXTENSION_UPKEEP : 0));
  const quantity = Math.max(0, Math.min(target - life.demo!.household.grain, life.demo!.town.merchant.grain, Math.floor(budget / price)));
  return { quantity, cost: quantity * price };
}

export function farmWorkQuote(world: WorldPack, life: LifeState, nodeId: string): { grainSeed: number; flaxSeed: number; fee: number; contingencyBought: number; contingencyCost: number; materials: Record<string, number> } {
  if (!enabled(world, life)) return { grainSeed: 0, flaxSeed: 0, fee: 0, contingencyBought: 0, contingencyCost: 0, materials: {} };
  const seed = seeds(life, modeFor(life, nodeId)), purchase = contingency(life, world, nodeId);
  const builds = nodeId === "FR7" && has(life, "FR7") && !life.capabilities!.farm?.extension;
  return { grainSeed: seed.grain, flaxSeed: seed.flax, fee: workFee(life, nodeId), contingencyBought: purchase.quantity, contingencyCost: purchase.cost, materials: builds ? { timber: 4, clay: 5 } : {} };
}

export function farmWorkReason(world: WorldPack, life: LifeState, nodeId: string): string | undefined {
  if (!enabled(world, life) || !FARM_IDS.includes(nodeId) || !life.economy || !life.vocations) return "Farming capability work is unavailable in this world.";
  const h = life.demo!.household;
  if (h.plots < 1) return "This household has no plot to cultivate.";
  if (life.character?.jobId === "soldier") return "Leave military service before working a household plot.";
  const seed = seeds(life, modeFor(life, nodeId));
  if (h.grain + contingency(life, world, nodeId).quantity < seed.grain) return `Reserve ${seed.grain} grain for the seed actually sown on these plots.`;
  if (material(life, "flax-seed") < seed.flax) return `Buy ${seed.flax} flax-seed units before sowing these flax plots.`;
  if (life.economy.cash < workFee(life, nodeId)) return `This work costs ${workFee(life, nodeId)} dr; no money is borrowed automatically.`;
  if (nodeId === "FR7" && has(life, "FR7") && !life.capabilities!.farm?.extension && (material(life, "timber") < 4 || material(life, "clay") < 5)) return "The store extension needs 4 timber and 5 clay, in addition to 80 dr.";
  if (nodeId === "FC8" && h.flaxPlots !== 0 && h.flaxPlots !== h.plots) return "This assessment needs a single-crop plan: plant all plots with grain or all with flax.";
  return undefined;
}

export function applyFarmWork(world: WorldPack, life: LifeState, nodeId: string): { text: string; complete: boolean; data: Record<string, number | string | boolean> } {
  const reason = farmWorkReason(world, life, nodeId);
  if (reason) throw new Error(reason);
  const state = life.capabilities!, h = life.demo!.household, mode = modeFor(life, nodeId), seed = seeds(life, mode), fee = workFee(life, nodeId);
  const extension = state.farm?.extension === true || nodeId === "FR7" && has(life, "FR7");
  const builds = extension && state.farm?.extension !== true;
  const purchase = contingency(life, world, nodeId);
  if (purchase.quantity) {
    h.grain += purchase.quantity; life.demo!.town.merchant.grain -= purchase.quantity;
    life.economy!.cash -= purchase.cost; life.demo!.town.merchant.cash += purchase.cost;
  }
  if (builds) { consumeMaterial(life, "timber", 4); consumeMaterial(life, "clay", 5); }
  h.grain -= seed.grain; consumeMaterial(life, "flax-seed", seed.flax); pay(life, fee);
  state.farm = { actionAge: life.age, nodeId, seed: seed.grain, fee, mode, extension, reserveYears: nodeId === "FR10" && has(life, "FR10") ? 2 : 1, reserve: farmReserve(world, life) };
  const data = { debtBeforePlan: life.economy!.debt, seedPaid: seed.grain, flaxSeedPaid: seed.flax, cashPaid: fee, maintenancePaid: WATER_WORK.has(nodeId) ? fee : 0, extensionBuilt: builds, contingencyBought: purchase.quantity, contingencyCost: purchase.cost, crop: h.flaxPlots === 0 ? "grain" : h.flaxPlots === h.plots ? "flax" : "mixed", plots: h.plots, flaxPlots: h.flaxPlots };
  state.evidence.push({ nodeId, age: life.age, year: life.year, kind: "farm-plan", data });
  return { text: `A year of ${nodeId === "FR7" ? builds ? "store extension work" : "store inspection and stock reconciliation" : "planned fieldwork"} begins: ${seed.grain} grain and ${seed.flax} flax-seed sown${fee ? `; ${fee} dr paid` : ""}. The harvest and household food ledger will decide the proof.`, complete: false, data };
}

/** Called before the actual harvest, after the age increment, only in capability-enabled lives. */
export function beginFarmHarvest(world: WorldPack, life: LifeState, completedAge: number): void {
  if (!enabled(world, life) || latest(life, "farm-ledger", completedAge)) return;
  const h = life.demo!.household, state = life.capabilities!, pending = state.farm?.actionAge === completedAge ? state.farm : undefined;
  const plan = latest(life, "farm-plan", completedAge), seed = seeds(life, pending?.mode ?? "ordinary");
  const grainStart = h.grain;
  const grainSeed = pending ? pending.seed : Math.min(seed.grain, h.grain);
  const flaxSeed = pending ? value(plan, "flaxSeedPaid") : Math.min(seed.flax, material(life, "flax-seed"));
  if (!pending) { h.grain -= grainSeed; consumeMaterial(life, "flax-seed", flaxSeed); }
  const upkeep = state.farm?.extension && (life.economy?.cash ?? 0) >= EXTENSION_UPKEEP ? EXTENSION_UPKEEP : 0;
  if (upkeep) pay(life, upkeep);
  state.evidence.push({ nodeId: pending?.nodeId ?? "F1", age: completedAge, year: life.year - 1, kind: "farm-ledger", data: {
    grainStart, grainEnd: h.grain, seedDuringSettlement: pending ? 0 : grainSeed, seedPaid: grainSeed, flaxSeedPaid: flaxSeed,
    grainSeedBps: seed.grain ? Math.floor(grainSeed * BPS / seed.grain) : BPS,
    flaxSeedBps: seed.flax ? Math.floor(flaxSeed * BPS / seed.flax) : BPS,
    grainHarvest: 0, flaxHarvest: 0, rent: 0, rationsNeed: farmRationNeed(world, life, life.age), rationsServed: 0, animalFeed: 0, boughtFood: 0, spoiled: 0,
    debtBefore: plan ? value(plan, "debtBeforePlan") : life.economy?.debt ?? 0, flood: life.demo!.year.flood, crop: h.flaxPlots === 0 ? "grain" : h.flaxPlots === h.plots ? "flax" : "mixed",
    maintenancePaid: pending ? value(plan, "maintenancePaid") : 0, cashPaid: pending?.fee ?? 0, upkeepPaid: upkeep, activeWork: Boolean(pending),
  } });
}

export function recordFarmFlow(life: LifeState, key: string, quantity: number): void {
  const ledger = latest(life, "farm-ledger", life.age - 1);
  if (ledger) ledger.data[key] = value(ledger, key) + quantity;
}

/** Only paid plans change yields. Bonuses stack additively and cap at 20%; flood repair is separate. */
export function farmYieldPlan(life: LifeState, settlementAge = life.age): { floodFactorBps?: number; grainBonusBps: number; flaxBonusBps: number; grainSeedBps: number; flaxSeedBps: number } {
  if (!life.capabilities) return { grainBonusBps: 0, flaxBonusBps: 0, grainSeedBps: BPS, flaxSeedBps: BPS };
  const ledger = latest(life, "farm-ledger", settlementAge - 1), plan = life.capabilities.farm;
  const active = plan?.actionAge === settlementAge - 1;
  const node = active ? plan!.nodeId : "";
  const flood = life.demo?.year.flood;
  let bonus = CARE_WORK.has(node) && has(life, "F3S") ? has(life, "FC6") ? 800 : 500 : 0;
  if (active && plan?.mode === "dense" && has(life, "FC5") && flood !== "low") bonus += 600;
  if (active && plan?.mode === "conservative" && has(life, "FC9")) bonus += flood === "low" ? 1500 : -500;
  const maintained = active && WATER_WORK.has(node) && (value(ledger, "maintenancePaid") > 0 || plan!.fee >= CHANNEL_FEE_PER_PLOT * life.demo!.household.plots);
  const floodFactorBps = flood === "low" && maintained && has(life, "F3W") ? has(life, "FC7") ? 6000 : 5500 : undefined;
  const seed = seeds(life, active ? plan?.mode : "ordinary");
  const grainSeedBps = active ? BPS : seed.grain ? Math.floor(Math.min(life.demo!.household.grain, seed.grain) * BPS / seed.grain) : BPS;
  const flaxSeedBps = active ? BPS : seed.flax ? Math.floor(Math.min(material(life, "flax-seed"), seed.flax) * BPS / seed.flax) : BPS;
  return { ...(floodFactorBps !== undefined ? { floodFactorBps } : {}), grainBonusBps: Math.min(2000, bonus), flaxBonusBps: Math.min(2000, bonus + (has(life, "FC8") ? 500 : 0)), grainSeedBps: ledger ? value(ledger, "grainSeedBps") : grainSeedBps, flaxSeedBps: ledger ? value(ledger, "flaxSeedBps") : flaxSeedBps };
}

export function farmCapacityBonus(life: LifeState, settlementAge = life.age): number {
  if (!life.capabilities?.farm?.extension) return 0;
  const ledger = latest(life, "farm-ledger", settlementAge - 1);
  return (ledger ? value(ledger, "upkeepPaid") >= EXTENSION_UPKEEP : (life.economy?.cash ?? 0) >= EXTENSION_UPKEEP) ? EXTENSION_CAPACITY : 0;
}
/** Relative in-capacity reduction; earlier reductions still apply, with a 75% total limit. */
export function farmSpoilageCut(life: LifeState): number {
  if (has(life, "FR10")) return 3500;
  if (has(life, "FR9")) return 3000;
  if (has(life, "FR8")) return 2500;
  return has(life, "FR5") ? 1500 : 0;
}

export function farmReserve(world: Pick<WorldPack, "demo">, life: LifeState): number {
  if (!world.demo || !life.demo || !has(life, "F2")) return 0;
  let reserve = seeds(life).grain;
  if (has(life, "FR6")) reserve += farmRationNeed(world, life) * (has(life, "FR10") ? life.capabilities?.farm?.reserveYears ?? 1 : 1);
  if (has(life, "FR8")) reserve += animalNeed(world, life);
  return reserve;
}
export function farmSaleReason(world: Pick<WorldPack, "demo">, life: LifeState, quantity: number, override = false): string | undefined {
  if (!world.demo || !life.demo || !life.capabilities || override) return undefined;
  const reserve = farmReserve(world, life);
  if (reserve > 0 && life.demo!.household.grain - quantity < reserve) return `This sale would use the protected food/seed reserve of ${reserve} grain. Explicitly override the reserve to sell it.`;
}

function qualifies(world: WorldPack, life: LifeState, nodeId: string, d: CapabilityEvidence["data"]): boolean {
  const full = d.fullRations === true, seed = d.seedReserved === true, crop = Number(d.grainHarvest) + Number(d.flaxHarvest) > 0;
  if (!crop || d.reconciled !== true || d.fullSeed !== true) return false;
  switch (nodeId) {
    case "F1": case "F3S": case "FC5": case "FC6": return true;
    case "F2": case "F4": case "FC8": return seed;
    case "F3W": case "FC7": return Number(d.maintenancePaid) >= CHANNEL_FEE_PER_PLOT * life.demo!.household.plots;
    case "FC9": case "FC10": return full && seed;
    case "FR5": return full && Number(d.grainEnd) >= 240;
    case "FR6": case "FR8": return full && Number(d.grainEnd) >= Number(d.nextRations) + Number(d.nextSeed);
    case "FR7": return Number(d.cashPaid) >= INSPECTION_FEE;
    case "FR9": return full && (d.flood === "low" && Number(d.grainStart) >= Number(d.rationsNeed) && Number(d.boughtFood) === 0 || Number(d.grainEnd) >= Math.ceil(Number(d.nextRations) * 1.5) + Number(d.nextSeed));
    case "FR10": return full && seed && d.debtIncreased === false;
    default: return false;
  }
}

export function settleFarmCapabilities(world: WorldPack, life: LifeState, completedAge: number): void {
  if (!enabled(world, life)) return;
  const ledger = latest(life, "farm-ledger", completedAge), plan = life.capabilities!.farm;
  if (!ledger || !plan || plan.actionAge !== completedAge || latest(life, "farm-settlement", completedAge)) return;
  const h = life.demo!.household, seed = seeds(life), nextRations = farmRationNeed(world, life);
  const equation = value(ledger, "grainStart") - value(ledger, "seedDuringSettlement") + value(ledger, "grainHarvest") - value(ledger, "rent") - value(ledger, "rationsServed") - value(ledger, "animalFeed") - value(ledger, "spoiled") + value(ledger, "boughtFood");
  const data: CapabilityEvidence["data"] = { ...ledger.data, grainEnd: h.grain, fullRations: h.lastShortfallBps === 0 && value(ledger, "rationsServed") === value(ledger, "rationsNeed"), reconciled: equation === h.grain,
    fullSeed: value(ledger, "grainSeedBps") === BPS && value(ledger, "flaxSeedBps") === BPS,
    seedReserved: h.grain >= seed.grain && material(life, "flax-seed") >= seed.flax,
    nextRations, nextSeed: seed.grain, debtIncreased: (life.economy?.debt ?? 0) > value(ledger, "debtBefore") };
  data.qualifies = qualifies(world, life, plan.nodeId, data);
  life.capabilities!.evidence.push({ nodeId: plan.nodeId, age: completedAge, year: ledger.year, kind: "farm-settlement", data });
}

export function farmProofProgress(world: WorldPack, life: LifeState, nodeId: string): { done: number; required: number; complete: boolean } {
  const required = world.capabilities?.nodes.find(node => node.id === nodeId)?.proofYears ?? REQUIRED[nodeId] ?? 1;
  const receipts = (life.capabilities?.evidence ?? []).filter(e => e.nodeId === nodeId && e.kind === "farm-settlement" && e.data.qualifies === true);
  const unique = [...new Map(receipts.map(e => [e.age, e])).values()].sort((a, b) => a.age - b.age);
  let done = unique.length;
  if (nodeId === "FC8") done = new Set(unique.map(e => e.data.crop).filter(crop => crop === "grain" || crop === "flax")).size;
  if (nodeId === "FR9" && unique.some(e => e.data.flood === "low" && Number(e.data.grainStart) >= Number(e.data.rationsNeed) && Number(e.data.boughtFood) === 0)) return { done: required, required, complete: true };
  if (nodeId === "FR10") {
    let run = 0; done = 0; let previous = -2;
    for (const e of unique) { run = e.age === previous + 1 ? run + 1 : 1; previous = e.age; done = Math.max(done, run); }
  }
  return { done: Math.min(done, required), required, complete: done >= required };
}
