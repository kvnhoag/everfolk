import { sha256Hex } from "../../chain/hash.ts";
import type { SourceImpact, SourceShare } from "../../chain/types.ts";

/** Ports of the contract's pure money and randomness rules, used by the in-memory mock. */

export const MAX_BPS = 10_000n;
export const MAX_SOURCES = 64;

/** `share_i = impact_i / Σ impact` in bps; largest remainder to exactly 10000; >64 sources → tail to treasury. Mirrors `shares.rs`. */
export function computeShares(impacts: readonly SourceImpact[]): SourceShare[] {
  const merged = new Map<string, bigint>();
  for (const { token_id, impact } of impacts) merged.set(token_id, (merged.get(token_id) ?? 0n) + BigInt(impact));
  const ranked = [...merged].filter(([, impact]) => impact > 0n)
    .sort(([a, x], [b, y]) => (x === y ? (a < b ? -1 : a > b ? 1 : 0) : x > y ? -1 : 1));
  const total = ranked.reduce((sum, [, impact]) => sum + impact, 0n);
  if (total === 0n) return [];
  const cut = ranked.length > MAX_SOURCES;
  const kept = ranked.slice(0, MAX_SOURCES).map(([token_id, impact]) => ({
    token_id, bps: (impact * MAX_BPS) / total, remainder: (impact * MAX_BPS) % total,
  }));
  if (cut) return kept.map(({ token_id, bps }) => ({ token_id, bps: Number(bps) }));
  const missing = Number(MAX_BPS - kept.reduce((sum, share) => sum + share.bps, 0n));
  const bonus = new Set(
    kept.map((share, index) => ({ ...share, index }))
      .sort((a, b) => (a.remainder === b.remainder ? (a.token_id < b.token_id ? -1 : 1) : a.remainder > b.remainder ? -1 : 1))
      .slice(0, missing)
      .map(share => share.index),
  );
  return kept.map(({ token_id, bps }, index) => ({ token_id, bps: Number(bps) + (bonus.has(index) ? 1 : 0) }));
}

export function bpsOf(amount: bigint, bps: number | bigint): bigint {
  const rate = BigInt(bps);
  return (amount / MAX_BPS) * rate + ((amount % MAX_BPS) * rate) / MAX_BPS;
}

export function splitAmount(amount: bigint, shares: readonly SourceShare[]): { token_id: string; part: bigint }[] {
  return shares.map(share => ({ token_id: share.token_id, part: bpsOf(amount, share.bps) }));
}

/** Deterministic 64-bit roll from a hex seed and a domain label. */
export async function roll(seedHex: string, domain: string): Promise<bigint> {
  return BigInt(`0x${(await sha256Hex(`${seedHex}:${domain}`)).slice(0, 16)}`);
}

/** Index picked with probability weight / Σ weights, or null when every weight is zero. */
export function weightedPick(weights: readonly bigint[], value: bigint): number | null {
  const total = weights.reduce((sum, weight) => sum + weight, 0n);
  if (total === 0n) return null;
  let target = value % total;
  for (const [index, weight] of weights.entries()) {
    if (target < weight) return index;
    target -= weight;
  }
  return null;
}
