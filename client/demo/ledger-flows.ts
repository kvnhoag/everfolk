import type { ResourceId } from "./resources.ts";
import { RESOURCES } from "./resources.ts";

/** Gain: came into the store. Loss: went out or went missing. Neutral: noted, nothing moved. */
export type FlowTone = "gain" | "loss" | "neutral";

/** One movement of one resource, drawn as an icon chip with a signed amount instead of a sentence. */
export interface LedgerFlow {
  label: string;
  icon: string;
  /** Signed amount; null when the record names no amount. */
  delta: number | null;
  tone: FlowTone;
  /** The full journal sentence, kept for the chip's tooltip. */
  text: string;
}

type Parsed = Partial<Record<ResourceId, Omit<LedgerFlow, "text">>>;

const num = (text: string, pattern: RegExp): number | null => {
  const found = text.match(pattern)?.[1];
  return found === undefined ? null : Number(found);
};

function flow(label: string, icon: string, delta: number | null, tone?: FlowTone): Omit<LedgerFlow, "text"> {
  return { label, icon, delta, tone: tone ?? (delta === null || delta === 0 ? "neutral" : delta > 0 ? "gain" : "loss") };
}

const MONEY = /(\d+(?:\.\d+)?) (?:drachmas|dr)\b/;

/** The goods a trade line names other than money: whole words, tolerating plurals and "oxen". */
function tradedGoods(text: string, mentioned: (text: string) => ResourceId[]): ResourceId[] {
  return mentioned(text).filter(id => id !== "drachmas");
}

function trade(text: string, mentioned: (text: string) => ResourceId[]): Parsed {
  const buying = /\byou buy\b/i.test(text) || /\bhousehold buys\b/i.test(text) || /\bgives you\b/i.test(text);
  const selling = /\byou sell\b/i.test(text) || /\bgo to the army\b/i.test(text);
  if (!buying && !selling) {
    // A contract or an escort agreed: nothing moves until it is delivered.
    return Object.fromEntries([...tradedGoods(text, mentioned), "drachmas"].map(id => [id, flow("Agreed", "commerce", null)]));
  }
  const units = num(text, /(?:buys?|sell|gives you) (\d+)/i) ?? num(text, /(\d+) measures go/);
  const money = num(text, /for (\d+(?:\.\d+)?) (?:drachmas|dr)/) ?? num(text, /\((\d+(?:\.\d+)?) (?:drachmas|dr)\)/);
  const goods = tradedGoods(text, mentioned);
  const label = buying ? "Bought" : "Sold";
  const parsed: Parsed = Object.fromEntries(goods.map(id => [id, flow(label, "commerce", units === null ? null : buying ? units : -units)]));
  if (/on credit/i.test(text)) parsed.drachmas = flow("On credit", "commerce", null, "loss");
  else parsed.drachmas = flow(label, "commerce", money === null ? null : buying ? -money : money);
  return parsed;
}

/**
 * Reads one settled journal line into per-resource movements. The engine writes these lines from fixed
 * templates, so amounts are read from the sentence; an unfamiliar line still shows, as a neutral note.
 */
