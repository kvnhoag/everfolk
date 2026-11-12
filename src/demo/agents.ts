import { farmSaleReason } from "../capabilities/farming.ts";
/** Track F — agent decisions, offers, delegation and credits. The engine never talks to the network. */
import type { Command, LifeState } from "../types.ts";
import type {
  AgentCommand, AgentState, AssignAgentsCommand, DelegateCommand, DemoContext, DemoDefinition, DemoEffect, DemoState,
  LifeStateWithDemo, Offer, OfferKind, TownDecision, TownRole, TradeCommand, TradeItem,
} from "./contracts.ts";
import { GOODS, LIVESTOCK, OFFERS, SERVICE_JOBS, TOWN_ROLES, TRADE_ITEMS } from "./types.ts";
import { offerEventId } from "./content/agents.ts";

const BPS = 10_000;

/**
 * Journal id the market writes when the household buys its shortfall grain during settlement
 * (`buyForHousehold`). `closeAgentYear` reads it to credit the merchant and grower agents.
 */
export const HOUSEHOLD_PURCHASE_JOURNAL_ID = "household-grain-purchase";

export interface Range { min: number; max: number }

type Side = "buy" | "sell";
interface OfferRule { roles: readonly TownRole[]; items: readonly TradeItem[]; side: Side }

/** Which roles may make each offer, for which items, and which merchant quote bounds its price. */
const OFFER_RULES: Record<OfferKind, OfferRule> = {
  "grain-contract": { roles: TOWN_ROLES, items: ["grain"], side: "buy" },
  "seed-credit": { roles: TOWN_ROLES, items: ["grain"], side: "sell" },
  "convoy-job": { roles: TOWN_ROLES, items: ["grain"], side: "buy" },
  "goods-deal": { roles: ["merchant"], items: [...GOODS, ...LIVESTOCK, "flax"], side: "sell" },
};

const ROLE_LABEL: Record<TownRole, string> = { merchant: "the merchant", grower: "the grower", army: "the army supplier" };
const OFFER_LABEL: Record<OfferKind, string> = { "grain-contract": "grain contract", "seed-credit": "seed credit", "convoy-job": "convoy job", "goods-deal": "goods deal" };
const ITEM_LABEL: Record<TradeItem, [string, string]> = {
  grain: ["measure of grain", "measures of grain"], flax: ["bundle of flax", "bundles of flax"],
  silver: ["unit of silver", "units of silver"], gold: ["unit of gold", "units of gold"],
  silk: ["bolt of Coan silk", "bolts of Coan silk"], linen: ["bolt of linen", "bolts of linen"],
  ox: ["ox", "oxen"], donkey: ["donkey", "donkeys"],
};

function capitalised(text: string): string { return text.charAt(0).toUpperCase() + text.slice(1); }
function items(item: TradeItem, quantity: number): string { return `${quantity} ${ITEM_LABEL[item][quantity === 1 ? 0 : 1]}`; }
function within(value: number, range: Range): boolean { return value >= range.min && value <= range.max; }
function rangeText(range: Range): string { return range.min > range.max ? "none" : `${range.min}–${range.max}`; }
function runBy(role: TownRole, agent: string | null): string { return agent ? `${capitalised(ROLE_LABEL[role])} (agent ${agent})` : capitalised(ROLE_LABEL[role]); }
function offerMadeId(role: TownRole): string { return `agent-offer-made-${role}`; }

// ── Limits (pure) ────────────────────────────────────────────────────────────

/**
 * A price an agent may set around a rule quote: `priceBandBps` either way, at least one drachma
 * (prices are whole drachmas), never below 1 or above the market ceiling for the item.
 */
function priceBand(def: DemoDefinition, item: TradeItem, quote: number): Range {
  const step = Math.max(1, Math.floor(quote * def.agents.priceBandBps / BPS));
  const ceiling = Math.max(1, Math.floor(def.market.basePrice[item] * def.market.priceCeilingBps / BPS));
  return { min: Math.max(1, quote - step), max: Math.min(ceiling, quote + step) };
}

