/**
 * Warns before the household goes short of food (the harvest will not feed everyone) and before grain is lost to an
 * overfull store, now or by harvest, with the numbers and what the player can do about it at their age. Food comes
 * first: a household that will go hungry hears about that, not about spoilage. Pure.
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
  /** First age the player plans the household's fields. */
  plantingAge: number;
  /** The player's cash and the price of a measure of grain at the merchant, to say what the cash covers. */
  cash?: number;
  grainPrice?: number;
  /** Plots planned for flax: only then can sowing more grain help. */
  flaxPlots?: number;
}

export interface GrainStoreAlert { tone: "danger" | "warning"; text: string }

function percent(bps: number): string {
  return `${Math.round(bps / 100)}%`;
}

/** One line on spoilage, for the store's tooltip and ledger. */
export function spoilageNote(facts: Pick<GrainStoreFacts, "capacity" | "spoilageBps" | "overCapacitySpoilageBps">): string {
  return `Stored grain loses about ${percent(facts.spoilageBps)} a year; grain above the store's limit of ${facts.capacity} loses about ${percent(facts.overCapacitySpoilageBps)}.`;
}

/** Only what the player can do now; before that, when they will be able to. Never advice they cannot follow. */
function remedy(facts: GrainStoreFacts): string {
  const canSell = facts.tradeAge !== null && facts.age >= facts.tradeAge;
  const canPlant = facts.age >= facts.plantingAge;
  if (canSell && canPlant) return "Sell the extra at the market this year, or plant more flax so less grain comes in.";
  if (canSell) return "Sell the extra at the market this year.";
  if (canPlant) return "Plant more flax so less grain comes in.";
  const sellAt = facts.tradeAge !== null ? facts.tradeAge : null;
  return sellAt !== null ? `Your family runs the store for now; from age ${sellAt} you can sell the extra at the market.` : "Your family runs the store for now.";
}

/** What the player can do about a coming food shortage at their age. */
function foodRemedy(facts: GrainStoreFacts): string {
  const canSell = facts.tradeAge !== null && facts.age >= facts.tradeAge;
  const canSow = facts.age >= facts.plantingAge && (facts.flaxPlots ?? 0) > 0;
  if (canSow && canSell) return "Sow more plots with grain, or buy grain at the market.";
  if (canSow) return "Sow more plots with grain.";
  if (canSell) return "Buy grain at the market.";
  return "Your family runs the store for now.";
}

/** The harvest will not feed everyone: how short, what the cash covers, and what happens to the rest. */
function foodAlert(facts: GrainStoreFacts): GrainStoreAlert | null {
  const short = facts.expectedEating + facts.expectedRent - facts.grain - facts.expectedHarvest;
  if (short <= 0) return null;
  const price = facts.grainPrice ?? 0, cash = facts.cash ?? 0;
  const covers = price > 0 ? Math.floor(cash / price) : 0;
  if (price > 0 && covers >= short) {
    return { tone: "warning", text: `This harvest will not feed everyone: the household will be about ${short} grain short and will buy it with about ${Math.ceil(short * price)} of your cash. ${foodRemedy(facts)}` };
  }
  const purse = cash > 0 && price > 0 ? `, and your cash buys only about ${covers}` : " with no cash to buy it";
  return { tone: "danger", text: `Food will run short: after this harvest the household will be about ${short} grain short${purse}. It will sell linen, flax or animals for food; if nothing is left to sell, everyone goes hungry and loses health. ${foodRemedy(facts)}` };
}

export function grainStoreAlert(facts: GrainStoreFacts): GrainStoreAlert | null {
  const food = foodAlert(facts);
  if (food) return food;
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
