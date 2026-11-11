import { createEngine } from "./engine.ts";
import type { ActivityAvailability, Choice, Command, LifeState, MarketOrderRequest, SaveFile, WorldPack } from "./types.ts";

/** Ordinary saves allow 8 MB; leave a bounded allowance for the binding envelope. */
export const MAX_SEEDED_SAVE_LENGTH = 8_004_096;

export interface SeededPlayToken {
  readonly network: string;
  readonly contractId: string;
  readonly tokenId: string;
}

/** Authored separately from the normal cohort, including its calendar and choices. */
export interface SeededScenarioDefinition {
  readonly id: string;
  readonly version: string;
  readonly title: string;
  readonly world: WorldPack;
}

/**
 * A server-side entitlement adapter supplies this binding after checking ownership.
 * This JSON structure alone is neither a wallet proof nor an authorization token.
 */
export interface SeededPlayGrant {
  readonly id: string;
  readonly token: SeededPlayToken;
  readonly allowSeededPlay: boolean;
  readonly scenarioId: string;
  readonly scenarioVersion: string;
  readonly worldFingerprint: string;
  readonly seed: string;
}

export interface SeededScenarioMetadata {
  readonly id: string;
  readonly version: string;
  readonly title: string;
}

export interface SeededPlaySave {
  schemaVersion: 1;
  mode: "seeded-play";
  grantId: string;
  token: SeededPlayToken;
  scenarioId: string;
  scenarioVersion: string;
  worldFingerprint: string;
  save: SaveFile;
}

/** The seed has no setter or call argument: only choices can vary between replays. */
export interface SeededPlayEngine {
  readonly world: WorldPack;
  readonly fingerprint: string;
  readonly scenario: SeededScenarioMetadata;
  readonly grant: SeededPlayGrant;
  start(): LifeState;
  advance(state: LifeState): LifeState;
  choose(state: LifeState, choiceId: string): LifeState;
  act(state: LifeState, activityId: string): LifeState;
  orderMarket(state: LifeState, order: MarketOrderRequest): LifeState;
  cancelMarketOrder(state: LifeState, orderId: number): LifeState;
  chooseAvatar(state: LifeState, variant: number): LifeState;
  getChoices(state: LifeState): readonly Choice[];
  getActivities(state: LifeState): readonly ActivityAvailability[];
  replay(commands: readonly Command[]): LifeState;
  save(state: LifeState): string;
  load(json: string): LifeState;
}

const BAD_IDS = new Set(["__proto__", "constructor", "prototype"]);
const TOKEN_FIELDS = ["network", "contractId", "tokenId"] as const;
const SAVE_FIELDS = ["schemaVersion", "mode", "grantId", "token", "scenarioId", "scenarioVersion", "worldFingerprint", "save"] as const;