export function ledgerFlows(entry: { id: string; text: string }, touched: readonly ResourceId[], mentioned: (text: string) => ResourceId[]): Partial<Record<ResourceId, LedgerFlow>> {
  const { id, text } = entry;
  let parsed: Parsed = {};
  if (id === "household-harvest") {
    const grain = num(text, /harvest of (\d+) measures of grain/);
    const flax = num(text, /and (\d+) bundles of flax/);
    parsed = grain === null
      ? { grain: flow("No harvest", "flow-fallow", 0, "loss"), flax: flow("No harvest", "flow-fallow", 0, "loss") }
      : { grain: flow("Harvest", "res-grain", grain), flax: flax ? flow("Harvest", "res-flax", flax) : flow("Not planted", "res-flax", null) };
  } else if (id === "household-harvest-bonus") parsed = { grain: flow("Help used", "res-labour", null) };
  else if (id === "household-rent") parsed = { grain: flow("Rent", "home", -(num(text, /hand (\d+)/) ?? 0)) };
  else if (id === "household-rent-flax") parsed = { flax: flow("Rent", "home", -(num(text, /hand (\d+)/) ?? 0)) };
  else if (id === "household-seed-loan") parsed = { grain: flow("Seed loan", "res-grain", num(text, /borrows (\d+)/)) };
  else if (id === "household-seed-loan-repaid") parsed = { grain: flow("Seed repaid", "home", -(num(text, /repays (?:only )?(?:the )?(\d+)/) ?? 0)) };
  else if (id === "household-sold-for-food") parsed = { drachmas: flow("Sold for food", "commerce", num(text, /for (\d+) drachmas/)) };
  else if (id === "household-bought-grain") parsed = { grain: flow("Bought short", "commerce", num(text, /bought (\d+)/)) };
  else if (id === "household-eat") parsed = { grain: flow("Eating", "flow-eat", -(num(text, /eats (\d+)/) ?? 0)) };
  // Hunger is grain that was never in the store: a loss to note, not an amount taken out.
  else if (id === "household-hunger") parsed = { grain: flow(`Short ${num(text, /hungry: (\d+)/) ?? ""}`.trim(), "flow-hunger", null, "loss") };
  else if (id === "household-spoilage") parsed = { grain: flow("Spoilage", "flow-spoil", -(num(text, /^(\d+)/) ?? 0)) };
  else if (id === "household-spinning") parsed = {
    flax: flow("Spun", "flow-spin", -(num(text, /spins (\d+)/) ?? 0)),
    linen: flow("Spun", "flow-spin", num(text, /into (\d+) bolts/)),
  };
  else if (id.startsWith("army-wage-short") || id === "convoy-pay-shortfall") parsed = { drachmas: flow("Unpaid", "coin", null, "loss") };
  else if (id.startsWith("army-wage-need")) parsed = { drachmas: flow("Wage due", "coin", null) };
  else if (id.startsWith("army-wage")) parsed = { drachmas: flow("Army wage", "coin", num(text, /pays (\d+)/)) };
  else if (id === "convoy-paid") parsed = { drachmas: flow("Convoy pay", "coin", num(text, MONEY)) };
  else if (["market-trade", "market-household-buy", "army-sale", "offer-settled"].some(prefix => id.startsWith(prefix))) parsed = trade(text, mentioned);
  else if (/died$/.test(id)) {
    const died = num(text, /(\d+) \w+ died/) ?? 1;
    parsed = Object.fromEntries(touched.map(resource => [resource, flow("Died", RESOURCES[resource].icon, -died)]));
  } else if (id.startsWith("household-feed-")) {
    const eaten = num(text, /eats? (\d+)/);
    parsed = Object.fromEntries(touched.map(resource => [resource, resource === "grain" ? flow("Animal feed", "flow-eat", eaten === null ? null : -eaten) : flow("Fed", RESOURCES[resource].icon, null)]));
  }
  return Object.fromEntries(touched.map(resource => {
    const known = parsed[resource] ?? flow("Noted", RESOURCES[resource].icon, null);
    return [resource, { ...known, text }];
  }));
}

/** Total of the flows that carry an amount; null when none does. */
export function flowTotal(flows: readonly Pick<LedgerFlow, "delta">[]): number | null {
  const amounts = flows.map(item => item.delta).filter((delta): delta is number => delta !== null);
  return amounts.length ? amounts.reduce((sum, delta) => sum + delta, 0) : null;
}

/** "+1300", "−260" or "0": the sign is always shown, with a true minus sign. */
export function signedAmount(delta: number): string {
  const size = Number.isInteger(delta) ? Math.abs(delta) : Math.abs(delta).toFixed(2);
  return delta > 0 ? `+${size}` : delta < 0 ? `−${size}` : "0";
}