export interface AgentDecisionLimits {
  /** Roles that already have a decision waiting for this year's settlement. */
  decided: TownRole[];
  /** Roles that already made an offer this year. */
  offered: TownRole[];
  merchant: { grainBuy: Range; grainSell: Range };
  grower: { releaseBps: Range };
  army: { wagePremiumBps: Range };
  offers: {
    open: boolean;
    quantity: Range;
    kinds: Record<OfferKind, { roles: TownRole[]; items: TradeItem[]; side: Side }>;
    /** Allowed offer price per item; `buy` when the role pays the player, `sell` when the player pays. */
    prices: Record<TradeItem, { buy: Range; sell: Range }>;
  };
}

/** Current allowed ranges per role, for the relay and the reference agent. Pure: never changes the life. */
export function AGENT_DECISION_LIMITS(def: DemoDefinition, life: LifeStateWithDemo): AgentDecisionLimits {
  const { demo } = life;
  const prices = Object.fromEntries(TRADE_ITEMS.map(item => [item, {
    buy: priceBand(def, item, demo.town.prices[item].buy), sell: priceBand(def, item, demo.town.prices[item].sell),
  }])) as AgentDecisionLimits["offers"]["prices"];
  return {
    decided: TOWN_ROLES.filter(role => demo.agents.pending[role] !== undefined),
    offered: TOWN_ROLES.filter(role => life.journal.some(entry => entry.age === life.age && entry.id === offerMadeId(role))),
    merchant: { grainBuy: prices.grain.buy, grainSell: prices.grain.sell },
    grower: { releaseBps: { ...def.agents.growerReleaseBps } },
    army: { wagePremiumBps: { min: 0, max: def.agents.maxWagePremiumBps } },
    offers: {
      open: demo.offer !== null,
      quantity: { ...def.agents.offerQuantity },
      kinds: Object.fromEntries(OFFERS.map(kind => [kind, { roles: [...OFFER_RULES[kind].roles], items: [...OFFER_RULES[kind].items], side: OFFER_RULES[kind].side }])) as AgentDecisionLimits["offers"]["kinds"],
      prices,
    },
  };
}

// ── Town accounts ────────────────────────────────────────────────────────────

function roleCash(demo: DemoState, role: TownRole): number {
  return role === "army" ? demo.town.army.purse : demo.town[role].cash;
}
function addRoleCash(demo: DemoState, role: TownRole, delta: number): void {
  if (role === "army") demo.town.army.purse += delta;
  else demo.town[role].cash += delta;
}
function merchantStock(demo: DemoState, item: TradeItem): number {
  const merchant = demo.town.merchant;
  if (item === "grain") return merchant.grain;
  if (item === "flax") return merchant.flax;
  if (item === "ox" || item === "donkey") return merchant.animals[item];
  return merchant.goods[item];
}
/** Moves a good, animal or flax from the merchant to the household. */
function moveFromMerchant(demo: DemoState, item: TradeItem, quantity: number): void {
  const merchant = demo.town.merchant;
  if (item === "flax") { merchant.flax -= quantity; demo.household.flax += quantity; }
  else if (item === "ox" || item === "donkey") { merchant.animals[item] -= quantity; demo.household.animals[item] += quantity; }
  else if (item !== "grain") { merchant.goods[item] -= quantity; demo.goods[item] += quantity; }
}
function isSoldier(life: LifeState): boolean {
  return (SERVICE_JOBS as readonly string[]).includes(life.character?.jobId ?? "");
}

// ── Validation ───────────────────────────────────────────────────────────────

function checkAssigned(demo: DemoState, command: AgentCommand): void {
  if (command.role === "player") {
    if (demo.agents.player === null || demo.agents.player !== command.agent) throw new Error(`${command.agent} is not playing this life.`);
    return;
  }
  if (demo.agents.assigned[command.role] !== command.agent) throw new Error(`${command.agent} is not assigned to the ${command.role} role.`);
}

