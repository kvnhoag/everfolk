/**
 * Track C — wages and rations from the army purse, escort assignment, contract deliveries and convoy
 * resolution. Every grain and cash movement is a transfer between named accounts; only convoy losses
 * and the soldier's eaten ration leave the economy.
 *
 * Household contract: a serving soldier eats army rations, so track A must not count the player as a
 * household mouth (or as plot labour) in a year where `servingThisYear(life)` is true.
 */
import type { Choice, LifeState, Outcome } from "../types.ts";
import type { ArmyLevel, DemoContext, DemoDefinition, DemoEffect, DemoState, LifeStateWithDemo, Shipment, TownDecision } from "./contracts.ts";
import { SERVICE_JOBS } from "./types.ts";
import { matchesCondition } from "../conditions.ts";
import { changeReputation } from "./works.ts";
import { townDecision } from "./agents.ts";
import { CONVOY_MUSTER_EVENT_ID, CONVOY_ROAD_EVENT_ID, RISK_REASONS, SERVICE_CONTENT } from "./content/service.ts";

const BPS = 10_000;
const UNIT = "dr";
const WAGE_JOURNAL_ID = "army-wages";

/** Optional service tuning with the defaults used when a world leaves them out. */
function tuning(def: DemoDefinition) {
  const s = def.service;
  return {
    escortBonus: s.escortBonus ?? 40, escortChanceBps: s.escortChanceBps ?? 5000, escortPressureBps: s.escortPressureBps ?? 2500,
    provisionCutBps: s.provisionCutBps ?? 1000, companionCutBps: s.companionCutBps ?? 600, maxCompanions: s.maxCompanions ?? 2,
    rationHealthLoss: s.rationHealthLoss ?? 4, wageShortReputation: s.wageShortReputation ?? -1,
    withdrawReputation: s.withdrawReputation ?? -3, deliveryReputation: s.deliveryReputation ?? 2,
  };
}

/** Exact `floor(amount × bps / 10 000)` without overflowing for large whole amounts. */
function shareOf(amount: number, bps: number): number {
  return Math.floor(amount / BPS) * bps + Math.floor((amount % BPS) * bps / BPS);
}

function unit(ctx: DemoContext): string {
  return ctx.world.economy?.currency.short ?? UNIT;
}

/** True while the player serves; they eat army rations and are not a household mouth that year. */
export function servingThisYear(life: LifeState): boolean {
  return (SERVICE_JOBS as readonly string[]).includes(life.character?.jobId ?? "");
}

/** The year's wage: the rule wage for the army level plus an in-limit agent premium (never negative). */
export function wageFor(def: DemoDefinition, army: ArmyLevel, decision: TownDecision | null | undefined): number {
  const premium = decision?.kind === "wage" ? Math.max(0, Math.min(def.agents.maxWagePremiumBps, decision.premiumBps)) : 0;
  return shareOf(def.service.wage[army], BPS + premium);
}

// ── Wages and rations ───────────────────────────────────────────────────────

function paidThisYear(life: LifeState): boolean {
  return life.journal.some(entry => entry.id === WAGE_JOURNAL_ID && entry.age === life.age);
}

function feedFromArmy(ctx: DemoContext): void {
  const { def, demo } = ctx, ration = def.service.ration, army = demo.town.army;
  if (ration <= 0) return;
  const eaten = Math.min(ration, army.grain);
  army.grain -= eaten;
  const missing = ration - eaten;
  if (missing === 0) return;
  const loss = Math.ceil(tuning(def).rationHealthLoss * missing / ration);
  if (loss > 0) ctx.apply([{ type: "stat", stat: ctx.world.health?.stat ?? "health", delta: -loss }]);
  ctx.journal("army-ration-shortfall", `The army stores run short: you receive ${eaten} of your ${ration} measures of rations and go hungry on duty.`);
}

/** Soldiers are paid from the purse (partial when short) and fed from army grain. Once per year. */
export function payWages(ctx: DemoContext): void {
  const { life, demo, def } = ctx;
  if (!servingThisYear(life) || paidThisYear(life)) return;
  const army = demo.town.army, money = unit(ctx);
  const wage = wageFor(def, demo.year.army, townDecision(ctx, "army"));
  const paid = Math.min(wage, army.purse);
  army.purse -= paid;
  if (paid > 0) ctx.apply([{ type: "cash", delta: paid }]);
  ctx.journal(WAGE_JOURNAL_ID, `The quartermaster pays ${paid} ${money} of your ${wage} ${money} wage from the army purse.`);
  if (paid < wage) {
    ctx.journal("army-wage-shortfall", `The army purse is short: ${wage - paid} ${money} of your wage goes unpaid this year.`);
    changeReputation(ctx, tuning(def).wageShortReputation, "the army could not pay its soldiers in full");
  }
  feedFromArmy(ctx);
}