function object(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`Invalid ${label}.`);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) throw new Error(`Invalid ${label} fields.`);
  for (const key of keys) {
    if (typeof key !== "string" || !fields.includes(key)) throw new Error(`Invalid ${label} fields.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!("value" in descriptor) || !descriptor.enumerable) throw new Error(`Invalid ${label} data.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, maximum: number, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
}

function scenarioId(value: unknown): string {
  const result = text(value, 100, "scenario identifier");
  if (!/^[a-z][a-z0-9-]*$/.test(result) || BAD_IDS.has(result)) throw new Error("Invalid scenario identifier.");
  return result;
}

function token(value: unknown): SeededPlayToken {
  const source = object(value, TOKEN_FIELDS, "seeded-play token binding");
  return Object.freeze({
    network: text(source.network, 100, "token network"),
    contractId: text(source.contractId, 256, "token contract"),
    tokenId: text(source.tokenId, 512, "token identifier"),
  });
}

function sameToken(left: SeededPlayToken, right: SeededPlayToken): boolean {
  return TOKEN_FIELDS.every(field => left[field] === right[field]);
}

/**
 * Deterministic fixed-origin replay. Ownership is deliberately outside the pure
 * engine: the server must reauthorize the current player before every operation.
 */
export function createSeededPlayEngine(definition: SeededScenarioDefinition, permission: SeededPlayGrant): SeededPlayEngine {
  const source = object(definition, ["id", "version", "title", "world"], "seeded scenario");
  const scenario = Object.freeze({
    id: scenarioId(source.id),
    version: text(source.version, 100, "scenario version"),
    title: text(source.title, 300, "scenario title"),
  });
  const input = object(permission, ["id", "token", "allowSeededPlay", "scenarioId", "scenarioVersion", "worldFingerprint", "seed"], "seeded-play grant");
  if (input.allowSeededPlay !== true) throw new Error("This grant does not allow seeded play.");
  if (typeof input.seed !== "string" || input.seed.length === 0 || input.seed.length > 256) {
    throw new Error("Seed must be a string of 1 to 256 characters.");
  }
  const grant: SeededPlayGrant = Object.freeze({
    id: text(input.id, 300, "grant identifier"),
    token: token(input.token),
    allowSeededPlay: true,
    scenarioId: scenarioId(input.scenarioId),
    scenarioVersion: text(input.scenarioVersion, 100, "grant scenario version"),
    worldFingerprint: text(input.worldFingerprint, 100, "grant world fingerprint"),
    seed: input.seed,
  });
  const engine = createEngine(source.world);
  if (engine.world.origins.length !== 1) throw new Error("A seeded scenario must define exactly one fixed household origin.");
  if (grant.scenarioId !== scenario.id || grant.scenarioVersion !== scenario.version || grant.worldFingerprint !== engine.fingerprint) {
    throw new Error("The grant does not match this scenario revision.");
  }
  const originId = engine.world.origins[0].id;

  function assertBound(state: LifeState): void {
    if (!state || typeof state !== "object" || state.schemaVersion !== 1 || state.seed !== grant.seed ||
      state.worldId !== engine.world.id || state.worldVersion !== engine.world.version ||
      state.worldFingerprint !== engine.fingerprint || state.originId !== originId) {
      throw new Error("This life does not match the fixed seeded scenario.");
    }
  }

  function save(state: LifeState): string {
    assertBound(state);
    // The ordinary engine replays accepted commands and rejects edited snapshots.
    const ordinarySave = JSON.parse(engine.save(state)) as SaveFile;
    const envelope: SeededPlaySave = {
      schemaVersion: 1, mode: "seeded-play", grantId: grant.id,
      token: { ...grant.token }, scenarioId: scenario.id, scenarioVersion: scenario.version,
      worldFingerprint: engine.fingerprint, save: ordinarySave,
    };
    const result = JSON.stringify(envelope);
    if (result.length > MAX_SEEDED_SAVE_LENGTH) throw new Error("Seeded save is too large.");
    return result;
  }

  function load(json: string): LifeState {
    if (typeof json !== "string" || json.length === 0 || json.length > MAX_SEEDED_SAVE_LENGTH) throw new Error("Invalid seeded save length.");
    let parsed: unknown;
    try { parsed = JSON.parse(json); } catch { throw new Error("Seeded save is not valid JSON."); }
    const envelope = object(parsed, SAVE_FIELDS, "seeded save");
    const savedToken = token(envelope.token);
    if (envelope.schemaVersion !== 1 || envelope.mode !== "seeded-play" || envelope.grantId !== grant.id ||
      !sameToken(savedToken, grant.token) || envelope.scenarioId !== scenario.id ||
      envelope.scenarioVersion !== scenario.version || envelope.worldFingerprint !== engine.fingerprint) {
      throw new Error("Seeded save does not match this grant and scenario revision.");
    }
    const ordinarySave = object(envelope.save, ["schemaVersion", "worldId", "worldVersion", "worldFingerprint", "seed", "commands"], "seeded command history");
    if (ordinarySave.seed !== grant.seed) throw new Error("Seeded save cannot replace the recorded seed.");
    const state = engine.load(JSON.stringify(ordinarySave));
    assertBound(state);
    return state;
  }

  return Object.freeze({
    world: engine.world, fingerprint: engine.fingerprint, scenario, grant,
    start: () => engine.start(grant.seed),
    advance: (state: LifeState) => { assertBound(state); return engine.advance(state); },
    choose: (state: LifeState, choiceId: string) => { assertBound(state); return engine.choose(state, choiceId); },
    act: (state: LifeState, activityId: string) => { assertBound(state); return engine.act(state, activityId); },
    orderMarket: (state: LifeState, order: MarketOrderRequest) => { assertBound(state); return engine.orderMarket(state, order); },
    cancelMarketOrder: (state: LifeState, orderId: number) => { assertBound(state); return engine.cancelMarketOrder(state, orderId); },
    chooseAvatar: (state: LifeState, variant: number) => { assertBound(state); return engine.chooseAvatar(state, variant); },
    getChoices: (state: LifeState) => { assertBound(state); return engine.getChoices(state); },
    getActivities: (state: LifeState) => { assertBound(state); return engine.getActivities(state); },
    replay: (commands: readonly Command[]) => engine.replay(grant.seed, commands),
    save, load,
  });
}