/** Only the engine commands an auto-play agent may issue; trade and plan are parsed again by the engine. */
function checkInnerCommand(command: unknown): void {
  const value = command as Record<string, unknown> | null;
  const fields = value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
  const allowed = value !== null && fields.length > 0 && (
    value.type === "advance" && fields.length === 1 ||
    value.type === "choose" && typeof value.choice === "string" && fields.length === 2 ||
    value.type === "act" && typeof value.activity === "string" && fields.length === 2 ||
    value.type === "trade" || value.type === "plan");
  if (!allowed) throw new Error("An agent cannot issue that command for the player.");
}

function checkPrices(ctx: DemoContext, decision: Extract<TownDecision, { kind: "prices" }>): void {
  const limits = AGENT_DECISION_LIMITS(ctx.def, ctx.life as LifeStateWithDemo).merchant;
  if (!within(decision.grainBuy, limits.grainBuy)) throw new Error(`Grain buying price ${decision.grainBuy} is outside the allowed ${rangeText(limits.grainBuy)} drachmas.`);
  if (!within(decision.grainSell, limits.grainSell)) throw new Error(`Grain selling price ${decision.grainSell} is outside the allowed ${rangeText(limits.grainSell)} drachmas.`);
  if (decision.grainSell < decision.grainBuy) throw new Error("The selling price cannot be below the buying price.");
}

function checkOfferTerms(ctx: DemoContext, role: TownRole, decision: Extract<TownDecision, { kind: "offer" }>): void {
  const { demo, def } = ctx;
  const rule = OFFER_RULES[decision.offer];
  const label = OFFER_LABEL[decision.offer];
  if (!rule.roles.includes(role)) throw new Error(`Only the merchant deals in goods; ${ROLE_LABEL[role]} cannot offer a ${label}.`);
  if (!rule.items.includes(decision.item)) throw new Error(`A ${label} is for ${rule.items.length === 1 ? "grain" : "goods, animals or flax"}, not ${decision.item}.`);
  if (!within(decision.quantity, def.agents.offerQuantity)) throw new Error(`Offer quantity ${decision.quantity} is outside the allowed ${rangeText(def.agents.offerQuantity)}.`);
  const band = priceBand(def, decision.item, demo.town.prices[decision.item][rule.side]);
  if (!within(decision.price, band)) throw new Error(`Offer price ${decision.price} is outside the allowed ${rangeText(band)} drachmas.`);
}

function checkOfferStock(ctx: DemoContext, role: TownRole, decision: Extract<TownDecision, { kind: "offer" }>): void {
  const { demo } = ctx;
  const total = decision.quantity * decision.price;
  switch (decision.offer) {
    case "grain-contract":
      if (roleCash(demo, role) < total) throw new Error(`${capitalised(ROLE_LABEL[role])} cannot pay ${total} drachmas.`);
      break;
    case "seed-credit": {
      const grain = demo.town[role].grain;
      if (grain < decision.quantity) throw new Error(`${capitalised(ROLE_LABEL[role])} holds only ${items("grain", grain)}.`);
      break;
    }
    case "goods-deal": {
      const stock = merchantStock(demo, decision.item);
      if (stock < decision.quantity) throw new Error(`The merchant holds only ${items(decision.item, stock)}.`);
      break;
    }
    case "convoy-job":
      if (!isSoldier(ctx.life)) throw new Error("A convoy job is only for a serving soldier.");
      break;
  }
}

function checkOffer(ctx: DemoContext, role: TownRole, decision: Extract<TownDecision, { kind: "offer" }>): void {
  if (ctx.demo.offer !== null) throw new Error("There is already an open offer for the player.");
  const life = ctx.life;
  if (life.journal.some(entry => entry.age === life.age && entry.id === offerMadeId(role))) throw new Error(`${capitalised(ROLE_LABEL[role])} has already made an offer this year.`);
  checkOfferTerms(ctx, role, decision);
  checkOfferStock(ctx, role, decision);
}