// ── Shipments ───────────────────────────────────────────────────────────────

/**
 * Scheduled events may occur only once (validator rule), so a new shipment re-arms the muster and road
 * anchors by clearing their counts. Their journal entries keep the full history.
 */
function openShipment(ctx: DemoContext, shipment: Shipment): void {
  ctx.demo.shipment = shipment;
  delete ctx.life.eventCounts[CONVOY_MUSTER_EVENT_ID];
  delete ctx.life.eventCounts[CONVOY_ROAD_EVENT_ID];
}

function newShipment(kind: Shipment["kind"], cargo: number, pay: number): Shipment {
  return { kind, cargo, pay, stage: "muster", provisions: false, companions: 0, riskCutBps: 0 };
}

export function escortChanceBps(def: DemoDefinition, year: DemoState["year"]): number {
  const t = tuning(def);
  const army = year.army === "quiet" ? 0 : t.escortPressureBps;
  const road = year.road === "dangerous" ? t.escortPressureBps : year.road === "uneasy" ? Math.floor(t.escortPressureBps / 2) : 0;
  return Math.min(BPS, t.escortChanceBps + army + road);
}

/** Age from which the next escort can be assigned. */
function nextEscortAge(def: DemoDefinition, demo: DemoState, age: number): number {
  return demo.lastEscortAge === null ? age : Math.max(age, demo.lastEscortAge + def.service.escortCooldownYears);
}

/** Assigns an escort shipment to a soldier when the cooldown allows; cargo is real army grain. */
export function assignConvoy(ctx: DemoContext): void {
  const { life, demo, def } = ctx;
  if (!servingThisYear(life) || demo.shipment || nextEscortAge(def, demo, life.age) > life.age) return;
  const cargo = Math.min(def.service.escortCargo, demo.town.army.grain);
  if (cargo <= 0) return;
  if (ctx.random() * BPS >= escortChanceBps(def, demo.year)) return;
  demo.town.army.grain -= cargo;
  demo.lastEscortAge = life.age;
  openShipment(ctx, newShipment("escort", cargo, tuning(def).escortBonus));
  ctx.journal("convoy-assigned", `You are ordered to escort ${cargo} measures of army grain along the supply road.`);
}

function sellDirectly(ctx: DemoContext, quantity: number, price: number): number {
  const { demo } = ctx, army = demo.town.army, money = unit(ctx);
  const sold = Math.min(quantity, Math.floor(army.purse / price));
  if (sold === 0) throw new Error("The army purse cannot pay for any grain this year.");
  const pay = sold * price;
  demo.household.grain -= sold;
  army.grain += sold;
  army.purse -= pay;
  ctx.apply([{ type: "cash", delta: pay }]);
  ctx.journal("army-sale", `The road is safe, so the delivery is routine: ${sold} measures go to the army for ${pay} ${money} from its purse.`);
  if (sold < quantity) ctx.journal("army-sale-partial", `The army purse could pay for only ${sold} of the ${quantity} measures; the rest stays in your store.`);
  return sold;
}

/**
 * A grain dealer's army sale. Moves the grain itself (callers must not), returns the quantity committed.
 * Safe road: settles directly, limited by the army purse. Otherwise the grain leaves the store in a
 * contract shipment and is paid for on delivery. Throws, changing nothing, when the sale is invalid.
 */
export function startContractShipment(ctx: DemoContext, quantity: number, price: number): number {
  const { demo } = ctx;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("Contract quantity must be a positive whole number.");
  if (!Number.isSafeInteger(price) || price <= 0) throw new Error("Contract price must be a positive whole number.");
  if (demo.shipment) throw new Error("A convoy is already under way; the army takes one delivery at a time.");
  if (quantity > demo.household.grain) throw new Error(`Not enough grain in the store (${demo.household.grain} measures).`);
  if (demo.year.road === "safe") return sellDirectly(ctx, quantity, price);
  demo.household.grain -= quantity;
  openShipment(ctx, newShipment("contract", quantity, price));
  ctx.journal("convoy-contract", `The road is ${demo.year.road}, so your ${quantity} measures leave the store as a convoy. The army pays ${price} ${unit(ctx)} a measure on delivery.`);
  return quantity;
}

// ── Convoy effects ──────────────────────────────────────────────────────────

function cutBps(def: DemoDefinition, ship: Shipment): number {
  const t = tuning(def);
  return ship.riskCutBps + (ship.provisions ? t.provisionCutBps : 0) + ship.companions * t.companionCutBps;
}

function effectiveLossBps(def: DemoDefinition, demo: DemoState, ship: Shipment, lossBps: number | undefined, cut = cutBps(def, ship)): number {
  const base = Math.min(BPS, lossBps ?? def.service.roadLossBps[demo.year.road]);
  return Math.max(0, base - cut);
}

