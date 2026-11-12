/** Opt-in rules for new lives; earlier packs have no vocation ledger. */
export interface VocationRecipe {
  title: string;
  inputs: Record<string, number>;
  output: string;
  outputQuantity: number;
  fee: number;
  workYears: number;
  skills: Record<string, number>;
  primary: string;
  supports: string[];
  baseAsk: number;
}
export type VocationAction =
  | { kind: "buy"; item: string; quantity: number }
  | { kind: "sell"; item: string }
  | { kind: "make"; recipe: string; quantity?: number; inspected?: boolean; controlledFiring?: boolean }
  | { kind: "work"; fee: number; pay: number; payer: "workshop" | "school" | "council"; primary: string; supports: string[]; practice: boolean };
export interface VocationDefinition {
  materials: Record<string, { price: number; stock: number }>;
  recipes: Record<string, VocationRecipe>;
  actions: Record<string, VocationAction>;
  accounts: { merchant: number; workshop: number; school: number; council: number };
  /** Finite lifetime buyer demand; there is no unbacked annual refill (unless `trade` sets yearly buyers). */
  demand: Record<string, number>;
  /** Track B (lives-4 and later): a craftsperson's trade. Absent: one sale and one bought lot at a time, lifetime buyers. */
  trade?: VocationTradeConfig;
}
/**
 * Workshop trade for a full-time craftsperson. A make action buys its missing inputs from the supplier,
 * a sale sells the whole lot to funded buyers, buyers return each year, and the supplier restocks each
 * year by paying outside sellers for what arrives. Money only moves between finite accounts and the household
 * (or out of the town for restocked materials), never appears.
 */
export interface VocationTradeConfig {
  /** Share of a product's value the merchant pays, basis points (older packs: 8000, a 25% markup). */
  bidBps: number;
  /** Buyers each product has again at the start of each year. */
  yearlyDemand: Record<string, number>;
}
export interface VocationState {
  inventory: Record<string, number>;
  /** Products retain their grade; materials use grade 1. */
  lots: { item: string; quality: number; quantity: number }[];
  stock: Record<string, number>;
  accounts: VocationDefinition["accounts"];
  demand: Record<string, number>;
  completed: Record<string, number>;
  workedAge: number | null;
  project?: { recipe: string; completedYears: number; quality: number; outputQuantity?: number; quantity?: number };
}
