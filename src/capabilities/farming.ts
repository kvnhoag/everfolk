import type { LifeState, WorldPack } from "../types.ts";
import type { DemoContext, DemoDefinition } from "../demo/types.ts";
import { capabilityRewards, quoteFarmCapabilityPlan } from "./rewards.ts";

const FULL = 10000;
const whole = (value: number) => Math.max(0, Math.floor(value));

/** Exactly the people-ration calculation used by household settlement; animals remain separate. */
export function annualHouseholdRations(def: DemoDefinition, life: LifeState, age = life.age): number {
  if (!life.demo) return 0;
  const config = def.household, share = (memberAge: number) => memberAge >= config.childWorkAge ? 100 : Math.floor(100 * config.childRationBps / FULL);
  let shares = life.character?.jobId === "soldier" ? 0 : share(age);
  if (life.demo.household.parents !== "gone") shares += 200;
  if (life.character?.relationshipStatus === "married") shares += 100;
  for (const child of life.character?.children ?? []) shares += share(Math.max(0, age - child.birthAge));
  return Math.floor(config.adultRation * shares / 100);
}
export function annualAnimalRations(def: DemoDefinition, life: LifeState): number {
  const animals = life.demo?.household.animals;
  return animals ? animals.ox * def.household.animalFeed.ox + animals.donkey * def.household.animalFeed.donkey : 0;
}

/** Pure preview or receipt view. A plan belongs to the work year immediately before settlement. */
export function capabilityFarmPlan(world: WorldPack, life: LifeState, settlementAge = life.age) {
  if (!world.capabilities || !world.demo || !life.demo) return null;
  const household = life.demo.household, work = life.vocations?.capabilityWork, profile = capabilityRewards(Object.keys(life.capabilities?.learned ?? {}));
  const recorded = work?.farmPlan?.age === settlementAge - 1 ? work.farmPlan : undefined;
  const mode = recorded?.mode ?? "none", requestedSowing = recorded?.sowing ?? "ordinary";
  const sowing = requestedSowing === "dense" && !profile.farm.denseSowing || requestedSowing === "conservative" && !profile.farm.conservativeSowing ? "ordinary" : requestedSowing;
  const flaxPlots = Math.min(whole(household.flaxPlots), whole(household.plots)), grainPlots = Math.max(0, whole(household.plots) - flaxPlots);
  const validModes = ["none", "fieldwork", "soil-preparation", "crop-care", "channel-maintenance", "integrated"] as const;
  const requestedMode = validModes.find(item => item === mode) ?? "fieldwork";
  // Supervised preparation is a legitimate proof before its reward is learned.
  // It retains its work receipt but receives only the ordinary, unbonused plan.
  const quote = (crop: "grain" | "flax", plots: number) => {
    const args = { crop, plots, mode: requestedMode, sowing, flood: life.demo!.year.flood, baseFloodBps: world.demo!.household.floodFactorBps[life.demo!.year.flood] };
    let result = quoteFarmCapabilityPlan(profile, args);
    if (!result.allowed) result = quoteFarmCapabilityPlan(profile, { ...args, mode: "fieldwork" });
    if ((requestedMode === "channel-maintenance" || requestedMode === "integrated") && !recorded?.maintenancePaid) {
      result = quoteFarmCapabilityPlan(profile, { ...args, mode: "fieldwork" });
    }
    return result;
  };
  const grain = quote("grain", grainPlots), flax = quote("flax", flaxPlots);
  const grainSeedRequired = grainPlots * (sowing === "dense" ? 20 : 10), flaxSeedRequired = flaxPlots * 2;
  const grainSeedUsed = recorded?.seedDebited ? whole(recorded.grainSeed ?? 0) : Math.min(whole(household.grain), grainSeedRequired);
  const flaxSeedUsed = recorded?.seedDebited ? whole(recorded.flaxSeed ?? 0) : Math.min(whole(life.vocations?.inventory["flax-seed"] ?? 0), flaxSeedRequired);
  const ratio = (used: number, required: number) => required > 0 ? Math.min(FULL, Math.floor(used * FULL / required)) : FULL;
  return { age: settlementAge - 1, mode, sowing, planRecorded: recorded?.planRecorded ?? false,
    grainPlots, flaxPlots, grainSeedRequired, flaxSeedRequired, grainSeedUsed, flaxSeedUsed,
    grainSeedRatioBps: ratio(grainSeedUsed, grainSeedRequired), flaxSeedRatioBps: ratio(flaxSeedUsed, flaxSeedRequired),
    fullSeedAllocation: grainSeedUsed === grainSeedRequired && flaxSeedUsed === flaxSeedRequired,
    seedDebited: Boolean(recorded?.seedDebited && grainSeedUsed + flaxSeedUsed > 0),
    channelMaintained: Boolean(recorded?.maintainChannels && recorded.maintenancePaid), maintenancePaid: Boolean(recorded?.maintenancePaid),
    integratedPlan: Boolean(recorded?.integratedPlan), grainFloodBps: grain.floodFactorBps, flaxFloodBps: flax.floodFactorBps,
    grainBonusBps: grain.bonusBps, flaxBonusBps: flax.bonusBps };
}

