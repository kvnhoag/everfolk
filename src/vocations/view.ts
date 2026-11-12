import { CAPABILITY_OPERATIONS } from "../deep-capabilities/operations.ts";
import { capabilityRewards, quoteCapabilityProduction } from "../deep-capabilities/rewards.ts";
import { capabilityServiceCashDelta } from "../deep-capabilities/services.ts";
import { materialCost } from "../paths/farm-edge.ts";
import { productionQuote } from "../capabilities/production.ts";
import type { LifeState, WorldPack } from "../types.ts";
import { bid } from "./bid.ts";
import { lotSale } from "./trade.ts";
import { basketQuote } from "../capabilities/inventory.ts";
export { bid } from "./bid.ts";

/** Shared flax/linen stay in the household store, including goods bought at town markets. */
export function vocationInventory(life: LifeState): Record<string, number> {
  return { ...life.vocations?.inventory, ...(life.demo ? { flax: life.demo.household.flax, linen: life.demo.goods.linen } : {}) };
}
/** Detached previews use the same authored gains and price arithmetic as accepted work. */
export function vocationGains(world: WorldPack, id: string): Record<string, number> {
  const action = world.vocations?.actions[id];
  if (!action || action.kind === "buy" || action.kind === "sell") return {};
  if (action.kind === "capability") { const op = CAPABILITY_OPERATIONS[action.operation]; return !op || op.minor ? {} : Object.fromEntries([[op.primary, 3], ...op.supports.map(id => [id, 2])]); }
  const source = action.kind === "make" ? world.vocations!.recipes[action.recipe] : action;
  const practice = action.kind === "work" && action.practice;
  return Object.fromEntries([[source.primary, practice ? 5 : 3], ...source.supports.map(id => [id, practice ? 1 : 2])]);
}
export function vocationCashDelta(world: WorldPack, life: LifeState, id: string): number {
  const action = world.vocations?.actions[id];
  if (!action) return 0;
  if (action.kind === "capability") {
    const op = CAPABILITY_OPERATIONS[action.operation]; if (!op) return 0;
    if (op.kind === "service") return capabilityServiceCashDelta(life, action.operation);
    const maintenance = op.action === "channel-maintenance" || op.action === "integrated-plan" ? (life.demo?.household.plots ?? 0) * 8 : 0;
    return op.pay - op.fee - maintenance;
  }
  if (world.deepCapabilities && action.kind === "make") return life.vocations?.project?.recipe === action.recipe ? 0 : -quoteCapabilityProduction(capabilityRewards(Object.keys(life.deepCapabilities?.learned ?? {})), world.vocations!.recipes[action.recipe], { recipeId: action.recipe, quantity: action.quantity, inspected: action.inspected, controlledFiring: action.controlledFiring }).fee;
  if (action.kind === "buy") return -materialCost(world, life, action.item, action.quantity);
  if (action.kind === "work") return action.pay - action.fee;
  if (action.kind === "make") {
    if (life.vocations?.project?.recipe === action.recipe) return 0;
    const quote = productionQuote(world, life, action.recipe, action.quantity ?? 1, action.inspected, action.controlledFiring);
    // Trade worlds buy the missing inputs with the work.
    return -quote.fee - (world.vocations?.trade ? basketQuote(world, life, quote.inputs).cost : 0);
  }
  if (world.vocations?.trade) return lotSale(world, life, action.item).total;
  const lot = life.vocations?.lots.find(l => l.item === action.item && l.quantity > 0);
  return (vocationInventory(life)[action.item] ?? 0) > 0 ? bid(world, action.item, lot?.quality ?? 1) : 0;
}
