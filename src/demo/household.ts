/** Track A (+G) — household, farming, flax, family stages, hunger. */
import type { DemoContext, DemoDefinition, HouseholdConfig, HouseholdState, LifeStateWithDemo, PlanCommand } from "./contracts.ts";
import type { LifeState } from "../types.ts";
import { FARMING_JOBS, FARMING_SKILL, LIVESTOCK } from "./types.ts";
import { buyForHousehold } from "./market.ts";
import { spoilageCutBps } from "./works.ts";

const FULL = 10_000;
const ADULT = 100;
const MARRIAGE_GIFT_ID = "household-marriage-gift";
const FARMING_JOB_IDS: readonly string[] = FARMING_JOBS;

export function initialHousehold(def: DemoDefinition): HouseholdState {
  const h = def.household;
  return { grain: h.startingGrain, capacity: h.storeCapacity, plots: h.plots, flaxPlots: 0, flax: 0,
    animals: Object.fromEntries(LIVESTOCK.map(animal => [animal, 0])) as HouseholdState["animals"],
    parents: "working", headSinceAge: null, lastShortfallBps: 0, harvestBonusBps: 0 };
}

// ── Whole-number helpers ────────────────────────────────────────────────────

/** `amount × bps / 10000`, floored, exact for any safe whole amount. */
function bpsOf(amount: number, bps: number): number {
  return Math.floor(amount / FULL) * bps + Math.floor((amount % FULL) * bps / FULL);
}
function whole(value: number): number {
  return Math.max(0, Math.floor(value));
}
function skill(life: LifeState, id: string): number {
  return life.character?.skills[id] ?? 0;
}

// ── Who works and who eats ──────────────────────────────────────────────────

interface Member { role: "player" | "parent" | "spouse" | "child"; labour: number; ration: number }

function isSoldier(life: LifeState): boolean {
  return life.character?.jobId === "soldier";
}
function isFarming(life: LifeState): boolean {
  return FARMING_JOB_IDS.includes(life.character?.jobId ?? "");
}
function isMarried(life: LifeState): boolean {
  return life.character?.relationshipStatus === "married";
}

/** Labour (100 = one adult) of a young household member by age. */
function youngLabour(h: HouseholdConfig, age: number): number {
  return age >= h.childWorkAge ? ADULT : age >= h.childHelpAge ? 40 : 0;
}
/** Ration share (100 = one adult) by age. */
function rationShare(h: HouseholdConfig, age: number): number {
  return age >= h.childWorkAge ? ADULT : Math.floor(ADULT * h.childRationBps / FULL);
}

/** Everyone in the household at `age`: the player, the unseen parents, spouse and children. */
function members(def: DemoDefinition, life: LifeStateWithDemo, age: number): Member[] {
  const h = def.household, household = life.demo.household, list: Member[] = [];
  const parentsRun = household.parents === "working";
  // Farming jobs work full time; without other work the player helps at home by age; a soldier is away.
  const atHome = (life.character?.jobId ?? null) === null || parentsRun;
  const playerLabour = isSoldier(life) ? 0 : isFarming(life) ? ADULT : atHome ? youngLabour(h, age) : 0;
  if (!isSoldier(life)) list.push({ role: "player", labour: playerLabour, ration: rationShare(h, age) });
  if (household.parents !== "gone") {
    const labour = parentsRun ? ADULT : Math.floor(ADULT * (h.retiredParentLabourBps ?? 0) / FULL);
    for (let i = 0; i < 2; i++) list.push({ role: "parent", labour, ration: ADULT });
  }
  if (isMarried(life)) list.push({ role: "spouse", labour: ADULT, ration: ADULT });
  for (const child of life.character?.children ?? []) {
    const childAge = Math.max(0, age - child.birthAge);
    list.push({ role: "child", labour: youngLabour(h, childAge), ration: rationShare(h, childAge) });
  }
  return list;
}

/** Household labour units working the plot (100 = one adult). Used by service and works. */
export function labourUnits(def: DemoDefinition, life: LifeState): number {
  return labourAt(def, life as LifeStateWithDemo, life.age);
}
/** Number of people eating from the household store this year (a soldier eats army rations). */
export function mouths(def: DemoDefinition, life: LifeState): number {
  return members(def, life as LifeStateWithDemo, life.age).length;
}
function labourAt(def: DemoDefinition, life: LifeStateWithDemo, age: number): number {
  return members(def, life, age).reduce((sum, member) => sum + member.labour, 0);
}
/** Grain the people of the household eat in a year. */
function peopleRation(def: DemoDefinition, life: LifeStateWithDemo, age: number): number {
  const shares = members(def, life, age).reduce((sum, member) => sum + member.ration, 0);
  return Math.floor(def.household.adultRation * shares / ADULT);
}
function animalRation(def: DemoDefinition, household: HouseholdState): number {
  return LIVESTOCK.reduce((sum, animal) => sum + household.animals[animal] * def.household.animalFeed[animal], 0);
}

