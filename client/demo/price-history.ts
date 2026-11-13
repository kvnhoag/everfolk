import { marketView } from "../../src/demo/market.ts";
import { createEngine } from "../../src/index.ts";
import { TRADE_ITEMS, type ArmyLevel, type FloodLevel, type RoadLevel, type TradeItem } from "../../src/demo/types.ts";
import type { LifeStateWithDemo } from "../../src/demo/contracts.ts";
import type { Command, LifeEngine, LifeState, WorldPack } from "../../src/types.ts";

export interface PriceHistoryPoint {
  age: number;
  year: number;
  flood: FloodLevel;
  army: ArmyLevel;
  road: RoadLevel;
  prices: Record<TradeItem, { buy: number; sell: number }>;
  armyGrainPrice: number;
  merchantGrainStock: number;
}

interface CachedTimeline {
  state: LifeState;
  commandCount: number;
  byAge: Map<number, PriceHistoryPoint>;
}

const engines = new WeakMap<WorldPack, LifeEngine>();
const cache = new WeakMap<WorldPack, Map<string, CachedTimeline>>();

function engineFor(world: WorldPack): LifeEngine {
  let engine = engines.get(world);
  if (!engine) {
    engine = createEngine(world);
    engines.set(world, engine);
  }
  return engine;
}

function snapshotPoint(world: WorldPack, state: LifeState): PriceHistoryPoint | null {
  const typed = state as LifeStateWithDemo;
  if (!typed.demo) return null;
  const prices = Object.fromEntries(marketView(world.demo!, typed).quotes.map(({ item, buy, sell }) => [item, { buy, sell }])) as Record<TradeItem, { buy: number; sell: number }>;
  return {
    age: state.age,
    year: state.year,
    flood: typed.demo.year.flood,
    army: typed.demo.year.army,
    road: typed.demo.year.road,
    prices,
    armyGrainPrice: typed.demo.town.armyGrainPrice,
    merchantGrainStock: typed.demo.town.merchant.grain,
  };
}

function stepCommand(engine: LifeEngine, state: LifeState, cmd: Command): LifeState {
  switch (cmd.type) {
    case "advance":
      return engine.advance(state);
    case "choose":
      return engine.choose(state, cmd.choice);
    case "act":
      return engine.act(state, cmd.activity, cmd.calendarDeadline ? { calendarDeadline: true } : undefined);
    case "assess-jobs":
      return engine.assess(state, cmd.nodeId, cmd.jobIds);
    case "avatar":
      return engine.chooseAvatar(state, cmd.variant);
    case "influence":
      return engine.influence(state, cmd);
    case "market-order":
      return engine.orderMarket(state, cmd);
    case "market-cancel":
      return engine.cancelMarketOrder(state, cmd.orderId);
    case "npc-turn":
    case "npc-answer":
    case "npc-speech":
      return engine.npc(state, cmd);
    default:
      return engine.demo(state, cmd);
  }
}

/**
 * Pure, incrementally cached price history from Age 0 to `life.age`.
 * Never mutates `life` or draws extra randomness on the active session.
 */
export function buildPriceHistory(world: WorldPack, life: LifeState): PriceHistoryPoint[] {
  if (!world.demo || !life.demo) return [];
  let worldCache = cache.get(world);
  if (!worldCache) {
    worldCache = new Map();
    cache.set(world, worldCache);
  }
  const engine = engineFor(world);
  const commands = life.commands ?? [];
  let entry = worldCache.get(life.seed);

  if (!entry || entry.commandCount > commands.length) {
    const initial = engine.start(life.seed);
    const byAge = new Map<number, PriceHistoryPoint>();
    const pt = snapshotPoint(world, initial);
    if (pt) byAge.set(initial.age, pt);
    entry = { state: initial, commandCount: 0, byAge };
    worldCache.set(life.seed, entry);
  }

  let current = entry.state;
  for (let i = entry.commandCount; i < commands.length; i++) {
    try {
      current = stepCommand(engine, current, commands[i]);
      const pt = snapshotPoint(world, current);
      if (pt) entry.byAge.set(current.age, pt);
    } catch {
      break;
    }
  }
  entry.state = current;
  entry.commandCount = commands.length;

  const latest = snapshotPoint(world, life);
  if (latest) entry.byAge.set(life.age, latest);

  return [...entry.byAge.values()].sort((a, b) => a.age - b.age);
}
