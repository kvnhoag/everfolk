import type { Draw, LifeView, Listing, MintResult, TokenExtra, TokenStats, TokenView } from "./types.ts";
import type { MintPack, MintTerms, PoolEntry } from "../../chain/types.ts";

/** Shape checks for contract answers. The chain is external data: check what the UI relies on, fail loudly otherwise. */

type Json = Record<string, unknown>;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(what: string): never {
  throw new Error(`The contract returned an unexpected ${what}.`);
}

function record(value: unknown, what: string, fields: Record<string, string>): Json {
  if (!isRecord(value)) fail(what);
  for (const [field, type] of Object.entries(fields)) {
    const actual = value[field] === null ? "null" : Array.isArray(value[field]) ? "array" : typeof value[field];
    if (!type.split("|").includes(actual)) fail(`${what} (${field})`);
  }
  return value;
}

const YOCTO = /^\d+$/;

function yocto(value: unknown, what: string): string {
  if (typeof value !== "string" || !YOCTO.test(value)) fail(what);
  return value;
}

export function parseDraw(value: unknown): Draw {
  return record(value, "draw", {
    step: "number", category: "string", token_id: "string|null", action_id: "string|null", rarity: "number|null", commands_hash: "string",
  }) as unknown as Draw;
}

export function parseLife(value: unknown): LifeView {
  const life = record(value, "life", {
    life_id: "string", account_id: "string", seed: "string", world_version: "string", status: "string",
    figure_picks: "array", draws: "array", checkpoints: "array", started_at_ms: "number",
  });
  if (!["alive", "minted", "abandoned", "minting"].includes(life.status as string)) fail("life status");
  (life.draws as unknown[]).forEach(parseDraw);
  return life as unknown as LifeView;
}

export function parseOptionalLife(value: unknown): LifeView | null {
  return value === null ? null : parseLife(value);
}

export function parseMintResult(value: unknown): MintResult {
  const result = record(value, "mint result", { token_id: "string", kind: "string", figure_id: "string|null", rarity: "number", affection: "number" });
  if (result.kind !== "figure" && result.kind !== "npc") fail("token kind");
  return result as unknown as MintResult;
}

export function parseTokenView(value: unknown): TokenView | null {
  if (value === null) return null;
  const token = record(value, "token", { owner_id: "string", metadata: "object" });
  const extraText = (token.metadata as Json).extra;
  if (typeof extraText !== "string") fail("token metadata extra");
  let extra: unknown;
  try {
    extra = JSON.parse(extraText);
  } catch {
    fail("token metadata extra");
  }
  record(extra, "token extra", { kind: "string", rarity: "number", affection: "number", action_id: "string", life_id: "string", sources: "array", evidence_hash: "string" });
  return { owner_id: token.owner_id as string, extra: extra as TokenExtra };
}

export function parseTokenStats(value: unknown): TokenStats {
  const stats = record(value, "token stats", { lives_influenced: "number", earned: "string" });
  return { lives_influenced: stats.lives_influenced as number, earned: yocto(stats.earned, "token earnings") };
}

export function parseListing(value: unknown): Listing {
  const listing = record(value, "listing", { token_id: "string", seller_id: "string", price: "string" });
  return { token_id: listing.token_id as string, seller_id: listing.seller_id as string, price: yocto(listing.price, "listing price") };
}

export function parseStringList(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || !value.every(item => typeof item === "string")) fail(what);
  return value;
}

export function parseYocto(value: unknown, what: string): string {
  return yocto(value, what);
}

export function parseMintFee(value: unknown): string {
  return yocto(record(value, "params", { mint_fee: "string" }).mint_fee, "mint fee");
}

export function parseMintTerms(value: unknown): MintTerms {
  const terms = record(value, "mint terms", { mint_fee: "string", reroll_fee: "string", source_share_bps: "number", pack_version: "number" });
  yocto(terms.mint_fee, "mint fee"); yocto(terms.reroll_fee, "reroll fee");
  if (terms.pack_version !== 1 || !Number.isInteger(terms.source_share_bps) || Number(terms.source_share_bps) < 0 || Number(terms.source_share_bps) > 10000) fail("mint terms");
  return terms as unknown as MintTerms;
}
export function parseMintPack(value: unknown): MintPack {
  const pack = record(value, "mint pack", { life_id: "string", evidence_hash: "string", cards: "array", total_fee: "string", reroll_fee: "string", source_share_bps: "number" });
  yocto(pack.total_fee, "total mint fee"); yocto(pack.reroll_fee, "reroll fee");
  if ((pack.cards as unknown[]).length !== 3) fail("mint slots");
  for (const entry of pack.cards as unknown[]) {
    const card = record(entry, "mint card", { kind: "string", figure_id: "string|null", rarity: "number", affection: "number", action_id: "string", rerolled: "boolean" });
    if (!["npc", "figure"].includes(String(card.kind)) || !Number.isInteger(card.rarity) || Number(card.rarity) < 0 || Number(card.rarity) > 4 || !Number.isInteger(card.affection) || Number(card.affection) < 1 || Number(card.affection) > 100) fail("mint card");
  }
  return pack as unknown as MintPack;
}
export function parsePoolEntries(value: unknown): PoolEntry[] {
  if (!Array.isArray(value)) fail("figure copies");
  return value.map(entry => record(entry, "figure copy", { token_id: "string", action_id: "string", rarity: "number", affection: "number" }) as unknown as PoolEntry);
}
export function parseFigureSupply(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(n => Number.isInteger(n) && n >= 0)) fail("figure supply");
  return value as [number, number];
}