// ── Harvest ─────────────────────────────────────────────────────────────────

interface Yield { grain: number; flax: number }

/** Grain and flax from plots × labour × flood × farming skill × ox × deed bonus. Pure. */
function expectedYield(def: DemoDefinition, life: LifeStateWithDemo, age: number): Yield {
  const h = def.household, household = life.demo.household;
  const plots = household.plots;
  if (plots <= 0) return { grain: 0, flax: 0 };
  const worked = Math.min(labourAt(def, life, age), ADULT * plots);
  const factor = (amount: number): number => {
    let value = bpsOf(amount, h.floodFactorBps[life.demo.year.flood]);
    value = bpsOf(value, FULL + skill(life, FARMING_SKILL) * h.skillBonusBps);
    if (household.animals.ox > 0) value = bpsOf(value, FULL + h.oxBonusBps);
    return bpsOf(value, FULL + household.harvestBonusBps);
  };
  const flaxPlots = Math.min(household.flaxPlots, plots);
  const share = (perPlot: number, count: number): number => Math.floor(perPlot * count * worked / (ADULT * plots));
  return { grain: whole(factor(share(h.yieldPerPlot, plots - flaxPlots))), flax: whole(factor(share(h.flaxPerPlot, flaxPlots))) };
}

/** This year's grain harvest, kept for the rent step of the same settlement only. */
const harvested = new WeakMap<object, number>();

/** Grain and flax harvest from plots × labour × flood × skill × ox. */
export function harvest(ctx: DemoContext): void {
  const household = ctx.demo.household;
  const crop = expectedYield(ctx.def, ctx.life as LifeStateWithDemo, ctx.life.age);
  household.grain += crop.grain;
  household.flax += crop.flax;
  harvested.set(ctx.demo, crop.grain);
  const flood = ctx.demo.year.flood === "normal" ? "a normal flood" : `a ${ctx.demo.year.flood} flood`;
  if (crop.grain + crop.flax === 0) ctx.journal("household-harvest", "No one could work the household plot this year; it lay fallow and brought in no harvest.");
  else ctx.journal("household-harvest", `After ${flood}, the household plot brings in a harvest of ${crop.grain} measures of grain${crop.flax ? ` and ${crop.flax} bundles of flax` : ""}.`);
  if (household.harvestBonusBps > 0) {
    ctx.journal("household-harvest-bonus", "The extra help with seed and work promised for this harvest has now been used.");
    household.harvestBonusBps = 0;
  }
}

function rentOn(def: DemoDefinition, grain: number): number {
  return bpsOf(grain, def.household.rentBps);
}

/** Tenant rent: a share of the harvest leaves the store. */
export function payRent(ctx: DemoContext): void {
  const crop = harvested.get(ctx.demo) ?? 0;
  harvested.delete(ctx.demo);
  const rent = Math.min(rentOn(ctx.def, crop), ctx.demo.household.grain);
  if (rent <= 0) return;
  ctx.demo.household.grain -= rent;
  ctx.journal("household-rent", `You hand ${rent} measures of grain to the landowner as rent for the plot.`);
}

// ── Eating and hunger ───────────────────────────────────────────────────────

function animalName(animal: string, count: number): string {
  return count === 1 ? animal : animal === "ox" ? "oxen" : `${animal}s`;
}

/** Animals eat first; an animal that cannot be fed in full dies. */
function feedAnimals(ctx: DemoContext): void {
  const household = ctx.demo.household, feed = ctx.def.household.animalFeed;
  for (const animal of LIVESTOCK) {
    let fed = 0, lost = 0;
    for (let head = 0; head < household.animals[animal]; head++) {
      if (household.grain >= feed[animal]) { household.grain -= feed[animal]; fed += 1; } else lost += 1;
    }
    if (fed > 0) ctx.journal(`household-feed-${animal}`, `Your ${animalName(animal, fed)} ${fed > 1 ? "eat" : "eats"} ${fed * feed[animal]} measures of grain.`);
    if (lost > 0) {
      household.animals[animal] -= lost;
      ctx.journal(`household-${animal}-died`, `There was not enough grain to feed every animal. ${lost} ${animalName(animal, lost)} died over the hungry months.`);
    }
  }
}