/** Throws (before any change) when a town decision is outside its role's limits. */
function checkTownDecision(ctx: DemoContext, role: TownRole, decision: TownDecision): void {
  const { def, demo } = ctx;
  if (decision.kind === "offer") { checkOffer(ctx, role, decision); return; }
  if (demo.agents.pending[role] !== undefined) throw new Error(`${capitalised(ROLE_LABEL[role])} has already decided this year.`);
  switch (decision.kind) {
    case "prices":
      if (role !== "merchant") throw new Error("Only the merchant sets grain prices.");
      checkPrices(ctx, decision);
      break;
    case "release":
      if (role !== "grower") throw new Error("Only the grower decides how much of its harvest to release.");
      if (!within(decision.shareBps, def.agents.growerReleaseBps)) throw new Error(`Release share ${decision.shareBps} is outside the allowed ${rangeText(def.agents.growerReleaseBps)} basis points.`);
      break;
    case "wage":
      if (role !== "army") throw new Error("Only the army supplier sets a wage premium.");
      if (decision.premiumBps > def.agents.maxWagePremiumBps) throw new Error(`Wage premium ${decision.premiumBps} is outside the allowed 0–${def.agents.maxWagePremiumBps} basis points.`);
      break;
  }
}

// ── Commands ─────────────────────────────────────────────────────────────────

export function initialAgents(): AgentState {
  return { assigned: {}, player: null, pending: {}, credits: {} };
}

function credit(demo: DemoState, agent: string): void {
  demo.agents.credits = { ...demo.agents.credits, [agent]: (demo.agents.credits[agent] ?? 0) + 1 };
}

/** Only at age 0 before the first year (checked by the engine); a life is assigned once. */
export function assignAgents(ctx: DemoContext, command: AssignAgentsCommand): void {
  const { demo, life } = ctx;
  const earlier = life.commands.filter(item => item.type === "assign-agents").length;
  if (Object.keys(demo.agents.assigned).length > 0 || earlier > 1) throw new Error("Agents are already assigned for this life.");
  demo.agents.assigned = { ...command.agents };
  const roles = TOWN_ROLES.map(role => command.agents[role] ? `${ROLE_LABEL[role]} is run by agent ${command.agents[role]}` : `${ROLE_LABEL[role]} follows the fixed rules`);
  ctx.journal("agents-assigned", `In this life ${roles.join("; ")}.`);
}

export function delegate(ctx: DemoContext, command: DelegateCommand): void {
  const { demo } = ctx;
  const previous = demo.agents.player;
  if (command.agent === previous) throw new Error(command.agent === null ? "You are already making your own decisions." : `Agent ${command.agent} already makes your decisions.`);
  demo.agents.player = command.agent;
  ctx.journal("agent-delegate", command.agent === null
    ? `You take back your yearly decisions from agent ${previous}.`
    : `You hand your yearly decisions to agent ${command.agent}. You can take them back at any time.`);
}

function offerText(offer: Pick<Offer, "kind" | "item" | "quantity" | "price">): string {
  const total = offer.quantity * offer.price;
  switch (offer.kind) {
    case "grain-contract": return `to buy ${items("grain", offer.quantity)} from you at ${offer.price} drachmas each (${total} drachmas)`;
    case "seed-credit": return `${items("grain", offer.quantity)} on credit at ${offer.price} drachmas each (${total} drachmas of debt)`;
    case "convoy-job": return `${total} drachmas to guard ${items("grain", offer.quantity)} on the road`;
    case "goods-deal": return `to sell you ${items(offer.item, offer.quantity)} at ${offer.price} drachmas each (${total} drachmas)`;
  }
}

function journalDecision(ctx: DemoContext, role: TownRole, agent: string, decision: TownDecision): void {
  const who = runBy(role, agent);
  switch (decision.kind) {
    case "prices": ctx.journal(`agent-decision-${role}`, `${who} sets this year's grain prices: buying at ${decision.grainBuy} and selling at ${decision.grainSell} drachmas a measure.`); break;
    case "release": ctx.journal(`agent-decision-${role}`, `${who} will offer ${decision.shareBps / 100}% of its harvest on the market this year.`); break;
    case "wage": ctx.journal(`agent-decision-${role}`, `${who} adds ${decision.premiumBps / 100}% to soldiers' wages this year.`); break;
    case "offer": ctx.journal(offerMadeId(role), `${who} offers ${offerText({ kind: decision.offer, item: decision.item, quantity: decision.quantity, price: decision.price })}.`); break;
  }
}

