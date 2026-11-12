import type { NpcDecision, NpcSessionCommand, PlayerCommand } from "./types.ts";
export class NpcInputError extends Error {}
const forbidden = ["__proto__", "prototype", "constructor"];
export function object(
  value: unknown,
  allowed: string[],
  required = allowed,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new NpcInputError("Expected a JSON object.");
  for (const key of Reflect.ownKeys(value)) {
    const d = Object.getOwnPropertyDescriptor(value, key)!;
    if (
      typeof key !== "string" ||
      forbidden.includes(key) ||
      !allowed.includes(key) ||
      !("value" in d) ||
      !d.enumerable
    )
      throw new NpcInputError("Unknown or executable field.");
  }
  if (required.some((key) => !Object.hasOwn(value, key)))
    throw new NpcInputError("Required field missing.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 500): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new NpcInputError("Invalid text.");
  return value.trim();
}
export function integer(value: unknown, min = 0, max = 1000000): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < min ||
    Number(value) > max
  )
    throw new NpcInputError("Invalid integer.");
  return Number(value);
}
export function playerCommand(value: unknown): PlayerCommand {
  const v = value as Record<string, unknown>;
  if (v?.type === "advance") {
    object(v, ["type"]);
    return { type: "advance" };
  }
  if (v?.type === "choose") {
    object(v, ["type", "choice"]);
    return { type: "choose", choice: text(v.choice, 128) };
  }
  if (v?.type === "act") {
    object(v, ["type", "activity"]);
    return { type: "act", activity: text(v.activity, 128) };
  }
  throw new NpcInputError(
    "Only ordinary player decisions, activities and years are supported.",
  );
}
export const ACTIONS = [
  "rest",
  "work",
  "study",
  "train",
  "prepare-fields",
  "buy-food",
  "offer-lesson",
  "offer-grain",
  "offer-gift",
] as const;
export function decision(value: unknown): NpcDecision {
  const v = object(value, ["action", "speech", "source"]);
  if (
    !ACTIONS.includes(v.action as never) ||
    !["rules", "llm", "external", "fallback"].includes(String(v.source))
  )
    throw new NpcInputError("Unsupported NPC action.");
  return {
    action: v.action as NpcDecision["action"],
    speech:
      typeof v.speech === "string" && v.speech.length === 0
        ? ""
        : text(v.speech, 500),
    source: v.source as NpcDecision["source"],
  };
}
export function sessionCommand(value: unknown): NpcSessionCommand {
  const v = value as Record<string, unknown>;
  switch (v?.type) {
    case "player":
      object(v, ["type", "command"]);
      return { type: "player", command: playerCommand(v.command) };
    case "resolve": {
      object(v, ["type", "decisions"]);
      if (!v.decisions || typeof v.decisions !== "object")
        throw new NpcInputError("Expected NPC decisions.");
      const entries = object(v.decisions, Object.keys(v.decisions));
      if (Object.keys(entries).length > 5)
        throw new NpcInputError("At most five decisions.");
      return {
        type: "resolve",
        decisions: Object.fromEntries(
          Object.entries(entries).map(([id, d]) => [
            text(id, 100),
            decision(d),
          ]),
        ),
      };
    }
    case "answer":
      object(v, ["type", "offerId", "accept"]);
      if (typeof v.accept !== "boolean")
        throw new NpcInputError("Choose accept or decline.");
      return {
        type: "answer",
        offerId: text(v.offerId, 160),
        accept: v.accept,
      };
    case "speak":
      object(v, ["type", "npcId", "text", "reply"]);
      return {
        type: "speak",
        npcId: text(v.npcId, 100),
        text: text(v.text, 500),
        reply: text(v.reply, 500),
      };
    default:
      throw new NpcInputError("Unknown session command.");
  }
}