function consumeFlaxSeed(life: LifeState, quantity: number): void {
  const ledger = life.vocations!;
  ledger.inventory["flax-seed"] = Math.max(0, (ledger.inventory["flax-seed"] ?? 0) - quantity);
  let remaining = quantity;
  for (const lot of ledger.lots) if (lot.item === "flax-seed" && remaining > 0) {
    const used = Math.min(lot.quantity, remaining); lot.quantity -= used; remaining -= used;
  }
}

/** Actual annual stock flows, recorded by household operations rather than inferred from an ending balance. */
function settlementLedger(world: WorldPack, life: LifeState) {
  if (!world.capabilities || !life.demo || !life.vocations) return null;
  const work = life.vocations.capabilityWork ??= {};
  if (work.farmSettlement?.age !== life.age) work.farmSettlement = { age: life.age, year: life.year, flood: life.demo.year.flood,
    openingGrain: life.demo.household.grain + (work.farmPlan?.age === life.age - 1 && work.farmPlan.seedDebited ? work.farmPlan.grainSeed ?? 0 : 0),
    harvestGrain: 0, rentGrain: 0, purchasedGrain: 0, peopleFed: 0, animalFed: 0, spoilage: 0, labour: 0, grainAfterConsumption: life.demo.household.grain };
  return work.farmSettlement;
}
export function recordCapabilityFarmFlow(world: WorldPack, life: LifeState, kind: "harvestGrain" | "rentGrain" | "purchasedGrain" | "peopleFed" | "animalFed" | "spoilage", quantity: number): void {
  if (!world.capabilities) return;
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("A farm flow must be a nonnegative whole quantity.");
  const ledger = settlementLedger(world, life);
  if (ledger) { ledger[kind] += quantity; if (kind === "peopleFed") ledger.grainAfterConsumption = life.demo!.household.grain; }
}
export function recordCapabilityFarmLabour(world: WorldPack, life: LifeState, labour: number): void {
  if (!Number.isSafeInteger(labour) || labour < 0) throw new Error("Farm labour must be a nonnegative whole quantity.");
  const ledger = settlementLedger(world, life); if (ledger) { ledger.labour = labour; ledger.labourRecorded = true; }
}

/** Actual, idempotent settlement debits. Only deep-tree worlds call this; it never borrows or creates seed. */
export function prepareCapabilityFarmSettlement(ctx: DemoContext): void {
  if (!ctx.world.capabilities) return;
  const life = ctx.life, ledger = life.vocations;
  if (!ledger || !life.demo) throw new Error("A deep-tree farming life requires its vocation and household ledgers.");
  const work = ledger.capabilityWork ??= {}, age = life.age;
  settlementLedger(ctx.world, life);
  if (work.storeExtended && work.storeUpkeepPaidAge !== age && work.storeUpkeepMissedAge !== age) {
    if (life.economy && life.economy.cash >= 4) {
      life.economy.cash -= 4; ledger.accounts.workshop += 4; work.storeUpkeepPaidAge = age;
      ctx.journal("capability-store-upkeep", "You pay 4 drachmas to maintain the store extension for this year.");
    } else {
      work.storeUpkeepMissedAge = age;
      ctx.journal("capability-store-upkeep-missed", "You cannot pay the store extension's upkeep. Its extra 500 capacity is unavailable this year; no debt is taken.");
    }
  }
  const facts = capabilityFarmPlan(ctx.world, life, age)!;
  if (work.farmPlan?.age !== age - 1) work.farmPlan = { age: age - 1, mode: "none", sowing: "ordinary", maintainChannels: false, planRecorded: false };
  const plan = work.farmPlan;
  if (plan.seedDebited) return;
  life.demo.household.grain -= facts.grainSeedUsed;
  consumeFlaxSeed(life, facts.flaxSeedUsed);
  plan.sowing = facts.sowing;
  plan.grainSeed = facts.grainSeedUsed; plan.flaxSeed = facts.flaxSeedUsed;
  plan.fullSeedAllocation = facts.fullSeedAllocation; plan.seedDebited = true;
  if (facts.grainSeedUsed + facts.flaxSeedUsed > 0) ctx.journal("capability-sowing-seed", `Sowing uses ${facts.grainSeedUsed} measures of grain seed and ${facts.flaxSeedUsed} purchased flax-seed units. These inputs leave the store before the harvest.`);
  if (!facts.fullSeedAllocation) ctx.journal("capability-sowing-short", "There is not enough seed for the full plan. Only the actually seeded share of each crop can produce a harvest.");
}

