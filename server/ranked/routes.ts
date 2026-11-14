import { WEAVE_WORLD_VERSION } from "../../chain/ids.ts";
import type { SaveFile } from "../../src/types.ts";
import type { ContentDatabase } from "../db/types.ts";
import type { NpcEnvironment } from "../npc/composition.ts";
import type { NpcRankedService } from "../npc/ranked-service.ts";
import { readEvidence, storeEvidence } from "./evidence-store.ts";
import { viewLife } from "./near-view.ts";
import { clientKey, defaultVerifyLimiter, type RateLimiter } from "./rate-limit.ts";
import { createEvidenceSigner } from "./signer.ts";
import { VerificationError, VerificationUnavailableError, type LifeVerifier } from "./verifier.ts";

/** D1 rows top out near 2 MB; a full ranked life is far smaller. */
export const MAX_RANKED_SAVE_BYTES = 1_900_000;
const MAX_BODY_BYTES = MAX_RANKED_SAVE_BYTES + 4_096;
const DEFAULT_RPC_URL = "https://test.rpc.fastnear.com";

export interface RankedEnvironment extends NpcEnvironment {
  DB?: ContentDatabase; RANKED_VERIFIER_SECRET?: string; RANKED_CONTRACT_ID?: string; NEAR_RPC_URL?: string;
  NPC_RANKED?: NpcRankedService;
  /** Optional Cloudflare rate-limit binding; without it a per-isolate limiter applies. */
  RANKED_RATE_LIMITER?: RateLimiter;
}

export interface RankedDependencies {
  verifier?: (env: RankedEnvironment, deps?: RankedDependencies) => Promise<LifeVerifier>;
  fetch?: typeof fetch;
  now?: () => Date;
  limiter?: RateLimiter;
}

class RouteError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
const jsonBytes = (text: string) => new Response(text, {
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  try { await body?.cancel(); } catch { /* The response must still reject a cancelled or broken upload. */ }
}

function configured(env: RankedEnvironment): { secret: string; contractId: string; rpcUrl: string } {
  if (!env.RANKED_VERIFIER_SECRET || !env.RANKED_CONTRACT_ID) throw new RouteError(503, "Ranked lives are not set up on this server yet.");
  return { secret: env.RANKED_VERIFIER_SECRET, contractId: env.RANKED_CONTRACT_ID, rpcUrl: env.NEAR_RPC_URL || DEFAULT_RPC_URL };
}

async function readBody(request: Request): Promise<string> {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) {
    await cancelBody(request.body);
    throw new RouteError(413, "This life is too long to verify.");
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  // A contiguous bounded buffer also bounds bookkeeping for streams with many tiny chunks.
  let buffer = new Uint8Array(16_384);
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const nextBytes = bytes + value.byteLength;
      if (nextBytes > MAX_BODY_BYTES) {
        try { await reader.cancel(); } catch { /* Retain the size error if cancellation fails. */ }
        throw new RouteError(413, "This life is too long to verify.");
      }
      if (nextBytes > buffer.byteLength) {
        const grown = new Uint8Array(Math.min(MAX_BODY_BYTES, Math.max(nextBytes, buffer.byteLength * 2)));
        grown.set(buffer.subarray(0, bytes));
        buffer = grown;
      }
      buffer.set(value, bytes);
      bytes = nextBytes;
    }
    // Decode once from complete bytes, preserving UTF-8 characters split across chunks.
    return new TextDecoder().decode(buffer.subarray(0, bytes));
  } finally {
    reader.releaseLock();
  }
}

function parseVerifyRequest(text: string): { lifeId: string; saveJson: string; save: SaveFile } {
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new RouteError(400, "Send the life as JSON."); }
  const { life_id: lifeId, save: saveJson } = (input ?? {}) as { life_id?: unknown; save?: unknown };
  if (typeof lifeId !== "string" || !/^\d{1,19}$/.test(lifeId)) throw new RouteError(400, "Send the ranked life's id.");
  if (typeof saveJson !== "string") throw new RouteError(400, "Send the life's save file.");
  if (new TextEncoder().encode(saveJson).byteLength > MAX_RANKED_SAVE_BYTES) throw new RouteError(413, "This life is too long to verify.");
  let save: unknown;
  try { save = JSON.parse(saveJson); } catch { throw new RouteError(400, "The save file is not valid JSON."); }
  const shape = save as Partial<SaveFile> | null;
  const isLife = shape !== null && typeof shape === "object" && !Array.isArray(shape) && typeof shape.seed === "string" &&
    typeof shape.worldId === "string" && typeof shape.worldVersion === "string" && Array.isArray(shape.commands) &&
    shape.commands.every(command => command !== null && typeof command === "object" && typeof (command as { type?: unknown }).type === "string");
  if (!isLife) throw new RouteError(400, "The save file is not an Everfolk life.");
  return { lifeId, saveJson, save: save as SaveFile };
}

