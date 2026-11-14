/**
 * When the game teaches earning money: the first year work actions appear in the yearly-action deck, or the first
 * year the household's cash falls below about a year of its costs, whichever comes first. Pure.
 */

export interface EarningActivity { category: string; available: boolean }

/** What a year costs the household, read from its grain needs: the food it eats and the rent it owes. */
export interface HouseholdCosts {
  /** Measures of grain eaten in a year. */
  eating: number;
  /** Measures of grain owed as rent in a year. */
  rent: number;
  /** What a measure of grain costs at the market. */
  grainPrice: number;
}

/** About a year of the household's costs, in cash; 0 when the world has no household economy. */
export function yearOfCosts(costs: HouseholdCosts | null): number {
  if (!costs) return 0;
  const value = (Math.max(0, costs.eating) + Math.max(0, costs.rent)) * Math.max(0, costs.grainPrice);
  return Number.isFinite(value) ? value : 0;
}

/** The household could not pay for another year from its purse alone. */
export function cashShort(cash: number | null | undefined, costs: HouseholdCosts | null): boolean {
  const year = yearOfCosts(costs);
  return typeof cash === "number" && year > 0 && cash < year;
}

/** Work actions are on offer in the yearly-action deck now. */
export function workOffered(activities: readonly EarningActivity[]): boolean {
  return activities.some(activity => activity.category === "career" && activity.available);
}

export interface EarningFacts { workOffered: boolean; cashShort: boolean }

export function earningFacts(activities: readonly EarningActivity[], cash: number | null | undefined, costs: HouseholdCosts | null): EarningFacts {
  return { workOffered: workOffered(activities), cashShort: cashShort(cash, costs) };
}

/** The household screen's numbers this step reads; null without a household economy. */
export interface HouseholdScreen {
  household: { expectedEating: number; expectedRent: number };
  market: { quotes: readonly { item: string; sell: number }[] };
}

export function householdCosts(screen: HouseholdScreen | null | undefined): HouseholdCosts | null {
  if (!screen) return null;
  const grain = screen.market.quotes.find(quote => quote.item === "grain");
  return grain ? { eating: screen.household.expectedEating, rent: screen.household.expectedRent, grainPrice: grain.sell } : null;
}
