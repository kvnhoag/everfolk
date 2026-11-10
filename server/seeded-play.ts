import { createEngine } from "../src/engine.ts";
import { createSeededPlayEngine } from "../src/seeded-play.ts";
import type { SeededPlayGrant, SeededScenarioDefinition } from "../src/seeded-play.ts";
import type { LifeState } from "../src/types.ts";

/** Resolved by trusted hosting authentication, never by a request body. */
export interface SeededPlaySubject { userId: string }

/** Future NFT integration owns wallet binding, ownership and permission checks.
 * It must return CURRENT owned grants on every call, including after transfers.
 * There is intentionally no local-gallery, request-header or development bypass.
 */
export interface SeededPlayEntitlementProvider {
  listOwnedGrants(subject: Readonly<SeededPlaySubject>): Promise<readonly SeededPlayGrant[]>;
}

export interface SeededPlayOrigin {
  grantId: string;
  token: SeededPlayGrant["token"];
  scenarioId: string;
  scenarioVersion: string;
  title: string;
  originId: string;
  worldFingerprint: string;
}

export interface SeededPlaySnapshot {
  mode: "seeded-play";
  /** A deterministic replay is not evidence of a newly earned mint claim. */
  freshAchievementClaimEligible: false;
  origin: SeededPlayOrigin;
  world: ReturnType<typeof createSeededPlayEngine>["world"];
  life: LifeState;
  save: string;
  choices: ReturnType<ReturnType<typeof createSeededPlayEngine>["getChoices"]>;
  activities: ReturnType<ReturnType<typeof createSeededPlayEngine>["getActivities"]>;
}

export interface SeededPlayService {
  listOrigins(subject: SeededPlaySubject): Promise<SeededPlayOrigin[]>;
  start(subject: SeededPlaySubject, grantId: string): Promise<SeededPlaySnapshot>;
  load(subject: SeededPlaySubject, grantId: string, save: string): Promise<SeededPlaySnapshot>;
  step(subject: SeededPlaySubject, grantId: string, save: string, command: unknown): Promise<SeededPlaySnapshot>;
}

export class SeededPlayAccessError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const text = (value: unknown, max = 300): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const scenarioKey = (id: string, version: string) => JSON.stringify([id, version]);

/** No network connection, registry or entitlement provider is enabled by default. */
export function createSeededPlayService(options: {
  scenarios: readonly SeededScenarioDefinition[];
  entitlements: SeededPlayEntitlementProvider;
}): SeededPlayService {
  const scenarios = new Map<string, SeededScenarioDefinition>();
  for (const definition of options.scenarios) {
    const scenario = structuredClone(definition);
    if (!text(scenario.id, 100) || !text(scenario.version, 100) || !text(scenario.title, 300)) throw new Error("Invalid seeded scenario metadata.");
    const key = scenarioKey(scenario.id, scenario.version);
    if (scenarios.has(key)) throw new Error("Duplicate seeded scenario revision.");
    const engine = createEngine(scenario.world);
    if (engine.world.origins.length !== 1) throw new Error("A seeded scenario must author exactly one household origin.");
    scenarios.set(key, { ...scenario, world: engine.world });
  }
  if (!options.entitlements || typeof options.entitlements.listOwnedGrants !== "function") throw new Error("A server entitlement provider is required.");
  const provider = options.entitlements;

  async function owned(subject: SeededPlaySubject): Promise<readonly SeededPlayGrant[]> {
    if (!subject || !text(subject.userId)) throw new SeededPlayAccessError(401, "Sign in to access seeded play.");
    let result: readonly SeededPlayGrant[];
    try { result = await provider.listOwnedGrants(Object.freeze({ userId: subject.userId })); }
    catch { throw new SeededPlayAccessError(503, "Seeded play access could not be checked."); }
    if (!Array.isArray(result) || result.length > 1000) throw new SeededPlayAccessError(503, "Seeded play access could not be checked.");
    const ids = new Set<string>(), tokens = new Set<string>();
    const grants: SeededPlayGrant[] = [];
    for (const item of result) {
      if (item?.allowSeededPlay !== true) continue;
      const grant = structuredClone(item);
      if (!text(grant.id) || !grant.token || !text(grant.token.network, 100) || !text(grant.token.contractId, 256) || !text(grant.token.tokenId, 512)) {
        throw new SeededPlayAccessError(503, "Seeded play access could not be checked.");
      }
      const token = JSON.stringify([grant.token.network, grant.token.contractId, grant.token.tokenId]);
      if (ids.has(grant.id) || tokens.has(token)) throw new SeededPlayAccessError(503, "Seeded play access could not be checked.");
      ids.add(grant.id); tokens.add(token); grants.push(grant);
    }
    return grants;
  }

  function engineFor(grant: SeededPlayGrant) {
    const definition = scenarios.get(scenarioKey(grant.scenarioId, grant.scenarioVersion));
    if (!definition) throw new SeededPlayAccessError(409, "This seeded origin revision is unavailable.");
    try { return createSeededPlayEngine(definition, grant); }
    catch { throw new SeededPlayAccessError(409, "This seeded origin no longer matches its recorded revision."); }
  }

  async function authorizedEngine(subject: SeededPlaySubject, grantId: string) {
    if (!text(grantId)) throw new SeededPlayAccessError(422, "Choose a valid seeded play grant.");
    const grant = (await owned(subject)).find(item => item.id === grantId);
    if (!grant) throw new SeededPlayAccessError(403, "This account does not have seeded play access for that origin.");
    return engineFor(grant);
  }

  function origin(engine: ReturnType<typeof createSeededPlayEngine>): SeededPlayOrigin {
    return {
      grantId: engine.grant.id, token: { ...engine.grant.token },
      scenarioId: engine.scenario.id, scenarioVersion: engine.scenario.version, title: engine.scenario.title,
      originId: engine.world.origins[0].id, worldFingerprint: engine.fingerprint,
    };
  }

  function snapshot(engine: ReturnType<typeof createSeededPlayEngine>, life: LifeState): SeededPlaySnapshot {
    return {
      mode: "seeded-play", freshAchievementClaimEligible: false, origin: origin(engine),
      world: engine.world, life, save: engine.save(life), choices: engine.getChoices(life), activities: engine.getActivities(life),
    };
  }

  function applyCommand(engine: ReturnType<typeof createSeededPlayEngine>, life: LifeState, input: unknown): LifeState {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid seeded play command.");
    const command = input as Record<string, unknown>;
    const fields = Object.keys(command);
    if (command.type === "advance" && fields.length === 1) return engine.advance(life);
    if (command.type === "choose" && fields.length === 2 && typeof command.choice === "string") return engine.choose(life, command.choice);
    if (command.type === "act" && fields.length === 2 && typeof command.activity === "string") return engine.act(life, command.activity);
    if (command.type === "avatar" && fields.length === 2 && typeof command.variant === "number") {
      const next = engine.chooseAvatar(life, command.variant);
      if (next.commands.length !== life.commands.length + 1) throw new Error("An avatar step must change the selected avatar.");
      return next;
    }
    throw new Error("Invalid seeded play command.");
  }

  return Object.freeze({
    async listOrigins(subject: SeededPlaySubject) {
      const result: SeededPlayOrigin[] = [];
      for (const grant of await owned(subject)) {
        try { result.push(origin(engineFor(grant))); }
        catch (error) { if (!(error instanceof SeededPlayAccessError) || error.status !== 409) throw error; }
      }
      return result;
    },
    async start(subject: SeededPlaySubject, grantId: string) {
      const engine = await authorizedEngine(subject, grantId);
      return snapshot(engine, engine.start());
    },
    async load(subject: SeededPlaySubject, grantId: string, save: string) {
      const engine = await authorizedEngine(subject, grantId);
      return snapshot(engine, engine.load(save));
    },
    async step(subject: SeededPlaySubject, grantId: string, save: string, command: unknown) {
      const engine = await authorizedEngine(subject, grantId);
      const life = engine.load(save);
      // Apply one strictly shaped command to a reconstructed snapshot. Saving
      // verifies the result, without a third full replay for every request.
      return snapshot(engine, applyCommand(engine, life, command));
    },
  });
}

