/**
 * Shared contracts for the Grain and Service demo (world `alexandria-demo-1`).
 * Every amount is a whole number. Only worlds with a `demo` section use any of this;
 * older packs and their saves never see these fields.
 *
 * Ownership: this file is the Step 0 contract. Each track may add optional fields to its own
 * config interface below (marked with its track letter); renaming or removing fields needs the lead.
 */
import type { Command, Effect, LifeState, WorldPack } from "../types.ts";

// ── Stable identifiers ───────────────────────────────────────────────────────

export const DEMO_WORLD_VERSION = "alexandria-demo-1";
export const FARMING_JOBS = ["farmhand", "tenant-farmer", "grain-dealer"] as const;
export const SERVICE_JOBS = ["soldier"] as const;
export const FARMING_SKILL = "farming";
export const CONVOY_DISTINCTION = "convoy-distinction";

export const GOODS = ["silver", "gold", "silk", "linen"] as const;
export const LIVESTOCK = ["ox", "donkey"] as const;
export const TRADE_ITEMS = ["grain", "flax", ...GOODS, ...LIVESTOCK] as const;
export const WORKS = ["well", "granary", "school", "healing-house"] as const;
export const TOWN_ROLES = ["merchant", "grower", "army"] as const;
export const AGENT_ROLES = [...TOWN_ROLES, "player"] as const;
export const OFFERS = ["grain-contract", "seed-credit", "convoy-job", "goods-deal"] as const;

export type Good = typeof GOODS[number];
export type Animal = typeof LIVESTOCK[number];
export type TradeItem = typeof TRADE_ITEMS[number];
export type WorkId = typeof WORKS[number];
export type TownRole = typeof TOWN_ROLES[number];
export type AgentRole = typeof AGENT_ROLES[number];
export type OfferKind = typeof OFFERS[number];

export type FloodLevel = "low" | "normal" | "high";
export type ArmyLevel = "quiet" | "recruiting" | "war";
export type RoadLevel = "safe" | "uneasy" | "dangerous";
export type ConditionFamily = "flood" | "army" | "road";

// ── World configuration (`world.demo`) ──────────────────────────────────────

/** Track D: seeded year conditions. */
export interface TimelineConfig {
  /** Each family schedules episodes inside a seeded window of `windowYears` (50–100). */
  families: Record<ConditionFamily, {
    windowYears: { min: number; max: number };
    episodes: { min: number; max: number };
    durationYears: { min: number; max: number };
    /** Level during an episode; outside episodes the family is at its calm level. */
    level: string;
  }>;
  /** Extra chance (basis points) of an uneasy road in recruitment years or after a low flood. */
  roadPressureBps: number;
  /** Chance (basis points) of a high flood in a year outside low-flood episodes. Default 0. */
  highFloodBps?: number;
  /** Army episodes at least this long turn to war in their middle year. Default 4. */
  warMinYears?: number;
  /** Calm years kept between two episodes of one family. Default 1. */
  episodeGapYears?: number;
}

/** Track A: household, farming, flax, family. */
export interface HouseholdConfig {
  startingGrain: number;
  storeCapacity: number;
  plots: number;
  /** Grain per plot per full labour unit at a normal flood and zero farming skill. */
  yieldPerPlot: number;
  flaxPerPlot: number;
  floodFactorBps: Record<FloodLevel, number>;
  /** Extra yield per point of farming skill, in basis points. */
  skillBonusBps: number;
  oxBonusBps: number;
  rentBps: number;
  spoilageBps: number;
  overCapacitySpoilageBps: number;
  /** Grain eaten by one adult per year; children eat `childRationBps` of it. */
  adultRation: number;
  childRationBps: number;
  animalFeed: Record<Animal, number>;
  /** Labour units: adult 100, part-time child (from childHelpAge) 40, full from childWorkAge. */
  childHelpAge: number;
  childWorkAge: number;
  handOverAge: number;
  parentsStopEatingAfterYears: number;
  /** Health lost per 10% of the household ration missing, capped. */
  hungerHealthPer10Pct: number;
  hungerHealthCap: number;
  /** Linen bolts spun per unit of spare household labour from flax bundles. */
  flaxPerLinen: number;
  marriageGift: { item: Good | "grain"; quantity: number };
}

