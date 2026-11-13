/** Lead — birth state and the per-step context. */
import type { Effect, LifeState, WorldPack } from "../types.ts";
import type { DemoContext, DemoDefinition, DemoState } from "./types.ts";
import { GOODS, TRADE_ITEMS } from "./types.ts";
import { demoRandom, demoSeed } from "./rng.ts";
import { initialHousehold } from "./household.ts";
import { initialTown } from "./market.ts";
import { initialWorks } from "./works.ts";
import { initialAgents } from "./agents.ts";
import { scheduleConditions, conditionsAt } from "./timeline.ts";

export function demoContext(world: WorldPack, life: LifeState, apply: (effects: readonly Effect[]) => void,
  journal: (id: string, text: string) => void): DemoContext {
  const def = world.demo!, demo = life.demo!;
  return { world, def, life, demo, random: () => demoRandom(demo), apply, journal };
}

/** Inclusive whole-number sampling from the separate demo random stream. */
function startingQuantity(ctx: DemoContext, min: number, max: number): number {
  if (min === max) return min;
  const width = BigInt(max) - BigInt(min) + 1n;
  const words = width <= 0x1_0000_0000n ? 1 : 2;
  const size = 1n << BigInt(words * 32), limit = size - size % width;
  let draw: bigint;
  do {
    draw = 0n;
    for (let index = 0; index < words; index++) draw = (draw << 32n) | BigInt(ctx.random() * 0x1_0000_0000);
  } while (draw >= limit);
  return Number(BigInt(min) + draw % width);
}

function rollStartingResources(ctx: DemoContext): void {
  const config = ctx.def.startingResources;
  if (!config) return;
  const overrides = config.origins?.[ctx.life.originId];
  for (const item of TRADE_ITEMS) {
    const range = overrides?.[item] ?? config.defaults[item];
    const quantity = startingQuantity(ctx, range.min, range.max);
    if (item === "grain") ctx.demo.household.grain = quantity;
    else if (item === "flax") ctx.demo.household.flax = quantity;
    else if (item === "ox" || item === "donkey") ctx.demo.household.animals[item] = quantity;
    else ctx.demo.goods[item] = quantity;
  }
  ctx.demo.household.capacity = config.storeCapacityByOrigin?.[ctx.life.originId] ?? ctx.demo.household.capacity;
}

/** Called once at birth for demo worlds, after the origin is chosen. */
export function initialDemo(world: WorldPack, life: LifeState, apply: DemoContext["apply"], journal: DemoContext["journal"]): DemoState {
  const def: DemoDefinition = world.demo!;
  const demo: DemoState = {
    rng: demoSeed(life.seed),
    schedule: { flood: [], army: [], road: [] },
    year: { flood: "normal", army: "quiet", road: "safe", fresh: [] },
    household: initialHousehold(def),
    goods: Object.fromEntries(GOODS.map(good => [good, 0])) as DemoState["goods"],
    town: initialTown(def),
    reputation: def.works.reputation.initial,
    works: initialWorks(), built: [],
    shipment: null, lastEscortAge: null, lastTradeAge: null, offer: null,
    agents: initialAgents(),
  };
  life.demo = demo;
  const ctx = demoContext(world, life, apply, journal);
  demo.schedule = scheduleConditions(ctx);
  demo.year = conditionsAt(ctx);
  // Schedule and initial conditions retain their own seeded draw order.
  rollStartingResources(ctx);
  return demo;
}
