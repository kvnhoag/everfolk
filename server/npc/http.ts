import type { NpcSessionService } from "./service.ts";
import { NpcError } from "./service.ts";
import {
  NpcInputError,
  object,
  integer,
  text,
} from "../../src/npc/validation.ts";
export const npcJson = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function npcBody(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new NpcError(415, "Send JSON.");
  if (!request.body) throw new NpcError(400, "A JSON body is required.");
  const reader = request.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > 16000) {
        await reader.cancel();
        throw new NpcError(413, "NPC request is too large.");
      }
      parts.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      );
    } catch {
      throw new NpcError(400, "Send valid UTF-8 JSON.");
    }
  } finally {
    reader.releaseLock();
  }
}
export function npcToken(request: Request) {
  const value = request.headers.get("authorization");
  if (!value?.startsWith("Bearer "))
    throw new NpcError(401, "A session-scoped bearer token is required.");
  return text(value.slice(7), 200);
}
export function checkNpcOrigin(request: Request, required = false) {
  const origin = request.headers.get("origin");
  if ((origin || required) && origin !== new URL(request.url).origin)
    throw new NpcError(403, "Use this game origin.");
}
export async function npcRoute(
  request: Request,
  service: NpcSessionService | undefined,
  subject: string | null,
): Promise<Response> {
  try {
    if (!service)
      throw new NpcError(503, "NPC session storage is not configured.");
    checkNpcOrigin(request);
    const path = new URL(request.url).pathname;
    if (path === "/api/npc/sessions" && request.method === "POST") {
      checkNpcOrigin(request, true);
      const v = object(await npcBody(request), ["seed"]);
      return npcJson(
        await service.start(
          text(v.seed, 256),
          subject,
          request.headers.get("CF-Connecting-IP") ?? "anonymous",
        ),
        201,
      );
    }
    const match =
      /^\/api\/npc\/sessions\/([a-zA-Z0-9-]{1,100})(?:\/(step|turn|answer|speak|lease|export|observe|act|check-provider))?$/.exec(
        path,
      );
    if (!match) throw new NpcError(404, "NPC route not found.");
    const [, id, operation] = match,
      token = npcToken(request);
    if (request.method === "GET") {
      if (!operation) return npcJson(await service.get(id, token));
      if (operation === "observe")
        return npcJson(await service.observe(id, token));
      if (operation === "export")
        return npcJson(await service.export(id, token));
    }
    if (request.method !== "POST")
      return npcJson({ error: "Method not allowed." }, 405);
    const v = await npcBody(request);
    switch (operation) {
      case "step": {
        const p = object(v, ["revision", "key", "command"]);
        return npcJson(
          await service.step(
            id,
            token,
            integer(p.revision),
            text(p.key, 128),
            p.command,
          ),
        );
      }
      case "check-provider": {
        const p = object(v, ["revision", "key"]);
        return npcJson(
          await service.checkProvider(
            id,
            token,
            integer(p.revision),
            text(p.key, 128),
          ),
        );
      }
      case "turn": {
        const p = object(v, ["revision", "key"]);
        return npcJson(
          await service.turn(id, token, integer(p.revision), text(p.key, 128)),
        );
      }
      case "answer": {
        const p = object(v, ["revision", "key", "offerId", "accept"]);
        if (typeof p.accept !== "boolean")
          throw new NpcInputError("Choose accept or decline.");
        return npcJson(
          await service.answer(
            id,
            token,
            integer(p.revision),
            text(p.key, 128),
            text(p.offerId, 160),
            p.accept,
          ),
        );
      }
      case "speak": {
        const p = object(v, ["revision", "key", "npcId", "message"]);
        return npcJson(
          await service.speak(
            id,
            token,
            integer(p.revision),
            text(p.key, 128),
            text(p.npcId, 100),
            text(p.message, 500),
          ),
        );
      }
      case "lease": {
        const p = object(v, ["revision", "key", "npcId", "revoke"]);
        if (typeof p.revoke !== "boolean")
          throw new NpcInputError("Specify revoke.");
        return npcJson(
          await service.lease(
            id,
            token,
            integer(p.revision),
            text(p.key, 128),
            text(p.npcId, 100),
            p.revoke,
          ),
        );
      }
      case "act": {
        const p = object(v, ["revision", "key", "decision"]);
        return npcJson(
          await service.propose(
            id,
            token,
            integer(p.revision),
            text(p.key, 128),
            p.decision,
          ),
        );
      }
      default:
        return npcJson({ error: "Method not allowed." }, 405);
    }
  } catch (error) {
    return npcJson(
      {
        error:
          error instanceof NpcError
            ? error.message
            : error instanceof NpcInputError
              ? error.message
              : "NPC service is unavailable. Retry later.",
      },
      error instanceof NpcError
        ? error.status
        : error instanceof NpcInputError
          ? 422
          : 503,
    );
  }
}
