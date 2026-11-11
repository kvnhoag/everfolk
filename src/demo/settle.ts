/** Lead — the yearly settlement order for demo worlds (design §4.2). Runs on the engine's draft. */
import type { DemoContext } from "./types.ts";
import { harvest, payRent, feedHousehold, spoilAndSpin, advanceFamily } from "./household.ts";
import { payWages, assignConvoy } from "./service.ts";
import { townTrades, movePrices } from "./market.ts";
import { rollYear } from "./timeline.ts";
import { closeAgentYear } from "./agents.ts";

/** Steps 1–7, before the world's yearly rules. Uses the conditions of the year just lived. */
export function settleDemoYear(ctx: DemoContext): void {
  harvest(ctx);
  payRent(ctx);
  payWages(ctx);
  feedHousehold(ctx);
  spoilAndSpin(ctx);
  townTrades(ctx);
  movePrices(ctx);
  closeAgentYear(ctx);
}

/** Step 9, after yearly rules and before events: the new year's conditions and assignments. */
export function openDemoYear(ctx: DemoContext): void {
  advanceFamily(ctx);
  rollYear(ctx);
  assignConvoy(ctx);
}