/**
 * Accepts a decision from the assigned agent if within limits. A town decision waits in `pending`
 * for the next settlement; an offer becomes `demo.offer` (credited at once); a player command runs through
 * `run` and is credited. Throws, changing nothing, when the agent is not assigned or a limit is broken.
 */
export function applyAgentCommand(ctx: DemoContext, command: AgentCommand, run: (inner: AgentCommand["decision"] & { kind: "command" }) => void): void {
  const { demo } = ctx;
  checkAssigned(demo, command);
  const decision = command.decision;
  if (command.role === "player") {
    if (decision.kind !== "command") throw new Error("A player agent issues commands only.");
    checkInnerCommand(decision.command);
    run(decision);
    credit(demo, command.agent);
    return;
  }
  if (decision.kind === "command") throw new Error("Only the player role issues commands.");
  const role = command.role;
  checkTownDecision(ctx, role, decision);
  journalDecision(ctx, role, command.agent, decision);
  if (decision.kind === "offer") {
    demo.offer = { kind: decision.offer, role, agent: command.agent, item: decision.item, quantity: decision.quantity, price: decision.price };
    credit(demo, command.agent);
    return;
  }
  demo.agents.pending = { ...demo.agents.pending, [role]: decision };
}

/** The decision for a role this year: a pending in-limit agent decision, else the fixed rule (null). Read-only. */
export function townDecision(ctx: DemoContext, role: TownRole): TownDecision | null {
  return ctx.demo.agents.pending[role] ?? null;
}

// ── Settlement ───────────────────────────────────────────────────────────────

/** The most recent market order, made directly or by an auto-play agent. */
function lastTrade(commands: readonly Command[]): TradeCommand | undefined {
  for (let i = commands.length - 1; i >= 0; i--) {
    const command = commands[i];
    if (command.type === "trade") return command;
    if (command.type === "agent" && command.decision.kind === "command" && command.decision.command.type === "trade") return command.decision.command;
  }
  return undefined;
}

/** Roles whose decisions touched the player in the year just settled (settlement runs after the birthday). */
function touchedRoles(ctx: DemoContext): Set<TownRole> {
  const { demo, life } = ctx;
  const trade = demo.lastTradeAge === life.age - 1 ? lastTrade(life.commands) : undefined;
  const bought = life.journal.some(entry => entry.age === life.age && entry.id === HOUSEHOLD_PURCHASE_JOURNAL_ID);
  const touched = new Set<TownRole>();
  if (trade?.counterparty === "merchant" || bought) touched.add("merchant");
  if (trade?.item === "grain" && trade.side === "buy" || bought) touched.add("grower");
  if (trade?.counterparty === "army" || isSoldier(life)) touched.add("army");
  return touched;
}

/** After settlement: credits agents whose decisions touched the player, clears pending. */
export function closeAgentYear(ctx: DemoContext): void {
  const { demo } = ctx;
  const touched = touchedRoles(ctx);
  for (const role of TOWN_ROLES) {
    const agent = demo.agents.assigned[role];
    if (agent && demo.agents.pending[role] !== undefined && touched.has(role)) credit(demo, agent);
  }
  demo.agents.pending = {};
}

// ── Offers ───────────────────────────────────────────────────────────────────

/** Why the player cannot honour an accepted offer now, or undefined. */
function acceptReason(ctx: DemoContext, offer: Offer): string | undefined {
  const { demo, life } = ctx;
  const total = offer.quantity * offer.price;
  switch (offer.kind) {
    case "grain-contract":
      { const reserveReason = farmSaleReason(ctx.world, life, offer.quantity); if (reserveReason) return reserveReason; }
      if (demo.household.grain < offer.quantity) return `There is not enough grain in your store for this contract (you have ${items("grain", demo.household.grain)}).`;
      if (roleCash(demo, offer.role) < total) return `${capitalised(ROLE_LABEL[offer.role])} can no longer pay ${total} drachmas.`;
      return undefined;
    case "seed-credit":
      if (demo.town[offer.role].grain < offer.quantity) return `${capitalised(ROLE_LABEL[offer.role])} no longer holds the grain.`;
      return undefined;
    case "goods-deal":
      if ((life.economy?.cash ?? 0) < total) return `You do not have ${total} drachmas in cash.`;
      if (merchantStock(demo, offer.item) < offer.quantity) return "The merchant no longer holds the goods.";
      return undefined;
    case "convoy-job":
      if (!isSoldier(life)) return "Only a serving soldier can take a convoy job.";
      if (demo.shipment && !(demo.shipment.kind === "escort" && demo.shipment.stage === "muster")) return "You are already on the road with a convoy.";
      return undefined;
  }
}

