/**
 * Warns before grain is lost to an overfull store: now (already over the limit) or by harvest (it will be), with the
 * spoilage rates and what the player can do about it at their age. Pure.
 */

export interface GrainStoreFacts {
  grain: number;
  capacity: number;
  expectedHarvest: number;
  expectedRent: number;
  expectedEating: number;
  /** Share of stored grain lost a year, inside the store and above its limit, in basis points. */
  spoilageBps: number;
  overCapacitySpoilageBps: number;
  age: number;
  /** First age the market takes orders; null when this life has no market. */
  tradeAge: number | null;
}

export interface GrainStoreAlert { tone: "danger" | "warning"; text: string }

function percent(bps: number): string {
  return `${Math.round(bps / 100)}%`;
}

/** One line on spoilage, for the store's tooltip and ledger. */
export function spoilageNote(facts: Pick<GrainStoreFacts, "capacity" | "spoilageBps" | "overCapacitySpoilageBps">): string {
  return `Stored grain loses about ${percent(facts.spoilageBps)} a year; grain above the store's limit of ${facts.capacity} loses about ${percent(facts.overCapacitySpoilageBps)}.`;
}

function remedy(facts: GrainStoreFacts): string {
  if (facts.tradeAge === null) return "Plant more flax so less grain comes in.";
  if (facts.age >= facts.tradeAge) return "Sell the extra at the market this year, or plant more flax so less grain comes in.";
  return `You can sell at the market from age ${facts.tradeAge}; until then, plant more flax so less grain comes in.`;
}

export function grainStoreAlert(facts: GrainStoreFacts): GrainStoreAlert | null {
  const over = facts.grain - facts.capacity;
  if (over > 0) {
    return { tone: "danger", text: `The store is over its limit by ${over}. Grain above ${facts.capacity} spoils about ${percent(facts.overCapacitySpoilageBps)} a year. ${remedy(facts)}` };
  }
  const afterHarvest = facts.grain + facts.expectedHarvest - facts.expectedRent - facts.expectedEating;
  if (afterHarvest > facts.capacity) {
    return { tone: "warning", text: `After this harvest the store will be over its limit by about ${afterHarvest - facts.capacity}, and that grain spoils about ${percent(facts.overCapacitySpoilageBps)} a year. ${remedy(facts)}` };
  }
  return null;
}