function withdraw(ctx: DemoContext, ship: Shipment): void {
  const { demo } = ctx;
  if (ship.kind === "escort") demo.town.army.grain += ship.cargo;
  else demo.household.grain += ship.cargo;
  demo.shipment = null;
  ctx.journal("convoy-withdrawn", ship.kind === "escort"
    ? `You refuse the escort. The ${ship.cargo} measures go back into the army stores.`
    : `You withdraw from the army contract. The ${ship.cargo} measures go back into your store.`);
  changeReputation(ctx, tuning(ctx.def).withdrawReputation, ship.kind === "escort" ? "refusing an escort" : "abandoning an army contract");
}

function payDelivery(ctx: DemoContext, ship: Shipment, delivered: number): void {
  const army = ctx.demo.town.army, money = unit(ctx);
  const due = ship.kind === "contract" ? delivered * ship.pay : Math.floor(ship.pay * delivered / ship.cargo);
  const paid = Math.min(due, army.purse);
  army.purse -= paid;
  if (paid > 0) ctx.apply([{ type: "cash", delta: paid }]);
  if (paid > 0) ctx.journal("convoy-paid", ship.kind === "contract"
    ? `The army pays ${paid} ${money} from its purse for ${delivered} measures delivered.`
    : `The quartermaster pays you ${paid} ${money} for the escort.`);
  if (paid < due) ctx.journal("convoy-pay-shortfall", `The army purse is short: ${due - paid} ${money} owed for the convoy goes unpaid.`);
}

function resolve(ctx: DemoContext, ship: Shipment, lossBps: number | undefined): void {
  const { demo, def, life } = ctx;
  const lost = shareOf(ship.cargo, effectiveLossBps(def, demo, ship, lossBps));
  const delivered = ship.cargo - lost;
  demo.town.army.grain += delivered;
  demo.shipment = null;
  demo.lastEscortAge = life.age;
  if (lost > 0) ctx.journal("convoy-loss", `${lost} measures of grain are lost on the road.`);
  ctx.journal("convoy-delivered", `${delivered} of ${ship.cargo} measures reach the army stores.`);
  payDelivery(ctx, ship, delivered);
  if (lost === 0 && delivered > 0) changeReputation(ctx, tuning(def).deliveryReputation, "a convoy delivered whole");
}

/**
 * Applies one convoy step. With no shipment pending it does nothing, so a repeated or late effect can
 * never move grain or pay twice. `riskCutBps` on any action (for example a guard-road deed) adds to the
 * shipment's standing cut before the action runs.
 */
export function applyConvoy(ctx: DemoContext, effect: Extract<DemoEffect, { kind: "convoy" }>): void {
  const ship = ctx.demo.shipment;
  if (!ship) return;
  if (effect.riskCutBps) ship.riskCutBps = Math.min(BPS, ship.riskCutBps + effect.riskCutBps);
  switch (effect.action) {
    case "provision": ship.provisions = true; break;
    case "companion": ship.companions = Math.min(tuning(ctx.def).maxCompanions, ship.companions + 1); break;
    case "depart": ship.stage = "road"; break;
    case "withdraw": withdraw(ctx, ship); break;
    case "resolve": resolve(ctx, ship, effect.lossBps); break;
  }
}

// ── Views (pure: no mutation, no randomness) ────────────────────────────────

export interface ServiceView {
  serving: boolean; wage: number; ration: number; purse: number; armyGrain: number; reputation: number;
  readiness: string[]; shipment: Shipment | null; nextEscortAge: number | null;
}

export function serviceView(def: DemoDefinition, life: LifeStateWithDemo): ServiceView {
  const demo = life.demo, serving = servingThisYear(life), army = demo.town.army;
  const wage = wageFor(def, demo.year.army, demo.agents.pending.army);
  const warfare = life.character?.skills.warfare ?? 0, min = def.service.distinctionMinWarfare;
  const readiness = [
    serving ? `Wage this year: ${wage} ${UNIT} from an army purse of ${army.purse} ${UNIT}.` : "Not serving: no army wage or rations.",
    warfare >= min ? "Trained enough to lead an escort through a dangerous road for distinction."
      : `Warfare ${warfare} of ${min} needed to lead an escort through a dangerous road for distinction.`,
  ];
  return {
    serving, wage: serving ? wage : 0, ration: serving ? def.service.ration : 0, purse: army.purse, armyGrain: army.grain,
    reputation: demo.reputation, readiness, shipment: demo.shipment ? { ...demo.shipment } : null,
    nextEscortAge: serving ? nextEscortAge(def, demo, life.age) : null,
  };
}

