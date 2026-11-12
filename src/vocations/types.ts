import type { CapabilityWorkState } from "../capabilities/runtime-types.ts";
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
  | { kind: "capability"; operation: string }
  | { kind: "work"; fee: number; pay: number; payer: "workshop" | "school" | "council"; primary: string; supports: string[]; practice: boolean; inputs?: Record<string, number> };
export interface VocationDefinition {
  materials: Record<string, { price: number; stock: number }>;
  recipes: Record<string, VocationRecipe>;
  actions: Record<string, VocationAction>;
  accounts: { merchant: number; workshop: number; school: number; council: number };
  /** Finite lifetime buyer demand; there is no unbacked annual refill. */
  demand: Record<string, number>;
}
export interface VocationState {
  capabilityWork?: CapabilityWorkState;
  inventory: Record<string, number>;
  /** Products retain their grade; materials use grade 1. */
  lots: { item: string; quality: number; quantity: number }[];
  stock: Record<string, number>;
  accounts: VocationDefinition["accounts"];
  demand: Record<string, number>;
  completed: Record<string, number>;
  workedAge: number | null;
  project?: { recipe: string; completedYears: number; quality: number; quantity?: number; inspected?: boolean; controlledFiring?: boolean; inputPaid?: boolean };
}
