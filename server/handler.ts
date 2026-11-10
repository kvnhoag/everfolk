import { MAX_CATALOG_BYTES, validateCatalog } from "./content.ts";
import type { ContentDatabase } from "./store.ts";
import { ContentConflict, publishDraft, readDraft, readPublished, readPublishedWorld, readRevision, saveDraft } from "./store.ts";
import { handleSeededPlayApi } from "./seeded-play.ts";
import type { SeededPlayService } from "./seeded-play.ts";
import { requestIdentity } from "./identity.ts";
import { handleRankedApi, type RankedDependencies, type RankedEnvironment } from "./ranked/routes.ts";
import { defaultRankedDependencies } from "./ranked/default-verifier.ts";

export interface ContentEnvironment extends RankedEnvironment { DB?: ContentDatabase; ADMIN_EMAIL?: string; ADMIN_EMAILS?: string; SEEDED_PLAY?: SeededPlayService; RANKED?: RankedDependencies }

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function identity(request: Request, env: ContentEnvironment): { authenticated: boolean; isAdmin: boolean } {
  return requestIdentity(request.headers, env);
}

function requireAdmin(request: Request, env: ContentEnvironment): void {
  const user = identity(request, env);
  if (!user.authenticated) throw new HttpError(401, "Sign in to manage this game.");
  if (!user.isAdmin) throw new HttpError(403, "Content editing is restricted to game admins.");
}

function requireSameOrigin(request: Request): void {
  if (request.headers.get("Origin") !== new URL(request.url).origin) throw new HttpError(403, "This action must come from the game’s admin panel.");
  if (request.headers.get("Sec-Fetch-Site") === "cross-site") throw new HttpError(403, "Cross-site requests are not allowed.");
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new HttpError(415, "Send changes as JSON.");
}

async function body(request: Request): Promise<unknown> {
  if (Number(request.headers.get("Content-Length")) > MAX_CATALOG_BYTES) throw new HttpError(413, "This catalog is too large.");
  if (!request.body) throw new HttpError(400, "A JSON body is required.");
  const reader = request.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_CATALOG_BYTES) { await reader.cancel(); throw new HttpError(413, "This catalog is too large."); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "The request does not contain valid JSON.");
  } finally { reader.releaseLock(); }
}

/** Only trusted Sites dispatch supplies identity headers in hosted requests. */
export async function handleApi(request: Request, env: ContentEnvironment): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "");
  try {
    if (path === "/api/session" && request.method === "GET") return json(identity(request, env));
    if (path === "/api/seeded-play" || path.startsWith("/api/seeded-play/")) {
      const user = identity(request, env);
      return handleSeededPlayApi(request, env.SEEDED_PLAY, user.authenticated ? { userId: request.headers.get("oai-authenticated-user-id")! } : null);
    }
    if (path === "/api/ranked" || path.startsWith("/api/ranked/")) return handleRankedApi(request, env, env.RANKED ?? defaultRankedDependencies());
    const admin = path === "/api/admin" || path.startsWith("/api/admin/");
    if (admin) {
      requireAdmin(request, env);
      if (request.method !== "GET") requireSameOrigin(request);
    }
    if (!env.DB) throw new HttpError(503, "Content storage is not configured. Please try again later.");
    if (path === "/api/admin/catalog") {
      if (request.method === "GET") return json(await readDraft(env.DB));
      if (request.method === "PUT") {
        const input = await body(request);
        try { validateCatalog(input); } catch (error) { throw new HttpError(422, error instanceof Error ? error.message : "Invalid catalog."); }
        return json(await saveDraft(env.DB, input));
      }
      return json({ error: "Method not allowed." }, 405);
    }
    if (path === "/api/admin/publish") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      const input = await body(request);
      if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 1 ||
        !Object.hasOwn(input, "revision") || !Number.isSafeInteger((input as { revision: unknown }).revision) ||
        ((input as { revision: number }).revision < 0)) throw new HttpError(422, "Choose a valid saved draft revision to publish.");
      return json(await publishDraft(env.DB, (input as { revision: number }).revision));
    }
    if (path === "/api/worlds" && request.method === "GET") return json(await readPublished(env.DB));
    const match = /^\/api\/(worlds|revisions)\/([^/]+)$/.exec(path);
    if (match && request.method === "GET") {
      let id: string;
      try { id = decodeURIComponent(match[2]); } catch { throw new HttpError(400, "Invalid content identifier."); }
      if (id.length > 200) throw new HttpError(400, "Invalid content identifier.");
      const world = match[1] === "worlds" ? await readPublishedWorld(env.DB, id) : await readRevision(env.DB, id);
      return world ? json(world) : json({ error: "This world revision was not found." }, 404);
    }
    return json({ error: "API route not found." }, 404);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof ContentConflict) return json({ error: error.message }, 409);
    // Do not expose SQL, secrets or stack traces to visitors.
    return json({ error: "Content storage is unavailable. Please try again later." }, 503);
  }
}
