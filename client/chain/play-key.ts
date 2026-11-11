import type { ChainConfig } from "./config.ts";
import { ACCESS_KEY_METHODS } from "./contract.ts";
import type { ContractCall } from "./types.ts";

/**
 * The play key: a function-call access key Everfolk generates itself. The wallet adds it once at sign-in, limited
 * to `ACCESS_KEY_METHODS` on the lives contract, and Everfolk signs zero-deposit ranked calls with it (no popup).
 * Pure apart from the injected storage; no wallet or RPC library.
 */

export type KeyStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Lifetime gas allowance of the play key in yoctoNEAR (0.25 NEAR). */
export const PLAY_KEY_GAS_ALLOWANCE = "250000000000000000000000";
const STORAGE_PREFIX = "everfolk:play-key:";
const SECRET_FORMAT = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,90}$/;

export interface PlayKeyRequest {
  contractId: string;
  publicKey: string;
  allowMethods: { anyMethod: false; methodNames: string[] };
  gasAllowance: { kind: "limited"; amount: typeof PLAY_KEY_GAS_ALLOWANCE };
}

/** What NEAR Connect forwards to the wallet as `addFunctionCallKey`. */
export function playKeyRequest(cfg: ChainConfig, publicKey: string): PlayKeyRequest {
  return {
    contractId: cfg.contractId,
    publicKey,
    allowMethods: { anyMethod: false, methodNames: [...ACCESS_KEY_METHODS] },
    gasAllowance: { kind: "limited", amount: PLAY_KEY_GAS_ALLOWANCE },
  };
}

/** Only zero-deposit calls to the ranked methods, and only when the caller asked for key access. */
export function usesPlayKey(call: ContractCall): boolean {
  return call.access === "function-call-key" && call.deposit === "0" && (ACCESS_KEY_METHODS as readonly string[]).includes(call.method);
}

const storageKey = (accountId: string) => `${STORAGE_PREFIX}${accountId}`;

export function loadPlayKey(store: KeyStore, accountId: string): string | null {
  try {
    const secret = store.getItem(storageKey(accountId));
    return secret && SECRET_FORMAT.test(secret) ? secret : null;
  } catch {
    return null; // Storage blocked (private mode): play through the wallet instead.
  }
}

export function savePlayKey(store: KeyStore, accountId: string, secret: string): void {
  if (!SECRET_FORMAT.test(secret)) throw new Error("The play key is not an ed25519 secret key.");
  store.setItem(storageKey(accountId), secret);
}

export function forgetPlayKey(store: KeyStore, accountId: string): void {
  try { store.removeItem(storageKey(accountId)); } catch { /* nothing stored, nothing to forget */ }
}

/** near-api-js messages for a key that is gone from chain, out of allowance, or not allowed for this call. */
const KEY_REJECTED = [
  /access key \S+ does not exist/i,
  /not enough allowance for access key/i,
  /access key does not allow method/i,
  /access key receiver \S+ does not match/i,
];

/** True when the chain refused the play key itself (not the contract call): forget it and use the wallet. */
export function isPlayKeyRejected(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return KEY_REJECTED.some(pattern => pattern.test(message));
}
