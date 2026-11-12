/**
 * Track B — workshop trade in worlds with `vocations.trade` (alexandria-lives-4 and later).
 *
 * A finished lot sells in one visit to the funded buyers left this year; buyers return each year; the
 * supplier restocks each year by paying outside sellers for exactly what arrives. Every sale is paid from
 * the merchant's finite account, so a sale stops when buyers or the merchant's money run out.
 */
import type { LifeState, WorldPack } from "../types.ts";
import { bid } from "./bid.ts";

export interface LotSale { units: number; total: number; grades: number[] }

/** What selling the held lot of `item` would bring now: units, payment and their grades. Pure. */
export function lotSale(world: WorldPack, life: LifeState, item: string): LotSale {
  const ledger = life.vocations!;
  let buyers = ledger.demand[item] ?? 0, cash = ledger.accounts.merchant, held = life.demo && item === "linen" ? life.demo.goods.linen : life.demo && item === "flax" ? life.demo.household.flax : ledger.inventory[item] ?? 0;
  const sale: LotSale = { units: 0, total: 0, grades: [] };
  const lots = ledger.lots.filter(lot => lot.item === item && lot.quantity > 0).sort((a, b) => b.quality - a.quality);
  // Shared household goods (linen) carry no lot; they sell at grade 1.
  const queue = lots.length ? lots.map(lot => ({ quality: lot.quality, quantity: lot.quantity })) : [{ quality: 1, quantity: held }];
  for (const lot of queue) {
    const price = bid(world, item, lot.quality);
    const units = Math.min(lot.quantity, held, buyers, Math.floor(cash / Math.max(1, price)));
    if (units <= 0) continue;
    sale.units += units; sale.total += units * price; buyers -= units; cash -= units * price; held -= units;
    if (!sale.grades.includes(lot.quality)) sale.grades.push(lot.quality);
  }
  return sale;
}

/** Sells the held lot (best grades first) to this year's buyers; the merchant pays exactly what the household receives. */
export function sellLot(world: WorldPack, life: LifeState, item: string): LotSale {
  const sale = lotSale(world, life, item), ledger = life.vocations!;
  if (sale.units <= 0) throw new Error("Vocation action is unavailable: There are no remaining buyers for this product.");
  ledger.accounts.merchant -= sale.total;
  life.economy!.cash += sale.total;
  ledger.demand[item] -= sale.units;
  if (life.demo && item === "linen") { life.demo.goods.linen -= sale.units; return sale; }
  if (life.demo && item === "flax") { life.demo.household.flax -= sale.units; return sale; }
  ledger.inventory[item] -= sale.units;
  let remaining = sale.units;
  for (const lot of ledger.lots.filter(entry => entry.item === item && entry.quantity > 0).sort((a, b) => b.quality - a.quality)) {
    const units = Math.min(remaining, lot.quantity);
    lot.quantity -= units; remaining -= units;
  }
  return sale;
}

/** The yearly workshop settlement: buyers return, then the supplier restocks from outside sellers. */
export function settleVocationYear(world: WorldPack, life: LifeState, journal: (id: string, text: string) => void): void {
  const def = world.vocations, trade = def?.trade, ledger = life.vocations;
  if (!def || !trade || !ledger) return;
  for (const [item, buyers] of Object.entries(trade.yearlyDemand)) ledger.demand[item] = Math.max(ledger.demand[item] ?? 0, buyers);
  let paid = 0;
  for (const [id, material] of Object.entries(def.materials)) {
    const wanted = Math.max(0, material.stock - (ledger.stock[id] ?? 0));
    const arrived = Math.min(wanted, Math.floor(ledger.accounts.merchant / material.price));
    if (arrived <= 0) continue;
    ledger.stock[id] = (ledger.stock[id] ?? 0) + arrived;
    ledger.accounts.merchant -= arrived * material.price;
    paid += arrived * material.price;
  }
  if (paid > 0) journal("workshop-restock", `Workshop buyers return for the new year, and the merchant restocks craft materials from outside suppliers for ${paid} drachmas.`);
}