export interface ConvoyRoute { choice: string; text: string; available: boolean; expectedLossBps: number; leastLossBps: number }
export interface ConvoyPreview {
  knownCosts: string[]; expectedLossBps: number; riskFactors: { label: string; effectBps: number }[]; routes: ConvoyRoute[];
}

const ROAD_CHOICES: readonly Choice[] = SERVICE_CONTENT.events!.find(event => event.id === CONVOY_ROAD_EVENT_ID)!.choices;
const PUSH_THROUGH = ROAD_CHOICES[0];

function outcomeLossBps(outcome: Outcome): number | undefined {
  for (const effect of outcome.effects) if (effect.type === "demo" && effect.effect.kind === "convoy" && effect.effect.action === "resolve") return effect.effect.lossBps;
  return undefined;
}

/** Same weights the engine uses for these outcomes; `ignore` drops one reason to measure its effect. */
function outcomeWeight(life: LifeState, outcome: Outcome, ignore?: string): number {
  let weight = outcome.weight;
  for (const modifier of outcome.weightModifiers ?? []) {
    if (modifier.reason !== ignore && matchesCondition(modifier.when, life)) weight *= modifier.multiplier;
  }
  return weight;
}

function expectedLoss(def: DemoDefinition, life: LifeStateWithDemo, ship: Shipment, choice: Choice, ignore?: string, cut?: number): number {
  const weights = choice.outcomes.map(outcome => outcomeWeight(life, outcome, ignore));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return choice.outcomes.reduce((sum, outcome, i) =>
    sum + weights[i] / total * effectiveLossBps(def, life.demo, ship, outcomeLossBps(outcome), cut), 0);
}

function riskFactors(def: DemoDefinition, life: LifeStateWithDemo, ship: Shipment): ConvoyPreview["riskFactors"] {
  const t = tuning(def), all = expectedLoss(def, life, ship, PUSH_THROUGH), cut = cutBps(def, ship);
  const factors: ConvoyPreview["riskFactors"] = [];
  for (const reason of Object.values(RISK_REASONS)) {
    const effectBps = Math.round(all - expectedLoss(def, life, ship, PUSH_THROUGH, reason));
    if (effectBps !== 0) factors.push({ label: reason, effectBps });
  }
  const parts: [string, number][] = [
    ["Extra provisions", ship.provisions ? t.provisionCutBps : 0],
    [`Companions riding along (${ship.companions})`, ship.companions * t.companionCutBps],
    ["A road patrol from an earlier life", ship.riskCutBps],
  ];
  for (const [label, part] of parts) {
    if (part === 0) continue;
    const effectBps = Math.round(all - expectedLoss(def, life, ship, PUSH_THROUGH, undefined, cut - part));
    if (effectBps !== 0) factors.push({ label, effectBps });
  }
  return factors;
}

function knownCosts(def: DemoDefinition, life: LifeStateWithDemo, ship: Shipment, routes: ConvoyRoute[]): string[] {
  const t = tuning(def), percent = (bps: number) => `${Math.round(bps / 100)}%`;
  const costs = [ship.kind === "contract"
    ? `Cargo: ${ship.cargo} measures of your grain; the army pays ${ship.pay} ${UNIT} a measure delivered, from a purse of ${life.demo.town.army.purse} ${UNIT}.`
    : `Cargo: ${ship.cargo} measures of army grain; the escort pays up to ${ship.pay} ${UNIT}.`];
  if (ship.stage === "muster" && !ship.provisions) costs.push(`Extra provisions cost ${def.service.provisionsCost} ${UNIT} and cut any loss by ${percent(t.provisionCutBps)}.`);
  costs.push(`If raiders win, this year's road takes about ${percent(effectiveLossBps(def, life.demo, ship, undefined))} of the cargo.`);
  for (const route of routes) if (route.choice !== PUSH_THROUGH.id && route.available && route.leastLossBps > 0) {
    costs.push(`${route.text}: at least ${percent(route.leastLossBps)} of the cargo is lost whatever happens.`);
  }
  return costs;
}

/** Read-only risk preview for the pending shipment; null when there is none. */
export function convoyPreview(def: DemoDefinition, life: LifeStateWithDemo): ConvoyPreview | null {
  const ship = life.demo.shipment;
  if (!ship) return null;
  const routes = ROAD_CHOICES.map(choice => ({
    choice: choice.id, text: choice.text, available: matchesCondition(choice.when, life),
    expectedLossBps: Math.round(expectedLoss(def, life, ship, choice)),
    leastLossBps: Math.min(...choice.outcomes.map(outcome => effectiveLossBps(def, life.demo, ship, outcomeLossBps(outcome)))),
  }));
  return { knownCosts: knownCosts(def, life, ship, routes), expectedLossBps: routes[0].expectedLossBps, riskFactors: riskFactors(def, life, ship), routes };
}