/** Extra capacity is usable only in a year whose upkeep can actually be paid. Pure preview before settlement. */
export function capabilityStoreCapacity(world: WorldPack | undefined, life: LifeState, age = life.age): number {
  const capacity = life.demo?.household.capacity ?? 0, work = life.vocations?.capabilityWork;
  if (!world?.capabilities || !work?.storeExtended) return capacity;
  const maintained = work.storeUpkeepPaidAge === age || work.storeUpkeepMissedAge !== age && (life.economy?.cash ?? 0) >= 4;
  return maintained ? capacity : Math.max(0, capacity - 500);
}

/** Exact post-settlement fields for the capability evidence recorder. */
export function capabilityFarmSettlementFacts(world: WorldPack, life: LifeState) {
  const plan = capabilityFarmPlan(world, life);
  if (!plan || !life.demo || !world.demo) return null;
  const h = life.demo.household, seedRequired = plan.grainPlots * 10, flaxSeedRequired = plan.flaxPlots * 2;
  const settlement = life.vocations?.capabilityWork?.farmSettlement?.age === life.age ? life.vocations.capabilityWork.farmSettlement : undefined;
  const openingReserve = Math.max(0, (settlement?.openingGrain ?? 0) - plan.grainSeedUsed);
  const fed = (settlement?.peopleFed ?? 0) + (settlement?.animalFed ?? 0);
  const currentFood = Math.max(0, (settlement?.harvestGrain ?? 0) - (settlement?.rentGrain ?? 0)) + (settlement?.purchasedGrain ?? 0);
  const reserveGrainUsed = Math.min(openingReserve, Math.max(0, fed - currentFood));
  const reconciled = Boolean(settlement && settlement.openingGrain - plan.grainSeedUsed + settlement.harvestGrain - settlement.rentGrain + settlement.purchasedGrain - settlement.peopleFed - settlement.animalFed - settlement.spoilage === h.grain);
  const allocationRecorded = plan.planRecorded && plan.grainPlots + plan.flaxPlots === Math.max(0, Math.floor(h.plots));
  const cropPlan = plan.grainPlots > 0 && plan.flaxPlots === 0 ? "grain" : plan.flaxPlots > 0 && plan.grainPlots === 0 ? "flax" : plan.grainPlots > 0 && plan.flaxPlots > 0 ? "mixed" : "fallow";
  return { ...plan, grainBefore: settlement?.openingGrain ?? h.grain, grainAfter: h.grain, plotsRecorded: allocationRecorded,
    labourRecorded: settlement?.labourRecorded === true, reconciled, cropPlan, annualRation: annualHouseholdRations(world.demo, life), animalRation: annualAnimalRations(world.demo, life),
    harvestGrain: settlement?.harvestGrain ?? 0, rentGrain: settlement?.rentGrain ?? 0, purchasedGrain: settlement?.purchasedGrain ?? 0,
    peopleFed: settlement?.peopleFed ?? 0, animalFed: settlement?.animalFed ?? 0, labour: settlement?.labour ?? 0,
    grainAfterConsumption: settlement?.grainAfterConsumption ?? h.grain, reservesUsed: reserveGrainUsed > 0, reserveGrainUsed,
    lowFlood: settlement?.flood === "low", flood: settlement?.flood ?? life.demo.year.flood, ledgerReconciled: reconciled,
    seedRequired, flaxSeedRequired, seedReserved: h.grain >= seedRequired && (life.vocations?.inventory["flax-seed"] ?? 0) >= flaxSeedRequired,
    fullRations: h.lastShortfallBps === 0, crop: plan.flaxPlots === 0 ? "grain" : plan.grainPlots === 0 ? "flax" : "mixed",
    preparedSoil: plan.mode === "soil-preparation", cropCare: plan.mode === "crop-care" || plan.mode === "integrated",
    storeUpkeepPaid: !life.vocations?.capabilityWork?.storeExtended || life.vocations.capabilityWork.storeUpkeepPaidAge === life.age };
}
