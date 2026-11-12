export interface CapabilityRule {
  years: number; primary: string; supports: string[];
  kind: "exercise" | "craft" | "research" | "civic" | "trade" | "military";
  recipe?: string; quantity?: number; minimumQuality?: number; inspected?: boolean;
  contract?: boolean; project?: boolean;
  fee?: number; pay?: number; payer?: "merchant" | "workshop" | "school" | "council";
  inputs?: Record<string, number>; reputation?: number;
}
const craft = (years: number, recipe: string, quantity = 1, minimumQuality = 1, inspected = false, contract = false, project = false): CapabilityRule => ({ years, primary: "craft", supports: ["reckoning"], kind: "craft", recipe, quantity, minimumQuality, inspected, contract, project });
const research = (years: number, fee: number, pay: number, paper: number, ink: number, project = false): CapabilityRule => ({ years, primary: "philosophy", supports: ["reckoning", "literacy"], kind: "research", fee, pay, payer: "school", inputs: { papyrus: paper, ink }, project });
const civic = (years: number, pay: number, paper: number, ink: number, reputation: number, project = false): CapabilityRule => ({ years, primary: "philosophy", supports: ["oratory", "reckoning"], kind: "civic", pay, payer: "council", inputs: { papyrus: paper, ink }, reputation, project });
const trade = (years: number, pay: number, fee = 0, project = false): CapabilityRule => ({ years, primary: "reckoning", supports: ["literacy"], kind: "trade", pay, fee, payer: "merchant", project });
/** Counts here are explicit work-year requirements, never parsed from display prose. */
export const CAPABILITY_RULES: Record<string, CapabilityRule> = {
  B2: {years:2,primary:"strength",supports:["endurance"],kind:"exercise",fee:2},
  B3: {years:2,primary:"endurance",supports:["strength"],kind:"exercise",fee:2},
  M4: {years:2,primary:"warfare",supports:["strength","endurance"],kind:"military",fee:4},
  M5: {years:2,primary:"warfare",supports:["strength","endurance"],kind:"military"},
  M6: {years:2,primary:"warfare",supports:["reckoning","literacy"],kind:"military",inputs:{papyrus:1,ink:1},fee:2},
  M7: {years:2,primary:"warfare",supports:["oratory","endurance"],kind:"military"},
  M8: {years:2,primary:"warfare",supports:["reckoning","oratory"],kind:"military",inputs:{papyrus:1,ink:1},fee:2},
  M9: {years:2,primary:"warfare",supports:["literacy","oratory"],kind:"military",inputs:{papyrus:1,ink:1},fee:2},
  M10: {years:2,primary:"warfare",supports:["oratory","reckoning"],kind:"military",inputs:{papyrus:2,ink:2},fee:4,project:true},
  A1: { years: 1, primary: "craft", supports: ["reckoning"], kind: "exercise", fee: 2, pay: 12, payer: "workshop" },
  A2: { years: 1, primary: "craft", supports: ["reckoning"], kind: "exercise", fee: 2, inputs: { clay: 1 } },
  A3: { years: 2, primary: "craft", supports: ["pottery", "reckoning"], kind: "exercise", fee: 2, inputs: { clay: 2 } },
  A4: craft(2, "vessel"),
  AT5: craft(2, "garment"), AT6: craft(2, "garment", 1, 2),
  AT7: craft(2, "garment", 1, 2, true, true), AT8: craft(2, "garment", 4, 3),
  AT9: craft(2, "garment", 4, 3, true, true), AT10: craft(2, "ceremonial-garment", 4, 4, true, true, true),
  AC5: craft(2, "vessel"), AC6: craft(2, "vessel", 4, 2),
  AC7: craft(2, "vessel", 4, 2, true, true), AC8: craft(2, "vessel", 8, 3),
  AC9: craft(2, "decorated-vessel", 8, 3, true, true), AC10: craft(2, "decorated-vessel", 12, 4, true, true, true),
  AS5: craft(2, "clay-model"), AS6: craft(2, "small-relief", 1, 2),
  AS7: craft(2, "stone-figure", 1, 2, true, true), AS8: craft(1, "bust", 1, 3),
  AS9: craft(2, "large-relief", 1, 3, true, true, true), AS10: craft(2, "monument", 1, 4, true, true, true),
  P1: { ...research(1, 2, 0, 1, 1), supports: ["literacy", "oratory"] },
  P2: { ...research(1, 2, 0, 1, 1), supports: ["oratory", "literacy"] },
  P3: research(2, 3, 0, 1, 1), P4: { ...research(2, 3, 0, 1, 1), supports: ["literacy", "oratory"] },
  PS5: research(2, 0, 20, 1, 1), PS6: research(2, 5, 40, 2, 1),
  PS7: research(1, 5, 60, 2, 2), PS8: research(2, 10, 90, 2, 2),
  PS9: research(1, 0, 90, 2, 1), PS10: research(2, 10, 180, 4, 3, true),
  PP5: civic(2, 20, 1, 1, 2), PP6: civic(2, 40, 1, 1, 3),
  PP7: civic(1, 60, 2, 1, 4), PP8: civic(2, 90, 2, 2, 4),
  PP9: civic(2, 180, 4, 3, 5, true), PP10: civic(2, 180, 4, 3, 5, true),
  T1: trade(1, 8), T2: trade(1, 0), T3: trade(2, 0), T4: trade(2, 10),
  T5: trade(2, 20), T6: trade(2, 20), T7: trade(2, 32, 12), T8: trade(2, 20),
  T9: trade(2, 40, 12), T10: trade(2, 80, 24, true),
};
export function ruleFor(id: string): CapabilityRule | undefined { return CAPABILITY_RULES[id]; }