async function verify(request: Request, env: RankedEnvironment, deps: RankedDependencies): Promise<Response> {
  const { contractId, rpcUrl } = configured(env);
  if (!deps.verifier) throw new RouteError(503, "Ranked lives are not set up on this server yet.");
  // Reject limited clients before buffering even a bounded upload or running the replay.
  const limiter = deps.limiter ?? env.RANKED_RATE_LIMITER ?? defaultVerifyLimiter;
  if (!(await limiter.limit({ key: `verify:${clientKey(request)}` })).success) {
    await cancelBody(request.body);
    throw new RouteError(429, "Too many lives verified from here just now. Wait a minute and try again.");
  }
  const { lifeId, saveJson, save } = parseVerifyRequest(await readBody(request));
  const life = await viewLife(rpcUrl, contractId, lifeId, deps.fetch ?? fetch);
  if (!life) throw new RouteError(404, "This ranked life was not found on NEAR.");
  const signed = await (await deps.verifier(env, deps)).verify(life, save);
  // Publishing evidence must never block a mint: the signature alone is what the contract checks.
  let stored = true;
  try {
    if (!env.DB) throw new Error("No evidence database is bound.");
    await storeEvidence(env.DB, signed.evidence_hash, signed.evidence_json, saveJson, (deps.now ?? (() => new Date()))());
  } catch (error) {
    stored = false;
    console.error("ranked evidence storage failed", { hash: signed.evidence_hash, error: error instanceof Error ? error.message : String(error) });
  }
  const evidenceUrl = `${new URL(request.url).origin}/api/ranked/evidence/${signed.evidence_hash}`;
  return json({ ...signed, evidence_url: evidenceUrl, save_url: `${evidenceUrl}/save`, evidence_stored: stored });
}

/** `/api/ranked/*`: public config, life verification and evidence lookup. */
export async function handleRankedApi(request: Request, env: RankedEnvironment, deps: RankedDependencies = {}): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  try {
    if (path === "/api/ranked/config") {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      const contractId = env.RANKED_CONTRACT_ID;
      if (!contractId) throw new RouteError(503, "Ranked lives are not set up on this server yet.");
      const rpcUrl = env.NEAR_RPC_URL || DEFAULT_RPC_URL;
      const secret = env.RANKED_VERIFIER_SECRET;
      const publicKey = secret ? (deps.verifier ? (await deps.verifier(env, deps)).publicKey : (await createEvidenceSigner(secret)).publicKey) : null;
      return json({ contract_id: contractId, rpc_url: rpcUrl, world_version: WEAVE_WORLD_VERSION, verifier_public_key: publicKey });
    }
    if (path === "/api/ranked/verify") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      return await verify(request, env, deps);
    }
    const evidence = /^\/api\/ranked\/evidence\/([^/]+)(\/save)?$/.exec(path);
    if (evidence) {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      if (!/^[0-9a-f]{64}$/.test(evidence[1])) throw new RouteError(400, "Evidence is addressed by its 64-character hash.");
      if (!env.DB) throw new RouteError(503, "Ranked lives are not set up on this server yet.");
      const found = await readEvidence(env.DB, evidence[1]);
      if (!found) return json({ error: "No evidence with this hash." }, 404);
      // NFT metadata hashes these exact signed bytes. The larger replay save has its own URL.
      return jsonBytes(evidence[2] ? found.saveJson : found.evidenceJson);
    }
    return json({ error: "API route not found." }, 404);
  } catch (error) {
    if (error instanceof RouteError) return json({ error: error.message }, error.status);
    if (error instanceof VerificationUnavailableError) return json({ error: error.message }, 503);
    if (error instanceof VerificationError) return json({ error: error.message }, 400);
    // Never expose keys, RPC payloads or stack traces to visitors.
    return json({ error: "Ranked lives are unavailable right now. Please try again later." }, 503);
  }
}
