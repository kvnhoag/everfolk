import { capabilityServiceCashDelta } from "../capabilities/services.ts";
import { CAPABILITY_OPERATIONS } from "../capabilities/operations.ts";
import { capabilityRewards, quoteCapabilityProduction } from "../capabilities/rewards.ts";
import type { LifeState, WorldPack } from "../types.ts";

/** Shared flax/linen stay in the household store, including goods bought at town markets. */
export function vocationInventory(life: LifeState): Record<string, number> {
  return { ...life.vocations?.inventory, ...(life.demo ? { flax: life.demo.household.flax, linen: life.demo.goods.linen } : {}) };
}
export function bid(world: WorldPack, item: string, quality: number): number {
  const recipe = Object.values(world.vocations!.recipes).find(r => r.output === item)!;
  const retail = Math.floor(recipe.baseAsk * [10000, 11500, 13000, 15000, 18000][["thread", "linen"].includes(item) ? 0 : quality - 1] / 10000);
  return Math.floor(retail * 10000 / 12500);
}
/** Detached previews use the same authored gains and price arithmetic as accepted work. */
export function vocationGains(world: WorldPack, id: string): Record<string, number> {
  const action = world.vocations?.actions[id];
  if (!action || action.kind === "buy" || action.kind === "sell") return {};
  if (action.kind === "capability") {
    const op = CAPABILITY_OPERATIONS[action.operation];
    return !op || op.minor ? {} : Object.fromEntries([[op.primary,3],...op.supports.map(id=>[id,2])]);
  }
  const source = action.kind === "make" ? world.vocations!.recipes[action.recipe] : action;
  const practice = action.kind === "work" && action.practice;
  return Object.fromEntries([[source.primary, practice ? 5 : 3], ...source.supports.map(id => [id, practice ? 1 : 2])]);
}
export function vocationCashDelta(world: WorldPack, life: LifeState, id: string): number {
  const action = world.vocations?.actions[id];
  if (!action) return 0;
  if (action.kind === "capability") {
    const op = CAPABILITY_OPERATIONS[action.operation];
    if (!op) return 0;
    if (op.kind === "service") return capabilityServiceCashDelta(life, action.operation);
    const maintenance = op.action === "channel-maintenance" || op.action === "integrated-plan" ? (life.demo?.household.plots ?? 0) * 8 : 0;
    return op.pay - op.fee - maintenance;
  }
  if (world.capabilities && action.kind === "make") return life.vocations?.project?.recipe === action.recipe ? 0 : -quoteCapabilityProduction(capabilityRewards(Object.keys(life.capabilities?.learned ?? {})),world.vocations!.recipes[action.recipe],{recipeId:action.recipe,quantity:action.quantity,inspected:action.inspected,controlledFiring:action.controlledFiring}).fee;
  if (action.kind === "buy") return -world.vocations!.materials[action.item].price * action.quantity;
  if (action.kind === "work") return action.pay - action.fee;
  if (action.kind === "make") return life.vocations?.project?.recipe === action.recipe ? 0 : -world.vocations!.recipes[action.recipe].fee;
  const lot = life.vocations?.lots.find(l => l.item === action.item && l.quantity > 0);
  return (vocationInventory(life)[action.item] ?? 0) > 0 ? bid(world, action.item, lot?.quality ?? 1) : 0;
}