/** Track B: townspeople, prices, goods, livestock. */
export interface MarketConfig {
  start: {
    grower: { grain: number; cash: number; flax: number };
    merchant: { grain: number; cash: number; goods: Record<Good, number>; flax: number; animals: Record<Animal, number> };
    army: { grain: number; purse: number };
  };
  growerPlots: number;
  /** Base merchant prices (drachmas per unit) and the bounds any price must stay within. */
  basePrice: Record<TradeItem, number>;
  priceFloorBps: number;
  priceCeilingBps: number;
  /** Merchant's sell price over its buy price, in basis points. */
  spreadBps: number;
  targetGrainStock: number;
  armyDemand: Record<ArmyLevel, number>;
  transportCostBps: Record<RoadLevel, number>;
  yearlyImports: Record<Good, number>;
  importFactorBps: Record<RoadLevel, number>;
  royalAllocation: number;
  maxOrderQuantity: number;
}

/** Track C: wages, rations, convoy. */
export interface ServiceConfig {
  wage: Record<ArmyLevel, number>;
  ration: number;
  escortCooldownYears: number;
  escortCargo: number;
  /** Base cargo loss on the road by danger level, basis points. */
  roadLossBps: Record<RoadLevel, number>;
  provisionsCost: number;
  distinctionMinWarfare: number;
}

/** Track E: community works and reputation. */
export interface WorksConfig {
  works: Record<WorkId, { title: string; cash: number; grain: number; progress: number; reputation: number }>;
  reputation: { initial: number; min: number; max: number };
  granarySpoilageCutBps: number;
  schoolDiscountBps: number;
}

/** Track F: agent limits. */
export interface AgentConfig {
  /** How far an agent may move a rule price, in basis points either way. */
  priceBandBps: number;
  maxWagePremiumBps: number;
  growerReleaseBps: { min: number; max: number };
  offerQuantity: { min: number; max: number };
}

/** Track D: content shown but not playable in this world. */
export interface AvailabilityConfig {
  playableJobs: string[];
  unavailableJobs: string[];
  unavailableActivities: string[];
  unavailableSkills: string[];
  unavailableAccomplishments: string[];
  /** Presentation-only future paths with no job/skill id in the pack. */
  futurePaths: { id: string; title: string; description: string; prerequisites?: string }[];
}

export interface DemoDefinition {
  timeline: TimelineConfig;
  household: HouseholdConfig;
  market: MarketConfig;
  service: ServiceConfig;
  works: WorksConfig;
  agents: AgentConfig;
  availability: AvailabilityConfig;
}

// ── Life state (`life.demo`) ────────────────────────────────────────────────

export interface Episode { startAge: number; years: number }

export interface YearConditions {
  flood: FloodLevel;
  army: ArmyLevel;
  road: RoadLevel;
  /** Families whose episode began this year (for once-per-episode decisions). */
  fresh: ConditionFamily[];
}

export interface HouseholdState {
  grain: number;
  capacity: number;
  plots: number;
  flaxPlots: number;
  flax: number;
  animals: Record<Animal, number>;
  parents: "working" | "retired" | "gone";
  /** Age at which the player took over the plot; null while the parents run it. */
  headSinceAge: number | null;
  /** Share of last year's ration that was missing, in basis points (0 = fed). */
  lastShortfallBps: number;
  /** Next harvest bonus from a seed deed, basis points; cleared after the harvest. */
  harvestBonusBps: number;
}

export interface TownState {
  grower: { grain: number; cash: number; flax: number };
  merchant: { grain: number; cash: number; goods: Record<Good, number>; flax: number; animals: Record<Animal, number> };
  army: { grain: number; purse: number };
  /** Current merchant quotes: what the merchant pays (`buy`) and asks (`sell`). */
  prices: Record<TradeItem, { buy: number; sell: number }>;
  armyGrainPrice: number;
}

export interface Shipment {
  kind: "escort" | "contract";
  cargo: number;
  /** Price the army pays per unit delivered (contract) or escort pay (escort). */
  pay: number;
  stage: "muster" | "road";
  provisions: boolean;
  companions: number;
  /** Basis points removed from road risk by drawn deeds (guard-road). */
  riskCutBps: number;
}

export interface AgentState {
  assigned: Partial<Record<TownRole, string>>;
  /** Agent the player delegated their own decisions to; null when playing themselves. */
  player: string | null;
  /** Decisions submitted for the coming settlement, cleared after it. */
  pending: Partial<Record<TownRole, TownDecision>>;
  /** Credited decisions per agent account (decisions that touched the player). */
  credits: Record<string, number>;
}

