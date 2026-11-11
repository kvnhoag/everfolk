/** Lead — birth state and the per-step context. */
import type { Effect, LifeState, WorldPack } from "../types.ts";
import type { DemoContext, DemoDefinition, DemoState } from "./types.ts";
import { GOODS } from "./types.ts";
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
  return demo;
}
