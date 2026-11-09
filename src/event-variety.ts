import type { EventVariety, LifeEvent, LifeState } from "./types.ts";

/** Relative weights only: no RNG, mutation, eligibility changes or forced story.
 * Each lane remembers its own random events, including ones no longer eligible.
 * eventById contains regular random stories only, excluding medical/loan
 * interrupts. Scheduled history does not consume that memory. */
export function randomEventWeights(
  events: readonly LifeEvent[],
  eventById: ReadonlyMap<string, LifeEvent>,
  state: Pick<LifeState, "eventCounts" | "journal">,
  policy: EventVariety,
): Map<string, number> {
  const recent = { automatic: new Set<string>(), decision: new Set<string>() };
  const remaining = { automatic: policy.recentWindow, decision: policy.recentWindow };
  for (let i = state.journal.length - 1; i >= 0; i--) {
    const entry = state.journal[i];
    if (entry.type !== "event") continue;
    const event = eventById.get(entry.id);
    if (!event || event.trigger.type !== "random") continue;
    const lane = event.mode === "automatic" ? "automatic" : "decision";
    if (remaining[lane] > 0) {
      recent[lane].add(event.id);
      remaining[lane]--;
    }
    if (remaining.automatic === 0 && remaining.decision === 0) break;
  }
  // Log-space normalization preserves ratios when all authored weights are
  // subnormal, instead of multiplying tiny values into an all-zero pool.
  const logs = events.map(event => {
    if (event.trigger.type !== "random") throw new Error("Variety weights require random events.");
    const count = state.eventCounts[event.id] ?? 0;
    const lane = event.mode === "automatic" ? "automatic" : "decision";
    return Math.log(event.trigger.weight) - Math.log1p(count * (1 / policy.repeatWeight - 1)) +
      (recent[lane].has(event.id) ? Math.log(policy.recentWeight) : 0);
  });
  const maximum = Math.max(...logs);
  return new Map(events.map((event, i) => [event.id, Math.exp(logs[i] - maximum)]));
}
