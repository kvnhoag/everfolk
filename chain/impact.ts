import type { Command, InfluenceCommand, InfluenceSource, JournalEntry } from "../src/types.ts";
import { INFLUENCES, influenceFor } from "./catalog/index.ts";
import type { SourceImpact } from "./types.ts";

const entryByEvent = new Map(INFLUENCES.flatMap(entry => entry.event ? [[entry.event.id, entry.id] as const] : []));

/** Token ids are decimal strings on chain: shorter first, then lexical, which is numeric order for them. */
export function compareTokenIds(a: string, b: string): number {
  return a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
}

function sameSource(a: InfluenceSource, b: InfluenceSource): boolean {
  return a.contractId === b.contractId && a.tokenId === b.tokenId;
}

function powerBps(commands: readonly Command[], source: InfluenceSource, entry: string): number {
  const command = commands.find((item): item is InfluenceCommand =>
    item.type === "influence" && item.entry === entry && sameSource(item.source, source));
  if (!command) throw new Error(`Journal credits token ${source.tokenId} for ${entry} but the save has no matching influence command.`);
  return Math.round(command.power * 10000);
}

function entryOf(item: JournalEntry): string {
  const entry = item.type === "influence" ? item.id : item.type === "event" ? entryByEvent.get(item.id) : undefined;
  if (!entry) throw new Error(`Journal entry ${item.id} carries a source but names no influence entry.`);
  return entry;
}

/**
 * Impact is counted from the journal, not from the commands, so only influences that fired earn:
 *
 *   impact(token) = Σ over journal entries whose `source` is that token of
 *                   influenceFor(entry).baseWeight × round(power × 10000)
 *
 * - An `apply` journals one `influence` entry (its id is the action id) when issued: counted once.
 * - An `apply` whose entry also has an event queues it; when that event fires it journals an `event`
 *   entry with the same source: counted once more. A queued event that never fired adds nothing.
 * - An `activate` journals nothing by itself; each firing of its event journals one sourced `event`
 *   entry (id = the event id, mapped back to its action id): each firing counts once. An activation
 *   whose event never fired contributes nothing.
 * `power` is taken from the save's influence command for the same source and action.
 * Sources are sorted by impact (highest first), then by token id.
 */
export function computeImpacts(commands: readonly Command[], journal: readonly JournalEntry[]): SourceImpact[] {
  const totals = new Map<string, number>();
  for (const item of journal) {
    if (!item.source) continue;
    const entry = entryOf(item);
    const impact = influenceFor(entry).baseWeight * powerBps(commands, item.source, entry);
    totals.set(item.source.tokenId, (totals.get(item.source.tokenId) ?? 0) + impact);
  }
  return [...totals]
    .map(([token_id, impact]) => ({ token_id, impact }))
    .sort((a, b) => b.impact - a.impact || compareTokenIds(a.token_id, b.token_id));
}
