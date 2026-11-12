/** Lead — strict wire shapes for demo commands, used by live play and replay alike. */
import type { AgentDecision, DemoCommand, TownRole } from "./types.ts";
import { AGENT_ROLES, OFFERS, TOWN_ROLES, TRADE_ITEMS } from "./types.ts";

export const DEMO_COMMAND_TYPES = new Set(["trade", "plan", "assign-agents", "delegate", "agent"]);
const MAX_ID = 128;
const MAX_SIGNATURE = 512;
const MAX_AMOUNT = 1_000_000_000;

function bad(where: string, reason: string): never {
  throw new Error(`Invalid demo command${where}: ${reason}.`);
}

function plain(value: unknown, fields: readonly string[], where: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) bad(where, "expected an object");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) bad(where, "expected a plain object");
  const keys = Object.keys(value);
  if (keys.length !== fields.length || !fields.every(field => Object.hasOwn(value, field))) bad(where, `expected exactly ${fields.join(", ")}`);
  return value as Record<string, unknown>;
}

function amount(value: unknown, where: string, min = 0): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > MAX_AMOUNT) bad(where, `expected a whole number from ${min}`);
  return value;
}

function account(value: unknown, where: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ID || !/^[a-z0-9._-]+$/.test(value)) bad(where, "expected an account id");
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], where: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) bad(where, `expected one of ${allowed.join(", ")}`);
  return value as T;
}

function decision(value: unknown, where: string, parseInner: (value: unknown) => unknown): AgentDecision {
  const kind = (value as { kind?: unknown } | null)?.kind;
  switch (kind) {
    case "prices": {
      const d = plain(value, ["kind", "grainBuy", "grainSell"], where);
      return { kind, grainBuy: amount(d.grainBuy, where, 1), grainSell: amount(d.grainSell, where, 1) };
    }
    case "release": return { kind, shareBps: amount(plain(value, ["kind", "shareBps"], where).shareBps, where) };
    case "wage": return { kind, premiumBps: amount(plain(value, ["kind", "premiumBps"], where).premiumBps, where) };
    case "offer": {
      const d = plain(value, ["kind", "offer", "item", "quantity", "price"], where);
      return { kind, offer: oneOf(d.offer, OFFERS, where), item: oneOf(d.item, TRADE_ITEMS, where), quantity: amount(d.quantity, where, 1), price: amount(d.price, where) };
    }
    case "command": {
      const d = plain(value, ["kind", "command"], where);
      return { kind, command: parseInner(d.command) as never };
    }
    default: bad(where, "unknown decision kind");
  }
}

/**
 * Detached, canonical copy of a demo command. `parseInner` validates the command an auto-play
 * agent issues for the player (any engine command except another agent command).
 */
export function parseDemoCommand(value: unknown, where = "", parseInner: (value: unknown) => unknown = v => v): DemoCommand {
  const type = (value as { type?: unknown } | null)?.type;
  switch (type) {
    case "trade": {
      const hasOverride = typeof value === "object" && value !== null && Object.hasOwn(value, "reserveOverride");
      const c = plain(value, ["type", "item", "side", "quantity", "counterparty", ...(hasOverride ? ["reserveOverride"] : [])], where);
      if (hasOverride && typeof c.reserveOverride !== "boolean") bad(where, "reserveOverride must be a boolean");
      return { type, ...(hasOverride ? { reserveOverride: c.reserveOverride as boolean } : {}), item: oneOf(c.item, TRADE_ITEMS, where), side: oneOf(c.side, ["buy", "sell"] as const, where),
        quantity: amount(c.quantity, where, 1), counterparty: oneOf(c.counterparty, ["merchant", "army"] as const, where) };
    }
    case "plan": return { type, flaxPlots: amount(plain(value, ["type", "flaxPlots"], where).flaxPlots, where) };
    case "assign-agents": {
      const c = plain(value, ["type", "agents"], where);
      const agents = c.agents;
      if (agents === null || typeof agents !== "object" || Array.isArray(agents)) bad(where, "agents must be an object");
      const result: Partial<Record<TownRole, string>> = {};
      for (const [role, id] of Object.entries(agents)) result[oneOf(role, TOWN_ROLES, where)] = account(id, where);
      return { type, agents: result };
    }
    case "delegate": {
      const c = plain(value, ["type", "agent"], where);
      return { type, agent: c.agent === null ? null : account(c.agent, where) };
    }
    case "agent": {
      const c = plain(value, ["type", "agent", "role", "decision", "signature"], where);
      if (typeof c.signature !== "string" || c.signature.length === 0 || c.signature.length > MAX_SIGNATURE) bad(where, "signature must be a nonempty string");
      const role = oneOf(c.role, AGENT_ROLES, where);
      const parsed = decision(c.decision, where, inner => {
        if ((inner as { type?: unknown } | null)?.type === "agent") bad(where, "an agent cannot issue another agent command");
        return parseInner(inner);
      });
      if ((role === "player") !== (parsed.kind === "command")) bad(where, "only the player role issues commands");
      return { type, agent: account(c.agent, where), role, decision: parsed, signature: c.signature };
    }
    default: bad(where, "unknown command type");
  }
}
