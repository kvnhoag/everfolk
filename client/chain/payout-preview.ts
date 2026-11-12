import { parseNearInput } from "./near-amount.ts";
import type { MarketTerms } from "./types.ts";

export interface PayoutPreview { sellerYocto: string; sourcesYocto: string; treasuryYocto: string }

/** The contract defaults: 5% to earlier lives, 5% to the treasury. */
export const DEFAULT_MARKET_TERMS: MarketTerms = { royaltySourcesBps: 500, royaltyTreasuryBps: 500 };

const MAX_BPS = 10_000n;

/** `amount × bps / 10000`, rounded down; mirrors `bps_of` in contract/src/shares.rs. */
function bpsOf(amount: bigint, bps: number): bigint {
  return amount * BigInt(bps) / MAX_BPS;
}

/**
 * How a sale at `priceYocto` splits, mirroring `buy` in contract/src/market.rs. A life with no
 * earlier lives behind it sends their share to the treasury.
 * The contract floors each source's part and sends the rounding remainder to the treasury, so the
 * sources and treasury lines can differ from the chain by a few yoctoNEAR; the seller amount is exact.
 */
export function payoutPreview(priceYocto: string, terms: MarketTerms, hasSources: boolean): PayoutPreview {
  const price = BigInt(priceYocto);
  const sourcesCut = bpsOf(price, terms.royaltySourcesBps);
  const sources = hasSources ? sourcesCut : 0n;
  const treasury = bpsOf(price, terms.royaltyTreasuryBps) + (sourcesCut - sources);
  return {
    sellerYocto: (price - sources - treasury).toString(),
    sourcesYocto: sources.toString(),
    treasuryYocto: treasury.toString(),
  };
}

/** The preview for a price the player typed, or null until it is a valid positive NEAR amount. */
export function previewForInput(text: string, terms: MarketTerms, hasSources: boolean): PayoutPreview | null {
  const parsed = parseNearInput(text);
  return parsed.ok ? payoutPreview(parsed.yocto, terms, hasSources) : null;
}