function settleOffer(ctx: DemoContext, offer: Offer): void {
  const { demo, life } = ctx;
  const total = offer.quantity * offer.price;
  const who = ROLE_LABEL[offer.role];
  switch (offer.kind) {
    case "grain-contract":
      demo.household.grain -= offer.quantity;
      demo.town[offer.role].grain += offer.quantity;
      addRoleCash(demo, offer.role, -total);
      ctx.apply([{ type: "cash", delta: total }]);
      ctx.journal("offer-settled", `You sell ${items("grain", offer.quantity)} to ${who} at ${offer.price} drachmas each (${total} drachmas).`);
      break;
    case "seed-credit":
      demo.town[offer.role].grain -= offer.quantity;
      demo.household.grain += offer.quantity;
      ctx.apply([{ type: "debt", delta: total }]);
      ctx.journal("offer-settled", `${capitalised(who)} gives you ${items("grain", offer.quantity)} on credit at ${offer.price} drachmas each; ${total} drachmas are added to your debt.`);
      break;
    case "goods-deal":
      ctx.apply([{ type: "cash", delta: -total }]);
      addRoleCash(demo, offer.role, total);
      moveFromMerchant(demo, offer.item, offer.quantity);
      ctx.journal("offer-settled", `You buy ${items(offer.item, offer.quantity)} from the merchant at ${offer.price} drachmas each (${total} drachmas).`);
      break;
    case "convoy-job": {
      const current = demo.shipment;
      demo.shipment = current
        ? { ...current, cargo: current.cargo + offer.quantity, pay: current.pay + total }
        : { kind: "escort", cargo: offer.quantity, pay: total, stage: "muster", provisions: false, companions: 0, riskCutBps: 0 };
      demo.lastEscortAge = life.age;
      ctx.journal("offer-settled", `You agree to guard ${items("grain", offer.quantity)} for ${who} on the road, for ${total} drachmas.`);
      break;
    }
  }
}

/**
 * Answers the open offer exactly once. Accepting settles it when both sides can honour it, otherwise it
 * lapses with a journal line (a player's choice never fails). Either answer clears `demo.offer` and lets the
 * offer event come again (scheduled events occur once, so its count is reset).
 */
export function applyOffer(ctx: DemoContext, effect: Extract<DemoEffect, { kind: "offer" }>): void {
  const offer = ctx.demo.offer;
  if (!offer) return;
  ctx.demo.offer = null;
  const counts = { ...ctx.life.eventCounts };
  delete counts[offerEventId(offer.kind)];
  ctx.life.eventCounts = counts;
  const what = `the ${OFFER_LABEL[offer.kind]} from ${runBy(offer.role, offer.agent).replace(/^The /, "the ")}`;
  if (effect.action === "decline") { ctx.journal("offer-declined", `You decline ${what}: ${offerText(offer)}.`); return; }
  const reason = acceptReason(ctx, offer);
  if (reason) { ctx.journal("offer-lapsed", `${reason} The offer lapses.`); return; }
  settleOffer(ctx, offer);
}

/** Credits per agent account, for evidence. */
export function agentCredits(credits: AgentState["credits"]): { agent: string; decisions: number }[] {
  return Object.entries(credits).filter(([, n]) => n > 0).map(([agent, decisions]) => ({ agent, decisions }))
    .sort((a, b) => b.decisions - a.decisions || a.agent.localeCompare(b.agent));
}
