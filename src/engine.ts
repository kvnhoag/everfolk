import type {
  Choice, Command, Comparison, Condition, Effect, JournalEntry,
  LifeEngine, LifeEvent, LifeState, SaveFile, WorldPack,
} from "./types.ts";
import { validateWorld } from "./validate.ts";
import { canonicalJson, contentFingerprint, nextRandom, seedToUint32 } from "./random.ts";
import { yearAtAge } from "./calendar.ts";

const MAX_COMMANDS = 50_000;
const MAX_SAVE_LENGTH = 8_000_000;

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function compare(left: number, op: Comparison, right: number): boolean {
  switch (op) {
    case "eq": return left === right;
    case "ne": return left !== right;
    case "gt": return left > right;
    case "gte": return left >= right;
    case "lt": return left < right;
    case "lte": return left <= right;
  }
}

function matches(condition: Condition | undefined, state: LifeState): boolean {
  if (!condition) return true;
  switch (condition.type) {
    case "stat": return compare(state.stats[condition.stat], condition.op, condition.value);
    case "flag": return state.flags[condition.flag] === condition.value;
    case "age": return compare(state.age, condition.op, condition.value);
    case "year": return compare(state.year, condition.op, condition.value);
    case "origin": return state.originId === condition.origin;
    case "all": return condition.conditions.every(child => matches(child, state));
    case "any": return condition.conditions.some(child => matches(child, state));
    case "not": return !matches(condition.condition, state);
  }
}

function pick<T>(items: readonly T[], weight: (item: T) => number, state: LifeState): T {
  if (items.length === 0) throw new Error("Cannot select from an empty list.");
  if (items.length === 1) return items[0];
  const draw = nextRandom(state.rngState);
  state.rngState = draw.state;
  // Relative weights must retain their ratio even when all are subnormal floats.
  const maximum = items.reduce((largest, item) => Math.max(largest, weight(item)), 0);
  const weights = items.map(item => weight(item) / maximum);
  let remaining = draw.value * weights.reduce((sum, value) => sum + value, 0);
  for (let i = 0; i < items.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return items[i];
  }
  return items[items.length - 1];
}

function mutableSnapshot(state: LifeState): LifeState {
  // Historical entries are frozen and safe to share across public snapshots.
  return {
    ...state,
    stats: { ...state.stats }, flags: { ...state.flags },
    eventCounts: { ...state.eventCounts }, lastEventAge: { ...state.lastEventAge },
    journal: [...state.journal], commands: [...state.commands],
  };
}

