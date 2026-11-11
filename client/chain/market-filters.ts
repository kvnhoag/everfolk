import { CAREER_GROUPS, type CareerGroup } from "../../chain/ids.ts";
import { GROUP_TITLE, rarityLabel } from "./chain-copy.ts";
import type { MarketRow } from "./token-page-model.ts";

export type MarketSort = "price-asc" | "price-desc" | "newest";

export interface MarketFilter { group: CareerGroup | "all"; rarity: number | "all"; sort: MarketSort }

export const DEFAULT_FILTER: MarketFilter = { group: "all", rarity: "all", sort: "price-asc" };

export const SORT_OPTIONS: readonly { id: MarketSort; label: string }[] = [
  { id: "price-asc", label: "Price, low to high" },
  { id: "price-desc", label: "Price, high to low" },
  { id: "newest", label: "Newest minted" },
];

export interface FilterOptions {
  groups: { id: CareerGroup; label: string; count: number }[];
  rarities: { id: number; label: string; count: number }[];
}

/** Only the career groups and rarities present in the rows, with how many rows each has. */
export function filterOptions(rows: readonly MarketRow[]): FilterOptions {
  const groups = CAREER_GROUPS
    .map(id => ({ id, label: GROUP_TITLE[id], count: rows.filter(row => row.careerGroup === id).length }))
    .filter(option => option.count > 0);
  const present = [...new Set(rows.flatMap(row => row.rarity === null ? [] : [row.rarity]))].sort((a, b) => a - b);
  const rarities = present.map(id => ({ id, label: rarityLabel(id), count: rows.filter(row => row.rarity === id).length }));
  return { groups, rarities };
}

const NUMERIC = /^\d+$/;

/** Numeric strings compare as numbers; anything else is null and sorts last. */
function parseNumeric(value: string): bigint | null {
  return NUMERIC.test(value) ? BigInt(value) : null;
}

function compareKeys(a: bigint | null, b: bigint | null, direction: 1 | -1): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a < b ? -direction : a > b ? direction : 0;
}

const COMPARE: Record<MarketSort, (a: MarketRow, b: MarketRow) => number> = {
  "price-asc": (a, b) => compareKeys(parseNumeric(a.priceYocto), parseNumeric(b.priceYocto), 1),
  "price-desc": (a, b) => compareKeys(parseNumeric(a.priceYocto), parseNumeric(b.priceYocto), -1),
  newest: (a, b) => compareKeys(parseNumeric(a.tokenId), parseNumeric(b.tokenId), -1),
};

/** The filter with a group or rarity that is no longer on offer treated as "all". */
export function effectiveFilter(filter: MarketFilter, options: FilterOptions): MarketFilter {
  return {
    ...filter,
    group: filter.group !== "all" && !options.groups.some(item => item.id === filter.group) ? "all" : filter.group,
    rarity: filter.rarity !== "all" && !options.rarities.some(item => item.id === filter.rarity) ? "all" : filter.rarity,
  };
}

/** A new, filtered and sorted array; the input is not touched. */
export function applyFilter(rows: readonly MarketRow[], filter: MarketFilter): MarketRow[] {
  return rows
    .filter(row => (filter.group === "all" || row.careerGroup === filter.group) && (filter.rarity === "all" || row.rarity === filter.rarity))
    .sort(COMPARE[filter.sort]);
}
