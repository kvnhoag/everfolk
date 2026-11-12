import { getAssetValue, getNetWorth } from "../../src/economy.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { getSocietyWealthData } from "./society-wealth-data.ts";
import type { SocietyWealthGroup, UniformRoll } from "./society-wealth-data.ts";

export interface WealthComparison {
  /** Cash and holdings minus debt, shown as total wealth. */
  netWorth: number;
  /** Cash and holdings before debt: the measure households are ranked by, matching the debt-free reference households. */
  totalAssets: number;
  /** Percentage of reference households with strictly less wealth. Ties are excluded. */
  percentile: number;
  medianWealth: number;
}

/** Sum floor((a * i + b) / m), using whole-number arithmetic even for wide rolls. */
function floorSum(n: bigint, m: bigint, a: bigint, b: bigint): bigint {
  let sum = 0n;
  while (true) {
    sum += (n - 1n) * n * (a / m) / 2n + n * (b / m);
    a %= m; b %= m;
    const top = a * n + b;
    if (top < m) return sum;
    n = top / m; b = top % m;
    [m, a] = [a, m];
  }
}

const rollDelta = (roll: UniformRoll, index: number): number => roll.valueAt ? roll.valueAt(index) - roll.first : index * roll.step;
const rollSpan = (roll: UniformRoll): number => rollDelta(roll, roll.count - 1);
function rollCount(roll: UniformRoll, ceiling: number): number {
  if (!roll.valueAt) return roll.step ? Math.max(0, Math.min(roll.count, Math.floor(ceiling / roll.step) + 1)) : ceiling >= 0 ? roll.count : 0;
  let low = 0, high = roll.count;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    if (rollDelta(roll, middle) <= ceiling) low = middle + 1; else high = middle;
  }
  return low;
}

/** Exact CDF of two independent, inclusive whole-number rolls. */
function pairShare(a: UniformRoll, b: UniformRoll, ceiling: number): number {
  if (ceiling < 0) return 0;
  if (ceiling >= rollSpan(a) + rollSpan(b)) return 1;
  if (a.valueAt || b.valueAt) {
    let pairs = 0;
    for (let index = 0; index < rollCount(a, ceiling); index++) pairs += rollCount(b, ceiling - rollDelta(a, index));
    return pairs / (a.count * b.count);
  }
  if (!a.step) return Math.max(0, Math.min(b.count, Math.floor(ceiling / b.step) + 1)) / b.count;
  if (!b.step) return Math.max(0, Math.min(a.count, Math.floor(ceiling / a.step) + 1)) / a.count;
  const eligible = Math.min(a.count, Math.floor(ceiling / a.step) + 1);
  const full = Math.max(0, Math.min(eligible, Math.floor((ceiling - (b.count - 1) * b.step) / a.step) + 1));
  const remaining = eligible - full;
  const pairs = BigInt(full) * BigInt(b.count) + BigInt(remaining) + floorSum(
    BigInt(remaining), BigInt(b.step), BigInt(a.step), BigInt(ceiling - (eligible - 1) * a.step));
  return Number(pairs) / (a.count * b.count);
}

function rollShare(rolls: UniformRoll[], ceiling: number): number {
  if (ceiling < 0) return 0;
  if (ceiling >= rolls.reduce((sum, roll) => sum + rollSpan(roll), 0)) return 1;
  if (!rolls.length) return 1;
  if (rolls.length === 1) return rollCount(rolls[0], ceiling) / rolls[0].count;
  if (rolls.length === 2) return pairShare(rolls[0], rolls[1], ceiling);
  const [roll, ...rest] = rolls;
  const eligible = rollCount(roll, ceiling);
  let share = 0;
  for (let index = 0; index < eligible; index++) share += rollShare(rest, ceiling - rollDelta(roll, index));
  return share / roll.count;
}

