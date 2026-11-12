import type { NpcSessionService } from "./service.ts";
import { checkNpcOrigin, npcBody, npcJson, npcToken } from "./http.ts";
import {
  NpcInputError,
  integer,
  object,
  text,
} from "../../src/npc/validation.ts";
import { NpcError } from "./service.ts";
const PROTOCOL = "2025-11-25";
const empty = { type: "object", properties: {}, additionalProperties: false };
export const NPC_MCP_TOOLS = [
  {
    name: "npc_observe",
    description:
      "Read the assigned NPC's current private observation, revision and legal actions. No seeds, future events or other actors' private state.",
    inputSchema: empty,
    annotations: { readOnlyHint: true },
  },
  {
    name: "npc_actions",
    description:
      "List this NPC's currently legal actions and real costs for its annual decision.",
    inputSchema: empty,
    annotations: { readOnlyHint: true },
  },
  {
    name: "npc_act",
    description:
      "Queue one annual NPC action and optional speech. Requires the observed revision and a unique retry key. Actions settle in fixed order when the player resolves the turn. Never advances the player year.",
    inputSchema: {
      type: "object",
      properties: {
        revision: { type: "integer", minimum: 0 },
        key: { type: "string", minLength: 1, maxLength: 128 },
        action: {
          type: "string",
          enum: [
            "rest",
            "work",
            "study",
            "train",
            "prepare-fields",
            "buy-food",
            "offer-lesson",
            "offer-grain",
            "offer-gift",
          ],
        },
        speech: { type: "string", maxLength: 500 },
      },
      required: ["revision", "key", "action", "speech"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
  },
  {
    name: "npc_events",
    description:
      "Read recent committed events visible to your assigned NPC. Player secrets and other NPC memories are excluded.",
    inputSchema: empty,
    annotations: { readOnlyHint: true },
  },
];
/** Stateless JSON responses over Streamable HTTP. Bearer capabilities are issued by the player, not public OAuth discovery. */
export async function npcMcpRoute(
  request: Request,
  service: NpcSessionService | undefined,
): Promise<Response> {
  let id: unknown = null;
  try {
    checkNpcOrigin(request);
    if (!service)
      throw new NpcError(503, "NPC session storage is not configured.");
    const sessionId = new URL(request.url).searchParams.get("session");
    if (!sessionId) throw new NpcError(400, "Set the session query parameter.");
    const token = npcToken(request);
    const observed = await service.observe(sessionId, token); // Authenticate every call, including initialization and notifications.
    if (request.method === "GET" || request.method === "DELETE")
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    if (request.method !== "POST") throw new NpcError(405, "Use POST.");
    const accept = request.headers.get("accept") ?? "";
    if (
      !accept.includes("application/json") ||
      !accept.includes("text/event-stream")
    )
      throw new NpcError(406, "Accept application/json and text/event-stream.");
    const supplied = request.headers.get("mcp-protocol-version");
    if (supplied && supplied !== PROTOCOL)
      throw new NpcError(
        400,
        `Use negotiated MCP-Protocol-Version ${PROTOCOL}.`,
      );
    const message = object(
      await npcBody(request),
      ["jsonrpc", "id", "method", "params"],
      ["jsonrpc", "method"],
    );
    id = message.id ?? null;
    if (
      message.jsonrpc !== "2.0" ||
      typeof message.method !== "string" ||
      (id !== null && typeof id !== "string" && typeof id !== "number")
    )
      throw new NpcError(400, "Invalid JSON-RPC request.");
    if (message.id === undefined) {
      if (
        message.method === "notifications/initialized" ||
        message.method === "notifications/cancelled"
      )
        return new Response(null, { status: 202 });
      throw new NpcError(400, "Unsupported notification.");
    }
    const reply = (result: unknown) => npcJson({ jsonrpc: "2.0", id, result });
    switch (message.method) {
      case "initialize":
        return reply({
          protocolVersion: PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "everfolk-npc", version: "1.0.0" },
          instructions:
            "You control only the NPC bound to this token. Observe before acting; the player controls time. No NFT or administrative tools are exposed.",
        });
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: NPC_MCP_TOOLS });
      case "tools/call": {
        const params = object(message.params, ["name", "arguments"], ["name"]),
          name = text(params.name, 100),
          args = params.arguments ?? {};
        try {
          let result: unknown;
          switch (name) {
            case "npc_observe":
              object(args, []);
              result = observed;
              break;
            case "npc_actions":
              object(args, []);
              result = {
                revision: observed.revision,
                actions: observed.observation.actions,
              };
              break;
            case "npc_events":
              object(args, []);
              result = {
                revision: observed.revision,
                events: observed.observation.events,
              };
              break;
            case "npc_act": {
              const v = object(args, ["revision", "key", "action", "speech"]);
              result = await service.propose(
                sessionId,
                token,
                integer(v.revision),
                text(v.key, 128),
                { action: v.action, speech: v.speech },
              );
              break;
            }
            default:
              throw new NpcInputError("Unknown tool. Use tools/list.");
          }
          return reply({
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
            isError: false,
          });
        } catch (error) {
          return reply({
            content: [
              {
                type: "text",
                text:
                  error instanceof NpcError || error instanceof NpcInputError
                    ? error.message
                    : "NPC service is unavailable. Retry later.",
              },
            ],
            isError: true,
          });
        }
      }
      default:
        return npcJson({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: "Method not found." },
        });
    }
  } catch (error) {
    const status = error instanceof NpcError ? error.status : 400;
    return npcJson(
      {
        jsonrpc: "2.0",
        id,
        error: {
          code: status === 401 || status === 403 ? -32001 : -32600,
          message:
            error instanceof NpcError ? error.message : "Invalid MCP request.",
        },
      },
      status,
    );
  }
}
