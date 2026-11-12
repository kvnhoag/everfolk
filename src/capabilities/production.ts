import design from "../../design/skill-tree/catalog.json" with { type: "json" };
import type { LifeState, WorldPack } from "../types.ts";
import type { VocationAction } from "../vocations/types.ts";

export const hasCapability = (life: LifeState, id: string): boolean => Boolean(life.capabilities?.learned[id]);
export function artisanLimits(life: LifeState, family: string): { quality: number; batch: number } {
  const prefix = family === "Clothing" ? "AT" : family === "Ceramics" ? "AC" : "AS";
  const learned = (depth: number) => hasCapability(life, `${prefix}${depth}`);
  if (family === "Intermediate") return { quality: 1, batch: 10 };
  const quality = learned(10) ? 5 : learned(9) ? 4 : family === "Sculpture" ? learned(7) ? 3 : learned(5) ? 2 : 1 : learned(6) ? 3 : learned(5) ? 2 : 1;
  const batches = family === "Clothing" ? [1, 2, 4, 4, 6, 8, 10, 12] : family === "Ceramics" ? [1, 4, 6, 8, 10, 12, 14, 16] : [1, 2, 2, 2, 1, 1, 1, 1];
  const index = learned(10) ? 7 : learned(9) ? 6 : learned(8) ? 5 : learned(7) ? 4 : learned(6) ? 3 : learned(5) ? 2 : hasCapability(life, "A4") ? 1 : 0;
  return { quality, batch: batches[index] };
}
export interface ProductionQuote {
  recipeId: string; inputs: Record<string, number>; fee: number;
  output: string; outputQuantity: number; quantity: number; quality: number; workYears: number;
  primary: string; supports: string[]; family: string; bid: number;
}
export function productionQuote(world: WorldPack, life: LifeState, recipeId: string, quantity = 1, inspected = false, controlledFiring = false): ProductionQuote {
  const recipe = world.vocations!.recipes[recipeId];
  const metadata = design.recipes.find(recipe => recipe.id === recipeId)!;
  const enabled = Boolean(world.capabilities), family = metadata?.family ?? "Intermediate";
  const inputs = Object.fromEntries(Object.entries(recipe.inputs).map(([item, n]) => [item, n * quantity]));
  let fee = recipe.fee;
  if (enabled) {
    if (hasCapability(life, "AT8") && family === "Clothing" && quantity >= 4 && inputs.linen) inputs.linen = Math.ceil(inputs.linen * 7 / 8);
    if (hasCapability(life, "AC8") && family === "Ceramics") inputs.fuel = Math.ceil(quantity / 2);
    if (recipeId === "decorated-vessel") inputs.pigment = Math.ceil(quantity / 4);
    if (controlledFiring && family === "Ceramics") inputs.fuel = (inputs.fuel ?? 0) + Math.ceil(quantity / 4);
    if (inspected) fee += 3;
    if (!hasCapability(life, "A4") && ["garment", "vessel", "clay-model"].includes(recipeId)) fee += 2;
  }
  const natural = 1 + Math.floor(Math.max(0, life.character!.skills.craft - 24) / 16);
  const cap = enabled ? artisanLimits(life, family).quality : 5;
  const quality = Math.min(cap, natural + (enabled && inspected ? 1 : 0) + (enabled && (recipeId === "dyed-garment" || controlledFiring) ? 1 : 0));
  const retail = Math.floor(recipe.baseAsk * [10000,11500,13000,15000,18000][family === "Intermediate" ? 0 : quality - 1] / 10000);
  return { recipeId, inputs, fee, output: recipe.output, outputQuantity: recipe.outputQuantity * quantity, quantity, quality, workYears: recipe.workYears,
    primary: recipe.primary, supports: recipe.supports, family, bid: Math.floor(retail * 10000 / 12500) };
}
export function productionReason(world: WorldPack, life: LifeState, action: Extract<VocationAction, {kind:"make"}>): string | undefined {
  if (!world.capabilities) return;
  const metadata = design.recipes.find(recipe => recipe.id === action.recipe);
  if (!metadata) return "This recipe has no capability specification.";
  if (!hasCapability(life, metadata.requires)) return `Learn ${metadata.requires} before using this recipe.`;
  const quantity = action.quantity ?? 1, limit = artisanLimits(life, metadata.family).batch;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > limit) return `This method permits at most ${limit} recipe units in a work year.`;
  if (action.inspected && !hasCapability(life, "A4")) return "Learn controlled making before ordering an inspection.";
  if (action.controlledFiring && !hasCapability(life, "AC6")) return "Learn controlled firing before using extra kiln fuel.";
}