function hungerHealthLoss(h: HouseholdConfig, shortfallBps: number): number {
  return Math.min(h.hungerHealthCap, Math.ceil(shortfallBps / 1_000) * h.hungerHealthPer10Pct);
}

/** Animals then people eat; shortfall bought through `buyForHousehold`; hunger otherwise. */
export function feedHousehold(ctx: DemoContext): void {
  const household = ctx.demo.household, life = ctx.life as LifeStateWithDemo;
  const need = peopleRation(ctx.def, life, life.age), animalNeed = animalRation(ctx.def, household);
  const missing = need + animalNeed - household.grain;
  if (missing > 0) {
    const cash = life.economy?.cash ?? 0;
    const bought = cash > 0 ? whole(buyForHousehold(ctx, missing)) : 0;
    if (bought > 0) ctx.journal("household-bought-grain", `The store ran short, so the household bought ${bought} measures of grain from the merchant.`);
  }
  feedAnimals(ctx);
  const eaten = Math.min(need, household.grain);
  household.grain -= eaten;
  if (eaten > 0) ctx.journal("household-eat", `The household eats ${eaten} measures of grain from the store this year.`);
  household.lastShortfallBps = need > 0 ? Math.floor((need - eaten) * FULL / need) : 0;
  if (household.lastShortfallBps === 0) return;
  const loss = hungerHealthLoss(ctx.def.household, household.lastShortfallBps);
  ctx.journal("household-hunger", `The household goes hungry: ${need - eaten} measures of grain were missing from what everyone needed to eat.${loss ? " Everyone is weaker for it." : ""}`);
  if (loss > 0) ctx.apply([{ type: "stat", stat: ctx.world.health?.stat ?? "health", delta: -loss }]);
}

// ── Spoilage and spinning ───────────────────────────────────────────────────

function storeCapacity(def: DemoDefinition, life: LifeStateWithDemo): number {
  const dealer = life.character?.jobId === "grain-dealer" ? def.household.dealerExtraCapacity ?? 0 : 0;
  return life.demo.household.capacity + dealer;
}

/** Grain lost to spoilage from a store holding `grain`. Pure. */
function spoilageOf(def: DemoDefinition, life: LifeStateWithDemo, grain: number): number {
  const h = def.household, capacity = storeCapacity(def, life);
  const within = Math.min(grain, capacity), over = Math.max(0, grain - capacity);
  const reckoningCut = Math.min(h.reckoningSpoilageCutCapBps ?? 0, skill(life, "reckoning") * (h.reckoningSpoilageCutBpsPerPoint ?? 0));
  const cut = Math.min(FULL, reckoningCut + spoilageCutBps(def, life.demo));
  const loss = bpsOf(within, h.spoilageBps) + bpsOf(over, h.overCapacitySpoilageBps);
  return Math.min(grain, loss - bpsOf(loss, cut));
}

function spareLabour(def: DemoDefinition, life: LifeStateWithDemo, age: number): number {
  return Math.max(0, labourAt(def, life, age) - ADULT * life.demo.household.plots);
}

/** Linen bolts that spare labour could spin from the flax in store. Pure. */
function spinnable(def: DemoDefinition, life: LifeStateWithDemo, age: number, flax: number): number {
  const h = def.household;
  if (h.flaxPerLinen <= 0) return 0;
  const byLabour = Math.floor(spareLabour(def, life, age) * (h.spinBoltsPer100Labour ?? 10) / ADULT);
  return Math.min(byLabour, Math.floor(flax / h.flaxPerLinen));
}

/** Spoilage and over-capacity loss; spinning flax into linen with spare labour. */
export function spoilAndSpin(ctx: DemoContext): void {
  const life = ctx.life as LifeStateWithDemo, household = ctx.demo.household;
  const spoiled = spoilageOf(ctx.def, life, household.grain);
  if (spoiled > 0) {
    household.grain -= spoiled;
    const over = household.grain + spoiled > storeCapacity(ctx.def, life) ? " The store was overfull, so more of it spoiled." : "";
    ctx.journal("household-spoilage", `${spoiled} measures of stored grain spoil over the year.${over}`);
  }
  const bolts = spinnable(ctx.def, life, life.age, household.flax);
  if (bolts > 0) {
    household.flax -= bolts * ctx.def.household.flaxPerLinen;
    ctx.demo.goods.linen += bolts;
    ctx.journal("household-spinning", `In the quiet season the household spins ${bolts * ctx.def.household.flaxPerLinen} bundles of flax into ${bolts} bolts of linen.`);
  }
}

// ── Family stages ───────────────────────────────────────────────────────────