/** Cash clamps can create repeated endpoints; the middle remains a uniform roll. */
function householdShare(group: SocietyWealthGroup, wealth: number, step: number, includeEqual = false): number {
  if (!group.resources.length) return countBelow(group, wealth, includeEqual) / group.count;
  const first = group.wealthAt(0), last = group.wealthAt(group.count - 1);
  const prefix = first === last ? group.count : countBelow(group, first, true);
  const suffixStart = first === last ? group.count : countBelow(group, last);
  const cash = [{ first, step: 0, count: 1, weight: prefix / group.count }];
  if (suffixStart > prefix) cash.push({ first: group.wealthAt(prefix), step, count: suffixStart - prefix, weight: (suffixStart - prefix) / group.count });
  if (suffixStart < group.count) cash.push({ first: last, step: 0, count: 1, weight: (group.count - suffixStart) / group.count });
  return cash.reduce((share, segment) => {
    const components: UniformRoll[] = [segment, ...group.resources];
    const base = components.reduce((sum, roll) => sum + roll.first, 0);
    const rolls = components.filter(roll => (roll.step > 0 || roll.valueAt) && roll.count > 1).sort((a, b) => a.count - b.count);
    const ceiling = Math.ceil(wealth - base) - 1 + (includeEqual && Number.isInteger(wealth - base) ? 1 : 0);
    return share + segment.weight * rollShare(rolls, ceiling);
  }, 0);
}

/** Count a monotone origin distribution without enumerating its starting range. */
function countBelow(group: SocietyWealthGroup, wealth: number, includeEqual = false): number {
  let low = 0, high = group.count;
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    const value = group.wealthAt(middle);
    if (value < wealth || includeEqual && value === wealth) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * Compare current net worth with the retrieved society wealth population.
 * Retrieval currently returns authored starting households as mock data;
 * it is not a measured historical or age-adjusted population.
 * Reads only: no sampling, extra engine starts, or simulation RNG use.
 */
export function getWealthComparison(world: WorldPack, life: LifeState, explicitObservations?: readonly number[]): WealthComparison | null {
  const economy = world.economy;
  if (!economy || !life.economy) return null;
  const groups = getSocietyWealthData(world, explicitObservations);
  const totalWeight = groups.reduce((sum, group) => sum + group.weight, 0);
  const weightBelow = (wealth: number, includeEqual = false) => groups.reduce((sum, group) =>
    sum + group.weight * householdShare(group, wealth, economy.unitsPerPoint, includeEqual), 0);
  const netWorth = getNetWorth(world, life);
  const totalAssets = life.economy.cash + getAssetValue(world, life);
  let low = Math.min(...groups.map(group => group.wealthAt(0) + group.resources.reduce((sum, roll) => sum + roll.first, 0)));
  let high = Math.max(...groups.map(group => group.wealthAt(group.count - 1) + group.resources.reduce((sum, roll) => sum + roll.first + rollSpan(roll), 0)));
  // Currency amounts are whole numbers. The first amount reaching half the
  // weighted population is a support value, including when clamps create ties.
  while (low < high) {
    const middle = low + Math.floor((high - low) / 2);
    // Summing independent roll probabilities can round a true half a few ulps
    // downward. Keep the lower median at that boundary.
    if (weightBelow(middle, true) / totalWeight >= 0.5 - Number.EPSILON) high = middle;
    else low = middle + 1;
  }
  return { netWorth, totalAssets, percentile: Math.max(0, Math.min(100, weightBelow(totalAssets) / totalWeight * 100)), medianWealth: low };
}

export function formatWealthPercentile(percentile: number): string {
  if (percentile > 0 && percentile < 0.1) return "<0.1%";
  if (percentile > 99.9 && percentile < 100) return ">99.9%";
  return `${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(percentile)}%`;
}

/** Describe the nearest end of society's wealth ranking. */
export function formatWealthStanding(percentile: number): string {
  if (percentile === 50) return "At the median";
  const share = percentile < 50 ? percentile : 100 - percentile;
  return `${percentile < 50 ? "Bottom" : "Top"} ${share === 0 ? "<0.1%" : formatWealthPercentile(share)}`;
}
