import { decodeBase58 } from "../../chain/base58.ts";
import type { AccountProof } from "../../chain/npc-proof.ts";
import type { ContentDatabase } from "../db/types.ts";

export const CHALLENGE_PREFIX = "everfolk:npc-account:v1";

export class AccountProofError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AccountProofError";
    this.status = status;
  }
}

export interface ChallengeRecord {
  nonce: string;
  contractId: string;
  lifeId: string;
  accountId: string;
  expiresAt: number;
}

export interface AccountProofChallengeStore {
  issue(record: ChallengeRecord): Promise<void>;
  consume(nonce: string, expected: { contractId: string; lifeId: string; accountId: string; nowMs: number }): Promise<boolean>;
}

/** Format a deterministic single-use NEAR account ownership challenge. */
export function buildAccountProofChallenge(record: ChallengeRecord): string {
  return [
    CHALLENGE_PREFIX,
    `nonce:${record.nonce}`,
    `contract:${record.contractId}`,
    `life:${record.lifeId}`,
    `account:${record.accountId}`,
    `expires:${record.expiresAt}`,
  ].join("\n");
}

export function parseAccountProofChallenge(challenge: string): ChallengeRecord | null {
  if (typeof challenge !== "string" || challenge.length > 512) return null;
  const lines = challenge.split("\n");
  if (lines.length !== 6 || lines[0] !== CHALLENGE_PREFIX) return null;
  const fields = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const colon = line.indexOf(":");
    if (colon <= 0) return null;
    fields.set(line.slice(0, colon), line.slice(colon + 1));
  }
  const nonce = fields.get("nonce") ?? "";
  const contractId = fields.get("contract") ?? "";
  const lifeId = fields.get("life") ?? "";
  const accountId = fields.get("account") ?? "";
  const expiresRaw = fields.get("expires") ?? "";
  const expiresAt = Number(expiresRaw);
  if (
    !/^[0-9a-f]{32}$/.test(nonce) ||
    !contractId ||
    !/^\d{1,19}$/.test(lifeId) ||
    !accountId ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= 0
  ) {
    return null;
  }
  return { nonce, contractId, lifeId, accountId, expiresAt };
}

function hexToBytes(hex: string): Uint8Array {
  return Uint8Array.from(hex.match(/../g) ?? [], pair => Number.parseInt(pair, 16));
}

function decodeNearEd25519Key(publicKey: string): Uint8Array {
  if (typeof publicKey !== "string" || !publicKey.startsWith("ed25519:")) {
    throw new AccountProofError(401, "Account ownership proof must use an ed25519 NEAR key.");
  }
  const encoded = publicKey.slice("ed25519:".length);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(encoded)) {
    throw new AccountProofError(401, "Account ownership proof has a malformed NEAR public key.");
  }
  let raw: Uint8Array;
  try {
    raw = decodeBase58(encoded);
  } catch {
    throw new AccountProofError(401, "Account ownership proof has an invalid base58 public key.");
  }
  if (raw.length !== 32) {
    throw new AccountProofError(401, "Account ownership proof public key must be 32 bytes.");
  }
  return raw;
}

/**
 * Matches the client signing protocol in email-session.ts & near-connect-session.ts:
 * Ed25519 signature over the SHA-256 digest of the UTF-8 challenge bytes.
 */
export async function verifyEd25519AccountProof(message: string, proof: AccountProof): Promise<void> {
  if (!proof || typeof proof !== "object") throw new AccountProofError(401, "Account ownership proof is required.");
  if (typeof proof.accountId !== "string" || !proof.accountId || proof.accountId.length > 64) {
    throw new AccountProofError(401, "Account ownership proof must identify the NEAR account.");
  }
  if (typeof proof.signature !== "string" || !/^[0-9a-f]{128}$/i.test(proof.signature)) {
    throw new AccountProofError(401, "Account ownership proof signature must be 128 hex characters.");
  }
  const publicBytes = decodeNearEd25519Key(proof.publicKey);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  const key = await crypto.subtle.importKey("raw", new Uint8Array(publicBytes), { name: "Ed25519" }, false, ["verify"]);
  const signatureBytes = hexToBytes(proof.signature.toLowerCase());
  const ok = await crypto.subtle.verify({ name: "Ed25519" }, key, new Uint8Array(signatureBytes), new Uint8Array(digest));
  if (!ok) throw new AccountProofError(401, "Account ownership signature verification failed.");
}

interface ViewAccessKeyReply {
  result?: { permission?: "FullAccess" | { FunctionCall?: { receiver_id?: string; method_names?: string[] } }; error?: string };
  error?: { message?: string; data?: unknown };
}

/** Confirm on NEAR RPC (`view_access_key`) that `publicKey` is currently active for `accountId` and this contract. */
export async function assertAccessKeyOnNear(options: {
  rpcUrl: string;
  contractId: string;
  accountId: string;
  publicKey: string;
  fetchFn?: typeof fetch;
}): Promise<void> {
  const fetcher = options.fetchFn ?? fetch;
  let response: Response;
  try {
    response = await fetcher(options.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "everfolk",
        method: "query",
        params: {
          request_type: "view_access_key",
          finality: "final",
          account_id: options.accountId,
          public_key: options.publicKey,
        },
      }),
    });
  } catch {
    throw new AccountProofError(503, "Could not verify the NEAR access key against RPC.");
  }
  if (!response.ok) {
    throw new AccountProofError(503, `NEAR RPC refused the access-key lookup (${response.status}).`);
  }
  const reply = (await response.json().catch(() => null)) as ViewAccessKeyReply | null;
  if (!reply || reply.error || !reply.result || reply.result.error || !reply.result.permission) {
    throw new AccountProofError(403, "This signing key is not active on the NEAR account for this life.");
  }
  const { permission } = reply.result;
  if (permission === "FullAccess") return;
  if (typeof permission === "object" && permission.FunctionCall?.receiver_id === options.contractId) return;
  throw new AccountProofError(403, "This access key is not permitted to act for this Everfolk contract.");
}

export function memoryChallengeStore(): AccountProofChallengeStore {
  const challenges = new Map<string, ChallengeRecord & { usedAt: number | null }>();
  return {
    async issue(record) {
      challenges.set(record.nonce, { ...record, usedAt: null });
    },
    async consume(nonce, expected) {
      const entry = challenges.get(nonce);
      if (
        !entry ||
        entry.usedAt !== null ||
        entry.contractId !== expected.contractId ||
        entry.lifeId !== expected.lifeId ||
        entry.accountId !== expected.accountId ||
        entry.expiresAt <= expected.nowMs
      ) {
        return false;
      }
      entry.usedAt = expected.nowMs;
      return true;
    },
  };
}

export function d1ChallengeStore(db: ContentDatabase): AccountProofChallengeStore {
  return {
    async issue(record) {
      await db
        .prepare(
          "INSERT OR REPLACE INTO npc_account_challenges (nonce, contract_id, life_id, account_id, expires_at, used_at) VALUES (?, ?, ?, ?, ?, NULL)",
        )
        .bind(record.nonce, record.contractId, record.lifeId, record.accountId, record.expiresAt)
        .run();
    },
    async consume(nonce, expected) {
      const result = await db
        .prepare(
          "UPDATE npc_account_challenges SET used_at = ? WHERE nonce = ? AND used_at IS NULL AND contract_id = ? AND life_id = ? AND account_id = ? AND expires_at > ?",
        )
        .bind(expected.nowMs, nonce, expected.contractId, expected.lifeId, expected.accountId, expected.nowMs)
        .run();
      return result.meta?.changes === 1;
    },
  };
}