function giveMarriageGift(ctx: DemoContext): void {
  if (!isMarried(ctx.life) || ctx.life.journal.some(entry => entry.id === MARRIAGE_GIFT_ID)) return;
  const gift = ctx.def.household.marriageGift;
  if (gift.quantity <= 0) return;
  if (gift.item === "grain") {
    // The gift comes out of the spouse's family's share of the town's grain, so grain stays closed.
    const quantity = Math.min(gift.quantity, ctx.demo.town.grower.grain);
    ctx.demo.town.grower.grain -= quantity;
    ctx.demo.household.grain += quantity;
    ctx.journal(MARRIAGE_GIFT_ID, `Your spouse's family sends a marriage gift of ${quantity} measures of grain from their own harvest.`);
    return;
  }
  ctx.demo.goods[gift.item] += gift.quantity;
  ctx.journal(MARRIAGE_GIFT_ID, `Your spouse's family sends a marriage gift of ${gift.quantity} ${gift.item} from outside the household.`);
}

/** Parents hand over, retire and pass; called once per settled year. */
export function advanceFamily(ctx: DemoContext): void {
  const h = ctx.def.household, household = ctx.demo.household, age = ctx.life.age;
  if (household.parents === "working" && (isMarried(ctx.life) || age >= h.handOverAge)) {
    household.parents = "retired";
    household.headSinceAge = age;
    ctx.journal("household-hand-over", isMarried(ctx.life)
      ? `With your marriage, your parents hand the household plot to you. ${h.retiredParentLabourBps ? "They still help with lighter field work and eat from the store." : "They stop working the fields but still eat from the store."}`
      : `Your parents hand the household plot to you. ${h.retiredParentLabourBps ? "They still help with lighter field work and eat from the store." : "They stop working the fields but still eat from the store."}`);
  } else if (household.parents === "retired" && household.headSinceAge !== null && age >= household.headSinceAge + h.parentsStopEatingAfterYears) {
    household.parents = "gone";
    ctx.journal("household-parents-gone", "Your parents' last years pass quietly at home. The household mourns them, and now only your own family eats from the store.");
  }
  giveMarriageGift(ctx);
}

/** Free planting plan; throws when invalid. */
export function applyPlan(ctx: DemoContext, command: PlanCommand): void {
  const plots = ctx.demo.household.plots, flaxPlots = command.flaxPlots;
  if (!Number.isSafeInteger(flaxPlots) || flaxPlots < 0) throw new Error("The number of flax plots must be a whole number of zero or more.");
  if (flaxPlots > plots) throw new Error(`You cannot plant flax on ${flaxPlots} plots: the household has only ${plots}.`);
  if (flaxPlots === ctx.demo.household.flaxPlots) return;
  ctx.demo.household.flaxPlots = flaxPlots;
  ctx.journal("household-plan", flaxPlots === 0
    ? "You plan to sow every plot with grain."
    : `You plan to sow ${flaxPlots} of ${plots} plots with flax and the rest with grain.`);
}

// ── Read-only view ──────────────────────────────────────────────────────────

export interface HouseholdView {
  grain: number; capacity: number; plots: number; flaxPlots: number; flax: number; linen: number;
  animals: HouseholdState["animals"]; mouths: number; labour: number;
  expectedHarvest: number; expectedRent: number; expectedEating: number; expectedSpoilage: number;
  /** Flax bundles the coming harvest should bring. */
  expectedFlax: number;
  shortfallBps: number; headOfPlot: boolean; parents: HouseholdState["parents"];
}

/**
 * The coming settlement as it would run now (it settles at the next age, under this year's flood).
 * Pure: never changes the life and never draws randomness. Market purchases are not predicted.
 */
export function householdView(def: DemoDefinition, life: LifeStateWithDemo): HouseholdView {
  const h = life.demo.household, age = life.age + 1;
  const crop = expectedYield(def, life, age);
  const expectedRent = rentOn(def, crop.grain);
  const expectedEating = peopleRation(def, life, age) + animalRation(def, h);
  const afterEating = Math.max(0, h.grain + crop.grain - expectedRent - expectedEating);
  return { grain: h.grain, capacity: storeCapacity(def, life), plots: h.plots, flaxPlots: h.flaxPlots, flax: h.flax, linen: life.demo.goods.linen,
    animals: { ...h.animals }, mouths: members(def, life, age).length, labour: labourAt(def, life, age),
    expectedHarvest: crop.grain, expectedRent, expectedEating, expectedSpoilage: spoilageOf(def, life, afterEating), expectedFlax: crop.flax,
    shortfallBps: h.lastShortfallBps, headOfPlot: h.headSinceAge !== null, parents: h.parents };
}
