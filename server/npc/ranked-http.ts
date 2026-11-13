import { NpcInputError, object } from "../../src/npc/validation.ts";
import { RankedNpcHttpError, type NpcRankedService } from "./ranked-service.ts";

const MAX_BODY_BYTES = 65_536;

const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

function bearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return (request.headers.get("x-npc-session-token") ?? "").trim();
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new RankedNpcHttpError(413, "Request payload is too large.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new RankedNpcHttpError(413, "Request payload is too large.");
  }
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new RankedNpcHttpError(400, "Send a JSON object.");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof RankedNpcHttpError) throw error;
    throw new RankedNpcHttpError(400, "Request body is not valid JSON.");
  }
}

export async function npcRankedRoute(request: Request, service: NpcRankedService | undefined): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  if (!service) {
    if (path === "/api/npc/ranked/config" && request.method === "GET") {
      return json({
        world_version: "alexandria-npc-1",
        provider_configured: false,
        provider_name: null,
        contract_supported: false,
        available: false,
      });
    }
    return json({ error: "Ranked NPC sessions are not configured on this server." }, 503);
  }
  try {
    if (path === "/api/npc/ranked/config") {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      return json(await service.config());
    }
    if (path === "/api/npc/ranked/challenge") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      const body = await readJsonBody(request);
      object(body, ["contractId", "lifeId"]);
      return json(await service.issueChallenge({ contractId: String(body.contractId), lifeId: String(body.lifeId) }));
    }
    if (path === "/api/npc/ranked/sessions") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      const body = await readJsonBody(request);
      object(body, ["contractId", "lifeId", "challenge", "proof"]);
      return json(
        await service.openSession({
          contractId: String(body.contractId),
          lifeId: String(body.lifeId),
          challenge: String(body.challenge),
          proof: body.proof as never,
        }),
        201,
      );
    }

    const sessionMatch = /^\/api\/npc\/ranked\/sessions\/([A-Za-z0-9._~-]{1,128})(?:\/(step|speak|answer|sync-chain|check-provider))?$/.exec(path);
    if (!sessionMatch) return json({ error: "API route not found." }, 404);
    const [, sessionId, action] = sessionMatch;
    const token = bearerToken(request);

    if (!action) {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      return json(await service.getSession(sessionId, token));
    }
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    if (action === "sync-chain") {
      return json(await service.syncChain(sessionId, token));
    }
    if (action === "check-provider") {
      return json(await service.checkProvider(sessionId, token));
    }
    const body = await readJsonBody(request);
    if (action === "step") {
      object(body, ["revision", "requestId", "command"]);
      return json(await service.step(sessionId, token, Number(body.revision), String(body.requestId), body.command));
    }
    if (action === "speak") {
      object(body, ["revision", "requestId", "npcId", "message"]);
      return json(await service.speak(sessionId, token, Number(body.revision), String(body.requestId), String(body.npcId), String(body.message)));
    }
    if (action === "answer") {
      object(body, ["revision", "requestId", "offerId", "accept"]);
      return json(await service.answer(sessionId, token, Number(body.revision), String(body.requestId), String(body.offerId), Boolean(body.accept)));
    }
    return json({ error: "API route not found." }, 404);
  } catch (error) {
    if (error instanceof RankedNpcHttpError) {
      return json({ error: error.message, ...(error.reason ? { reason: error.reason } : {}) }, error.status);
    }
    if (error instanceof NpcInputError) return json({ error: error.message }, 400);
    return json({ error: "Ranked NPC request failed. Please try again." }, 500);
  }
}
