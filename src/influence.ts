import type { Effect, InfluenceCommand, InfluenceEntry, InfluenceSource, LifeEvent, LifeState, WorldPack } from "./types.ts";

/** Rarity powers top out at 3; the cap bounds scaled deltas without constraining the catalog. */
export const MAX_INFLUENCE_POWER = 10;
const MAX_TEXT = 256;
const COMMAND_FIELDS = ["type", "source", "entry", "power", "mode"] as const;
const SOURCE_FIELDS = ["contractId", "tokenId"] as const;
/** Effects whose `delta` is an amount; counts, closeness and flags apply unscaled. */
const SCALED_EFFECTS = new Set<Effect["type"]>(["stat", "skill", "cash", "debt"]);

function invalid(where: string, reason: string): never {
  throw new Error(`Invalid influence command${where}: ${reason}.`);
}

function record(value: unknown, fields: readonly string[]): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every(field => Object.hasOwn(value, field)) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TEXT;
}

/** Checks the wire shape and returns a detached copy in canonical field order. */
export function parseInfluenceCommand(value: unknown, where = ""): InfluenceCommand {
  const command = record(value, COMMAND_FIELDS);
  if (!command || command.type !== "influence") invalid(where, "expected exactly type, source, entry, power and mode");
  const source = record(command.source, SOURCE_FIELDS);
  if (!source || !text(source.contractId) || !text(source.tokenId)) {
    invalid(where, `source needs nonempty contractId and tokenId strings of at most ${MAX_TEXT} characters`);
  }
  if (!text(command.entry)) invalid(where, `entry must be a nonempty string of at most ${MAX_TEXT} characters`);
  const power = command.power;
  if (typeof power !== "number" || !Number.isFinite(power) || power <= 0 || power > MAX_INFLUENCE_POWER) {
    invalid(where, `power must be a number in (0, ${MAX_INFLUENCE_POWER}]`);
  }
  if (command.mode !== "activate" && command.mode !== "apply") invalid(where, "mode must be activate or apply");
  return {
    type: "influence",
    source: { contractId: source.contractId as string, tokenId: source.tokenId as string },
    entry: command.entry, power, mode: command.mode,
  };
}

/** Amount deltas are multiplied by power and rounded toward zero; other effects are unchanged. */
export function scaleInfluenceEffects(effects: readonly Effect[], power: number): Effect[] {
  return effects.map(effect => SCALED_EFFECTS.has(effect.type) && "delta" in effect
    ? { ...effect, delta: Math.trunc(effect.delta * power) || 0 } as Effect
    : effect);
}

/** Numeric values an applied influence can change, keyed as journaled in `deltas`. */
export function influenceMeasure(state: LifeState): Record<string, number> {
  const skills = Object.entries(state.character?.skills ?? {}).map(([id, value]) => [`skill:${id}`, value] as const);
  const money = state.economy ? [["economy:cash", state.economy.cash], ["economy:debt", state.economy.debt]] as const : [];
  return { ...state.stats, ...Object.fromEntries(skills), ...Object.fromEntries(money) };
}

export function influenceDeltas(before: Record<string, number>, after: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(after)
    .map(([key, value]) => [key, value - (before[key] ?? 0)] as const)
    .filter(([, change]) => change !== 0));
}

export interface InfluenceCatalog {
  /** The world's events followed by catalog events; the same array when there are none. */
  readonly events: readonly LifeEvent[];
  entry(id: string): InfluenceEntry;
  /** Catalog events stay out of every pool until their entry is activated. */
  inactive(eventId: string, state: LifeState): boolean;
  /** The first activation's source, credited when a catalog event fires from the pool. */
  activatedSource(eventId: string, state: LifeState): InfluenceSource | undefined;
}

export function influenceCatalog(world: WorldPack): InfluenceCatalog {
  const entries = world.influences ?? [];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const byEvent = new Map(entries.flatMap(entry => entry.event ? [[entry.event.id, entry] as const] : []));
  const activation = (eventId: string, state: LifeState) => {
    const entry = byEvent.get(eventId);
    return entry && state.activeInfluences?.find(active => active.entry === entry.id);
  };
  return {
    events: byEvent.size ? [...world.events, ...[...byEvent.values()].map(entry => entry.event!)] : world.events,
    entry(id) {
      const entry = byId.get(id);
      if (!entry) throw new Error(`Unknown influence entry: ${id}`);
      return entry;
    },
    inactive: (eventId, state) => byEvent.has(eventId) && !activation(eventId, state),
    activatedSource: (eventId, state) => activation(eventId, state)?.source,
  };
}
