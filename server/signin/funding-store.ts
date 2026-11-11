import type { ContentDatabase } from "../store.ts";

export type ClaimResult = "claimed" | "already-funded" | "account-taken" | "daily-cap";

export interface FundingClaim { privyUserId: string; accountId: string; amount: string; now: Date; dailyCap: number }

/** 00:00 UTC of the claim's day, as an ISO string comparable with `created_at`. */
export function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function hasFunding(db: ContentDatabase, privyUserId: string): Promise<boolean> {
  return (await db.prepare("SELECT 1 AS found FROM signin_funding WHERE privy_user_id = ?").bind(privyUserId).first()) !== null;
}

/**
 * Reserves this user's one funding before any NEAR moves. A single statement checks the daily cap and inserts,
 * so concurrent requests can neither fund one user twice nor push the day past its cap.
 */
export async function claimFunding(db: ContentDatabase, claim: FundingClaim): Promise<ClaimResult> {
  const result = await db.prepare(
    "INSERT OR IGNORE INTO signin_funding (privy_user_id, account_id, amount, tx_hash, created_at) " +
    "SELECT ?, ?, ?, NULL, ? WHERE (SELECT COUNT(*) FROM signin_funding WHERE created_at >= ?) < ?",
  ).bind(claim.privyUserId, claim.accountId, claim.amount, claim.now.toISOString(), startOfUtcDay(claim.now), claim.dailyCap).run();
  if ((result.meta?.changes ?? 0) > 0) return "claimed";
  if (await hasFunding(db, claim.privyUserId)) return "already-funded";
  const taken = await db.prepare("SELECT 1 AS found FROM signin_funding WHERE account_id = ?").bind(claim.accountId).first();
  return taken ? "account-taken" : "daily-cap";
}

export async function recordTransfer(db: ContentDatabase, privyUserId: string, txHash: string): Promise<void> {
  await db.prepare("UPDATE signin_funding SET tx_hash = ? WHERE privy_user_id = ?").bind(txHash, privyUserId).run();
}

/**
 * Frees a reservation, so the player can retry. Call it only from the request that claimed the row, and only
 * once the transfer is proven not sent: the signed hash is recorded before broadcast, so it is no evidence of payment.
 */
export async function releaseFunding(db: ContentDatabase, privyUserId: string): Promise<void> {
  await db.prepare("DELETE FROM signin_funding WHERE privy_user_id = ?").bind(privyUserId).run();
}