export function createEngine(input: unknown): LifeEngine {
  validateWorld(input);
  // Own a detached immutable pack so the caller cannot change rules mid-life.
  const world: WorldPack = freeze(structuredClone(input));
  const fingerprint = contentFingerprint(world);
  const eventById = new Map(world.events.map(event => [event.id, event]));
  const endingById = new Map(world.endings.map(ending => [ending.id, ending]));

  function journal(state: LifeState, type: JournalEntry["type"], id: string, text: string): void {
    state.journal.push({ type, id, text, age: state.age, year: state.year });
  }

  function finish(state: LifeState, id: string): void {
    if (state.phase === "ended") return;
    const ending = endingById.get(id);
    if (!ending) throw new Error(`Unknown ending: ${id}`);
    state.phase = "ended";
    state.endingId = id;
    state.pendingEventId = null;
    journal(state, "ending", id, `${ending.title}: ${ending.text}`);
  }

  function apply(state: LifeState, effects: readonly Effect[]): void {
    for (const effect of effects) {
      switch (effect.type) {
        case "stat": {
          const definition = world.stats[effect.stat];
          state.stats[effect.stat] = Math.max(definition.min,
            Math.min(definition.max, state.stats[effect.stat] + effect.delta));
          break;
        }
        case "flag": state.flags[effect.flag] = effect.value; break;
        case "end": finish(state, effect.ending); return;
      }
    }
  }

  function checkEndings(state: LifeState): void {
    if (state.phase === "ended") return;
    const ending = world.endings.find(candidate => candidate.when && matches(candidate.when, state));
    if (ending) finish(state, ending.id);
    else if (state.age >= world.maxAge) finish(state, world.defaultEnding);
  }

  function choicesFor(event: LifeEvent, state: LifeState): Choice[] {
    return event.choices.filter(choice => matches(choice.when, state));
  }

  function eligible(event: LifeEvent, state: LifeState): boolean {
    if ((state.eventCounts[event.id] ?? 0) >= (event.maxOccurrences ?? 1)) return false;
    if (!matches(event.when, state) || choicesFor(event, state).length === 0) return false;
    switch (event.trigger.type) {
      case "age": return state.age >= event.trigger.at;
      case "year": return state.year >= event.trigger.at;
      case "random": {
        const lastAge = state.lastEventAge[event.id];
        return lastAge === undefined || state.age - lastAge >= (event.cooldownYears ?? 1);
      }
    }
  }

  function offer(state: LifeState, event: LifeEvent): void {
    state.eventCounts[event.id] = (state.eventCounts[event.id] ?? 0) + 1;
    state.lastEventAge[event.id] = state.age;
    state.pendingEventId = event.id;
    state.phase = "choice";
    journal(state, "event", event.id, `${event.title}: ${event.text}`);
  }

  function resolveEvents(state: LifeState, allowRandom: boolean): void {
    if (state.phase === "ended") return;
    // Due scheduled events queue in declaration order and never silently overwrite each other.
    const scheduled = world.events.find(event => event.trigger.type !== "random" && eligible(event, state));
    if (scheduled) { offer(state, scheduled); return; }
    if (allowRandom) {
      const random = world.events.filter(event => event.trigger.type === "random" && eligible(event, state));
      if (random.length > 0) {
        const event = pick(random, candidate => candidate.trigger.type === "random" ? candidate.trigger.weight : 0, state);
        offer(state, event);
        return;
      }
    }
    state.phase = "ready";
    state.pendingEventId = null;
  }

  function assertCompatible(state: LifeState): void {
    if (!state || state.schemaVersion !== 1 || state.worldId !== world.id ||
      state.worldVersion !== world.version || state.worldFingerprint !== fingerprint) {
      throw new Error("State belongs to a different world, content revision or engine schema.");
    }
    if (state.phase === "choice" && !eventById.has(state.pendingEventId ?? "")) {
      throw new Error("State has an unknown pending event.");
    }
  }

  function assertPlayable(state: LifeState): void {
    assertCompatible(state);
    if (state.phase === "ended") throw new Error("This life has ended.");
    if (state.commands.length >= MAX_COMMANDS) throw new Error("Life command limit reached.");
  }

  function start(seed: string): LifeState {
    if (typeof seed !== "string" || seed.length === 0 || seed.length > 256) {
      throw new Error("Seed must be a string of 1 to 256 characters.");
    }
    const state: LifeState = {
      schemaVersion: 1, worldId: world.id, worldVersion: world.version,
      worldFingerprint: fingerprint, seed, rngState: seedToUint32(seed),
      age: 0, year: world.startYear, originId: "",
      stats: Object.fromEntries(Object.entries(world.stats).map(([id, definition]) => [id, definition.initial])),
      flags: Object.fromEntries(Object.entries(world.flags).map(([id, definition]) => [id, definition.initial])),
      phase: "ready", pendingEventId: null, endingId: null,
      eventCounts: {}, lastEventAge: {}, journal: [], commands: [],
    };
    const origin = pick(world.origins, candidate => candidate.weight, state);
    state.originId = origin.id;
    journal(state, "birth", origin.id, `${origin.title}: ${origin.text}`);
    apply(state, origin.effects);
    checkEndings(state);
    resolveEvents(state, true);
    return freeze(state);
  }

  function advanceInto(next: LifeState): void {
    assertPlayable(next);
    if (next.phase === "choice") throw new Error("Resolve the pending choice before advancing time.");
    next.commands.push({ type: "advance" });
    next.age += 1;
    next.year = yearAtAge(world.startYear, next.age);
    journal(next, "year", `age-${next.age}`, `Age ${next.age}`);
    apply(next, world.yearlyEffects);
    checkEndings(next);
    resolveEvents(next, true);
  }

  function chooseInto(next: LifeState, choiceId: string): void {
    assertPlayable(next);
    if (next.phase !== "choice") throw new Error("There is no pending choice.");
    const event = eventById.get(next.pendingEventId!)!;
    const choice = choicesFor(event, next).find(candidate => candidate.id === choiceId);
    if (!choice) throw new Error(`Choice is unavailable: ${choiceId}`);
    next.commands.push({ type: "choose", choice: choiceId });
    next.phase = "ready";
    next.pendingEventId = null;
    journal(next, "choice", choice.id, choice.text);
    const outcome = pick(choice.outcomes, candidate => candidate.weight, next);
    journal(next, "outcome", outcome.id, outcome.text);
    apply(next, outcome.effects);
    checkEndings(next);
    // Resolve other due scheduled events at this age, without generating extra random events.
    resolveEvents(next, false);
  }

  function advance(state: LifeState): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    advanceInto(next);
    return freeze(next);
  }

  function choose(state: LifeState, choiceId: string): LifeState {
    assertPlayable(state);
    const next = mutableSnapshot(state);
    chooseInto(next, choiceId);
    return freeze(next);
  }

  function getChoices(state: LifeState): readonly Choice[] {
    assertCompatible(state);
    if (state.phase !== "choice") return Object.freeze([]);
    return Object.freeze(choicesFor(eventById.get(state.pendingEventId!)!, state));
  }

  function replay(seed: string, commands: readonly Command[]): LifeState {
    if (!Array.isArray(commands) || commands.length > MAX_COMMANDS) throw new Error("Invalid command history length.");
    // Reconstruct privately in one pass; only the final state escapes to callers.
    const state = structuredClone(start(seed));
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (!command || typeof command !== "object" || Array.isArray(command)) throw new Error(`Invalid command at ${i}.`);
      if (command.type === "advance" && Object.keys(command).length === 1) advanceInto(state);
      else if (command.type === "choose" && typeof command.choice === "string" && Object.keys(command).length === 2) {
        chooseInto(state, command.choice);
      } else throw new Error(`Invalid command at ${i}.`);
    }
    return freeze(state);
  }

  function save(state: LifeState): string {
    assertCompatible(state);
    const reconstructed = replay(state.seed, state.commands);
    if (canonicalJson(reconstructed) !== canonicalJson(state)) throw new Error("State does not match its command history.");
    const saveFile: SaveFile = {
      schemaVersion: 1, worldId: world.id, worldVersion: world.version,
      worldFingerprint: fingerprint, seed: state.seed, commands: state.commands,
    };
    return JSON.stringify(saveFile);
  }

  function load(json: string): LifeState {
    if (typeof json !== "string" || json.length > MAX_SAVE_LENGTH) throw new Error("Invalid save length.");
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { throw new Error("Save is not valid JSON."); }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Save must be an object.");
    const saveFile = parsed as SaveFile;
    assertCompatible(saveFile as LifeState);
    const fields = ["schemaVersion", "worldId", "worldVersion", "worldFingerprint", "seed", "commands"];
    if (Object.keys(saveFile).length !== fields.length || fields.some(field => !Object.hasOwn(saveFile, field))) {
      throw new Error("Save contains missing or unsupported fields.");
    }
    return replay(saveFile.seed, saveFile.commands);
  }

  return Object.freeze({ world, fingerprint, start, advance, choose, getChoices, replay, save, load });
}