export interface Offer { kind: OfferKind; role: TownRole; agent: string | null; item: TradeItem; quantity: number; price: number }

export interface DemoState {
  /** Separate random stream so the main life stream keeps its draw order. */
  rng: number;
  schedule: Record<ConditionFamily, Episode[]>;
  year: YearConditions;
  household: HouseholdState;
  goods: Record<Good, number>;
  town: TownState;
  reputation: number;
  /** Progress units per work. */
  works: Record<WorkId, number>;
  /** Works finished in this life, in completion order. */
  built: WorkId[];
  shipment: Shipment | null;
  lastEscortAge: number | null;
  lastTradeAge: number | null;
  offer: Offer | null;
  agents: AgentState;
}

// ── Decisions, commands, effects, conditions ────────────────────────────────

export type TownDecision =
  | { kind: "prices"; grainBuy: number; grainSell: number }
  | { kind: "release"; shareBps: number }
  | { kind: "wage"; premiumBps: number }
  | { kind: "offer"; offer: OfferKind; item: TradeItem; quantity: number; price: number };

export type AgentDecision = TownDecision | { kind: "command"; command: Command };

export interface TradeCommand {
  type: "trade";
  item: TradeItem;
  side: "buy" | "sell";
  quantity: number;
  counterparty: "merchant" | "army";
}
/** Free yearly planting plan: how many plots grow flax instead of grain. */
export interface PlanCommand { type: "plan"; flaxPlots: number }
/** Recorded at age 0 from the contract's assignment; verified by workflow 3. */
export interface AssignAgentsCommand { type: "assign-agents"; agents: Partial<Record<TownRole, string>> }
/** The player hands their decisions to an agent account, or takes them back (null). */
export interface DelegateCommand { type: "delegate"; agent: string | null }
/** A signed agent decision. The engine checks limits; signatures are checked by the verifier. */
export interface AgentCommand { type: "agent"; agent: string; role: AgentRole; decision: AgentDecision; signature: string }

export type DemoCommand = TradeCommand | PlanCommand | AssignAgentsCommand | DelegateCommand | AgentCommand;

export type DemoEffect =
  /** Grain into or out of the household store. Positive only in influence entries (deeds). */
  | { kind: "grain"; delta: number; cause: string }
  /** Goods or animals into or out of the household. Positive amounts are traced outside income. */
  | { kind: "item"; item: Good | Animal | "flax"; delta: number; cause: string }
  | { kind: "reputation"; delta: number }
  /** Progress on a community work; costs are separate cash/grain effects on the same outcome. */
  | { kind: "work"; work: WorkId; progress: number }
  | { kind: "share-grain"; quantity: number }
  | { kind: "harvest-bonus"; bps: number }
  | { kind: "convoy"; action: "provision" | "companion" | "depart" | "withdraw" | "resolve"; lossBps?: number; riskCutBps?: number }
  | { kind: "offer"; action: "accept" | "decline" };

export type DemoCondition =
  | { kind: "year"; family: ConditionFamily; level: string; fresh?: boolean }
  | { kind: "item"; item: "grain" | Good | Animal | "flax"; op: "gte" | "lte" | "gt" | "lt" | "eq"; value: number }
  | { kind: "reputation"; op: "gte" | "lte" | "gt" | "lt"; value: number }
  | { kind: "work"; work: WorkId; built: boolean }
  | { kind: "convoy"; stage: Shipment["stage"] | "none" }
  | { kind: "offer"; offer: OfferKind }
  | { kind: "hungry" }
  | { kind: "head-of-plot"; value: boolean };

// ── Context passed to modules during engine steps ───────────────────────────

/**
 * A module works on the engine's private draft (`life`, `demo`), never on a frozen public
 * snapshot. `apply` runs core effects (cash, stats, health) through the engine so money and
 * health follow the normal rules; `journal` writes a life-record line.
 */
export interface DemoContext {
  world: WorldPack;
  def: DemoDefinition;
  life: LifeState;
  demo: DemoState;
  random(): number;
  apply(effects: readonly Effect[]): void;
  journal(id: string, text: string): void;
}

export type Availability = { status: "playable" } | { status: "locked"; reason: string } | { status: "unavailable"; reason: string };
export const UNAVAILABLE_REASON = "Not available in this demo.";
