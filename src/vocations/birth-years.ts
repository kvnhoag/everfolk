import type { WorldPack } from "../types.ts";
import { yearAtAge } from "../calendar.ts";

/** New births (alexandria-lives-9 and later) are born between 400 and 300 BCE. */
export const BIRTH_YEAR_RANGE = Object.freeze({ from: -400, to: -300 });

/** The ages at which history reaches a life and shapes it: from a child who notices to an elder. */
const HISTORY_AGES = Object.freeze({ from: 10, to: 60 });

/** Every birth year stays possible; history adds to this. */
const BASE_WEIGHT = 1;

const astronomical = (year: number) => (year < 0 ? year + 1 : year);

type Range = { readonly from: number; readonly to: number };

/** Years of the world's dated history: year-triggered events not pinned to the world's start (those can happen any time). */
function historyYears(world: WorldPack): number[] {
  return world.events
    .filter(event => event.trigger.type === "year" && event.trigger.at !== world.startYear)
    .map(event => astronomical((event.trigger as { at: number }).at));
}

/**
 * One whole-number weight per birth year from `range.from` to `range.to`: a base chance plus every
 * dated historical event that falls between ages 10 and 60 of a life born that year.
 */
export function historyBirthWeights(world: WorldPack, range: Range): number[] {
  const history = historyYears(world);
  const span = astronomical(range.to) - astronomical(range.from) + 1;
  return Array.from({ length: span }, (_, offset) => {
    const born = yearAtAge(range.from, offset);
    const first = astronomical(yearAtAge(born, HISTORY_AGES.from)), last = astronomical(yearAtAge(born, HISTORY_AGES.to));
    return BASE_WEIGHT + history.filter(year => year >= first && year <= last).length;
  });
}

/** Rules pinned to the world's start ("from the start", "at any time") move to the new start; dated history keeps its year. */
function moveStartAnchors(value: unknown, oldStart: number, newStart: number): unknown {
  if (Array.isArray(value)) return value.map(item => moveStartAnchors(item, oldStart, newStart));
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value).map(([key, item]) => [key, moveStartAnchors(item, oldStart, newStart)] as const);
  const moved = Object.fromEntries(entries) as Record<string, unknown>;
  if (moved.type !== "year") return moved;
  if (moved.at === oldStart) return { ...moved, at: newStart };
  if (moved.op === "gte" && moved.value === oldStart) return { ...moved, value: newStart };
  return moved;
}

/**
 * A copy of `world` whose lives are born across `range`, likelier in the years whose lives see the most history.
 * The world starts at `range.from`, so everyday events pinned to the old start reach the earliest births too.
 */
export function withHistoryBirthYears(world: WorldPack, range: Range): WorldPack {
  if (range.from > world.startYear) throw new Error(`Births from ${range.from} would start after the world (${world.startYear}).`);
  const weights = historyBirthWeights(world, range);
  const moved = moveStartAnchors(world, world.startYear, range.from) as WorldPack;
  return { ...moved, startYear: range.from, birthYears: { from: range.from, to: range.to, weights } };
}
