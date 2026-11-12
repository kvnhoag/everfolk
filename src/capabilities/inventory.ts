import type { LifeState, WorldPack } from "../types.ts";

export const inventoryOf = (life: LifeState): Record<string, number> => ({ ...life.vocations?.inventory,
  ...(life.demo ? { grain: life.demo.household.grain, flax: life.demo.household.flax, linen: life.demo.goods.linen } : {}) });

export function putItem(life: LifeState, item: string, quantity: number, quality = 1): void {
  if (life.demo && item === "grain") { life.demo.household.grain += quantity; return; }
  if (life.demo && item === "flax") { life.demo.household.flax += quantity; return; }
  if (life.demo && item === "linen") { life.demo.goods.linen += quantity; return; }
  const ledger = life.vocations!;
  ledger.inventory[item] = (ledger.inventory[item] ?? 0) + quantity;
  const lot = ledger.lots.find(lot => lot.item === item && lot.quality === quality);
  if (lot) lot.quantity += quantity;
  else ledger.lots.push({ item, quantity, quality });
}
export function takeItem(life: LifeState, item: string, quantity: number): void {
  if ((inventoryOf(life)[item] ?? 0) < quantity) throw new Error(`Not enough ${item}.`);
  if (life.demo && item === "grain") { life.demo.household.grain -= quantity; return; }
  if (life.demo && item === "flax") { life.demo.household.flax -= quantity; return; }
  if (life.demo && item === "linen") { life.demo.goods.linen -= quantity; return; }
  const ledger = life.vocations!;
  ledger.inventory[item] -= quantity;
  let remaining = quantity;
  for (const lot of ledger.lots.filter(lot => lot.item === item && lot.quantity > 0)) {
    const used = Math.min(remaining, lot.quantity); lot.quantity -= used; remaining -= used;
    if (!remaining) break;
  }
}
export interface BasketQuote { missing: Record<string, number>; cost: number; reason?: string }
/** Owned intermediates count; only missing stock is purchased at the accepted quote. */
export function basketQuote(world: WorldPack, life: LifeState, inputs: Record<string, number>): BasketQuote {
  const held = inventoryOf(life), missing: Record<string, number> = {};
  let cost = 0;
  for (const [item, quantity] of Object.entries(inputs)) {
    const need = Math.max(0, quantity - (held[item] ?? 0));
    if (!need) continue;
    missing[item] = need;
    const definition = world.vocations?.materials[item];
    if (!definition || (life.vocations?.stock[item] ?? 0) < need) return { missing, cost, reason: `The supplier cannot supply ${need} ${item}.` };
    cost += need * definition.price;
  }
  return { missing, cost };
}
export function buyBasket(world: WorldPack, life: LifeState, quote: BasketQuote): void {
  if (quote.reason || life.economy!.cash < quote.cost) throw new Error(quote.reason ?? "You cannot afford the quoted materials.");
  life.economy!.cash -= quote.cost;
  life.vocations!.accounts.merchant += quote.cost;
  for (const [item, quantity] of Object.entries(quote.missing)) {
    life.vocations!.stock[item] -= quantity;
    putItem(life, item, quantity);
    if (life.capabilities) {
      const basis = (life.capabilities.costBasis ??= {});
      const before = basis[item] ?? { quantity: 0, cost: 0 };
      basis[item] = { quantity: before.quantity + quantity, cost: before.cost + quantity * world.vocations!.materials[item].price };
    }
  }
}
