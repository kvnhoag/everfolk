import { productionQuote, productionReason } from "../capabilities/production.ts";
import { vocationInventory, vocationGains, bid } from "./view.ts";
import type { LifeState, WorldPack } from "../types.ts";
import type { VocationDefinition, VocationState } from "./types.ts";
import { applyStatDelta } from "../progression.ts";
import { syncEconomyStat } from "../economy.ts";

export function initialVocations(def: VocationDefinition): VocationState {
  return { inventory: {}, lots: [], stock: Object.fromEntries(Object.entries(def.materials).map(([id, m]) => [id, m.stock])), accounts: { ...def.accounts }, demand: { ...def.demand }, completed: {}, workedAge: null };
}
const skill = (life: LifeState, id: string): number => life.character?.skills[id] ?? 0;
const count = (life: LifeState, id: string): number => life.vocations?.completed[id] ?? 0;
function shared(life: LifeState, item: string): boolean { return Boolean(life.demo && (item === "linen" || item === "flax")); }
function major(world: WorldPack, id: string): boolean {
  return ["make", "work"].includes(world.vocations!.actions[id].kind);
}
export function vocationReason(world: WorldPack, life: LifeState, id: string): string | undefined {
  const def = world.vocations, ledger = life.vocations, action = def?.actions[id];
  if (!def || !ledger || !life.economy || !life.character || !action) return "This vocation action is unavailable in this world.";
  const cash = life.economy.cash;
  if (world.capabilities && id.startsWith("appointment-") && action.kind === "work" && ledger.accounts[action.payer] < 30) return "No funded appointment is available in this office right now.";
  if (major(world, id) && ledger.workedAge === life.age) return "This year's work is complete.";
  if (major(world, id) && (life.character.jobId === "soldier" || world.capabilities?.version===2 && ["officer","general"].includes(life.character.jobId ?? "")) && !(world.capabilities?.version===2 && action.kind==="work" && action.practice && ["warfare","strength","endurance","literacy","reckoning","oratory","philosophy"].includes(action.primary))) return "Leave military service before taking a year of civilian work.";
  if (life.capabilities?.project && (action.kind === "make" || action.kind === "work" && !action.practice)) return "Finish the registered capability assessment before taking another work project.";
  if (action.kind === "buy") {
    if (ledger.stock[action.item] < action.quantity) return "The material supplier has insufficient stock.";
    if (cash < def.materials[action.item].price * action.quantity) return "You cannot afford these materials.";
  } else if (action.kind === "sell") {
    const lot = ledger.lots.find(l => l.item === action.item && l.quantity > 0);
    if (!(vocationInventory(life)[action.item] > 0)) return "Produce this item before selling it.";
    if (!(ledger.demand[action.item] > 0)) return "There are no remaining buyers for this product.";
    const price = bid(world, action.item, lot?.quality ?? 1);
    if (ledger.accounts.merchant < price) return "The buyer cannot afford this product.";
  } else if (action.kind === "work") {
    if (cash < action.fee) return "You cannot afford this work's fee.";
    if (ledger.accounts[action.payer] + (action.payer === "workshop" ? action.fee : 0) < action.pay) return "The employer has insufficient funds for this work.";
  } else {
    const recipe = def.recipes[action.recipe];
    const capabilityBlock = productionReason(world, life, action);
    if (capabilityBlock) return capabilityBlock;
    const quote = productionQuote(world, life, action.recipe, action.quantity ?? 1, action.inspected, action.controlledFiring);
    const missing = Object.entries(recipe.skills).filter(([id, min]) => skill(life, id) < min);
    if (missing.length) return `Requires ${missing.map(([id, n]) => `${world.character!.skills[id].label} ${n}`).join(", ")}.`;
    if (ledger.project) return ledger.project.recipe === action.recipe ? undefined : "Complete the current large work before starting another product.";
    if (cash < quote.fee) return "You cannot afford workshop access.";
    if (Object.entries(quote.inputs).some(([id, n]) => (vocationInventory(life)[id] ?? 0) < n)) return "Buy or make all the required materials first.";
  }
}
function gain(world: WorldPack, life: LifeState, action: string): void {
  for (const [id, delta] of Object.entries(vocationGains(world, action))) {
    life.character!.skills[id] = applyStatDelta(world.character!.skills[id], skill(life, id), delta);
  }
}
function add(life: LifeState, item: string, quantity: number, quality: number): void {
  if (shared(life, item)) {
    if (item === "flax") life.demo!.household.flax += quantity;
    else life.demo!.goods.linen += quantity;
    return;
  }
  const ledger = life.vocations!;
  ledger.inventory[item] = (ledger.inventory[item] ?? 0) + quantity;
  const lot = ledger.lots.find(l => l.item === item && l.quality === quality);
  if (lot) lot.quantity += quantity;
  else ledger.lots.push({ item, quality, quantity });
}
function consume(life: LifeState, item: string, quantity: number): void {
  if (shared(life, item)) {
    if (item === "flax") life.demo!.household.flax -= quantity;
    else life.demo!.goods.linen -= quantity;
    return;
  }
  const ledger = life.vocations!;
  ledger.inventory[item] -= quantity;
  let remaining = quantity;
  for (const lot of ledger.lots.filter(l => l.item === item)) {
    const n = Math.min(remaining, lot.quantity); lot.quantity -= n; remaining -= n;
  }
}
/** Called only on the engine's detached candidate state. Rejection never changes a life. */
export function applyVocation(world: WorldPack, life: LifeState, id: string): string {
  const reason = vocationReason(world, life, id);
  if (reason) throw new Error(`Vocation action is unavailable: ${reason}`);
  const def = world.vocations!, ledger = life.vocations!, action = def.actions[id], cash = life.economy!;
  let text = "";
  if (action.kind === "buy") {
    const price = def.materials[action.item].price * action.quantity;
    cash.cash -= price; ledger.accounts.merchant += price; ledger.stock[action.item] -= action.quantity;
    add(life, action.item, action.quantity, 1);
    text = `Bought ${action.quantity} ${action.item} for ${price} dr.`;
  } else if (action.kind === "sell") {
    const lot = ledger.lots.find(l => l.item === action.item && l.quantity > 0);
    const quality = lot?.quality ?? 1;
    const price = bid(world, action.item, quality);
    ledger.accounts.merchant -= price; cash.cash += price; ledger.demand[action.item] -= 1;
    consume(life, action.item, 1);
    text = `Sold one grade-${quality} ${action.item} for ${price} dr.`;
  } else if (action.kind === "work") {
    cash.cash -= action.fee; ledger.accounts.workshop += action.fee;
    ledger.accounts[action.payer] -= action.pay; cash.cash += action.pay;
    gain(world, life, id);
    text = `Completed ${id.replaceAll("-", " ")}${action.pay ? ` for ${action.pay} dr` : ""}.`;
  } else {
    const recipe = def.recipes[action.recipe];
    if (!ledger.project) {
      const quote = productionQuote(world, life, action.recipe, action.quantity ?? 1, action.inspected, action.controlledFiring);
      for (const [item, quantity] of Object.entries(quote.inputs)) consume(life, item, quantity);
      cash.cash -= quote.fee; ledger.accounts.workshop += quote.fee;
      const quality = quote.quality;
      ledger.project = { recipe: action.recipe, completedYears: 0, quality, ...(world.capabilities ? { outputQuantity: quote.outputQuantity, quantity: quote.quantity } : {}) };
    }
    ledger.project.completedYears += 1;
    gain(world, life, id);
    if (ledger.project.completedYears === recipe.workYears) {
      const produced = ledger.project.outputQuantity ?? recipe.outputQuantity;
      add(life, recipe.output, produced, ledger.project.quality);
      text = `Completed ${recipe.title}: ${produced} grade-${ledger.project.quality} ${recipe.output}.`;
      ledger.completed[`product-${recipe.output}`] = count(life, `product-${recipe.output}`) + 1;
      delete ledger.project;
    } else text = `Worked on ${recipe.title}; ${recipe.workYears - ledger.project.completedYears} work year remains. Inputs and fees are already reserved.`;
  }
  if (major(world, id)) {
    ledger.workedAge = life.age;
    life.character!.lastActivityAge = life.age;
  }
  ledger.completed[id] = count(life, id) + 1;
  syncEconomyStat(world, life);
  // Research and civic actions author their main-stat effects in the world pack.
  return text;
}