const MAX_REQUEST_BYTES = 8_000_000;
function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

async function readInput(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("Origin") !== new URL(request.url).origin || request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new SeededPlayAccessError(403, "This action must come from the game.");
  }
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new SeededPlayAccessError(415, "Send seeded play commands as JSON.");
  }
  if (Number(request.headers.get("Content-Length")) > MAX_REQUEST_BYTES) throw new SeededPlayAccessError(413, "This seeded play request is too large.");
  if (!request.body) throw new SeededPlayAccessError(400, "A JSON body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_REQUEST_BYTES) { await reader.cancel(); throw new SeededPlayAccessError(413, "This seeded play request is too large."); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const input: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Expected an object.");
    return input as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SeededPlayAccessError) throw error;
    throw new SeededPlayAccessError(400, "The request does not contain a valid JSON object.");
  } finally { reader.releaseLock(); }
}

/** Hidden API capability; no UI, wallet library, NFT contract or public seed form. */
export async function handleSeededPlayApi(request: Request, service: SeededPlayService | undefined, subject: SeededPlaySubject | null): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  const actions = new Set(["/api/seeded-play/start", "/api/seeded-play/load", "/api/seeded-play/step"]);
  try {
    if (path === "/api/seeded-play") {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      if (!subject || !service) return json({ available: false, origins: [] });
      const origins = await service.listOrigins(subject);
      return json({ available: origins.length > 0, origins });
    }
    if (!actions.has(path)) return json({ error: "Seeded play route not found." }, 404);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    if (!subject) throw new SeededPlayAccessError(401, "Sign in to access seeded play.");
    if (!service) throw new SeededPlayAccessError(403, "Seeded play is not enabled for this game.");
    const input = await readInput(request);
    const fields = path.endsWith("/start") ? ["grantId"] : path.endsWith("/load") ? ["grantId", "save"] : ["grantId", "save", "command"];
    if (Object.keys(input).length !== fields.length || fields.some(field => !Object.hasOwn(input, field)) || !text(input.grantId) ||
      (Object.hasOwn(input, "save") && (typeof input.save !== "string" || input.save.length > MAX_REQUEST_BYTES))) {
      throw new SeededPlayAccessError(422, "Send only the selected grant and its seeded play command or save.");
    }
    try {
      return json(path.endsWith("/start") ? await service.start(subject, input.grantId)
        : path.endsWith("/load") ? await service.load(subject, input.grantId, input.save as string)
          : await service.step(subject, input.grantId, input.save as string, input.command));
    } catch (error) {
      if (error instanceof SeededPlayAccessError) throw error;
      // Public engine errors are deliberately replaced: providers can also fail here.
      return json({ error: "The seeded play request could not be accepted. Access and the recorded save must still be valid." }, 422);
    }
  } catch (error) {
    if (error instanceof SeededPlayAccessError) return json({ error: error.message }, error.status);
    return json({ error: "Seeded play access is temporarily unavailable." }, 503);
  }
}
