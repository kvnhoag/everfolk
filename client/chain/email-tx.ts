import { actions, baseDecode, baseEncode, createTransaction, type PublicKey, type Signer } from "near-api-js";
import type { ChainConfig } from "./config.ts";
import { bytesToBase64, hasFinalStatus } from "./outcome.ts";
import type { FetchLike } from "./rpc.ts";
import type { ContractCall } from "./types.ts";

/**
 * Builds, signs and sends one lives-contract call over plain JSON-RPC, through an injected `fetch` so Node tests
 * can stand in for the RPC. near-api-js only serialises and hashes; the signature comes from the `Signer`.
 * Loaded on demand by the email session (never by the worker or SSR).
 */

const WAIT_UNTIL = "EXECUTED_OPTIMISTIC";
const TX_POLL_ATTEMPTS = 20;
const TX_POLL_DELAY_MS = 1500;
const RPC_ID = "everfolk";

export interface Sender { accountId: string; publicKey: PublicKey; signer: Signer }
export interface SendOptions { pollDelayMs?: number; pollAttempts?: number }

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One JSON-RPC request. RPC errors are rethrown with their full JSON, so callers can match names like `UNKNOWN_ACCOUNT`. */
async function rpc(fetchFn: FetchLike, cfg: ChainConfig, method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchFn(cfg.rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: RPC_ID, method, params }) });
  } catch (error) {
    throw new Error(`Could not reach the NEAR RPC: ${error instanceof Error ? error.message : String(error)}`);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (isRecord(payload) && payload.error) throw new Error(JSON.stringify(payload.error));
  if (!response.ok || !isRecord(payload) || !isRecord(payload.result)) throw new Error(`The NEAR RPC answered ${response.status} without a result.`);
  if (typeof payload.result.error === "string") throw new Error(payload.result.error);
  return payload.result;
}

async function nextNonce(fetchFn: FetchLike, cfg: ChainConfig, sender: Sender): Promise<{ nonce: bigint; blockHash: Uint8Array }> {
  const key = await rpc(fetchFn, cfg, "query", {
    request_type: "view_access_key", finality: "final", account_id: sender.accountId, public_key: sender.publicKey.toString(),
  });
  if ((typeof key.nonce !== "number" && typeof key.nonce !== "string") || typeof key.block_hash !== "string") {
    throw new Error("The NEAR RPC returned an unreadable access key.");
  }
  return { nonce: BigInt(key.nonce) + 1n, blockHash: baseDecode(key.block_hash) };
}

/** `send_tx` may hand back a pending outcome (or time out); follow the hash until the outcome is final. */
async function follow(fetchFn: FetchLike, cfg: ChainConfig, hash: string, signerId: string, options: SendOptions): Promise<unknown> {
  const attempts = options.pollAttempts ?? TX_POLL_ATTEMPTS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const outcome = await rpc(fetchFn, cfg, "tx", { tx_hash: hash, sender_account_id: signerId, wait_until: WAIT_UNTIL }).catch(() => null);
    if (hasFinalStatus(outcome)) return outcome;
    await sleep(options.pollDelayMs ?? TX_POLL_DELAY_MS);
  }
  throw new Error(`Transaction ${hash} has not finished yet. Check it on the explorer and retry.`);
}

const isTimeout = (error: unknown) => error instanceof Error && /TIMEOUT_ERROR/.test(error.message);

/** Resolves to the final execution outcome of `call`, signed by `sender`. */
export async function sendCall(fetchFn: FetchLike, cfg: ChainConfig, sender: Sender, call: ContractCall, options: SendOptions = {}): Promise<unknown> {
  const { nonce, blockHash } = await nextNonce(fetchFn, cfg, sender);
  const action = actions.functionCall(call.method, call.args, BigInt(call.gas), BigInt(call.deposit));
  const transaction = createTransaction(sender.accountId, sender.publicKey, cfg.contractId, nonce, [action], blockHash);
  const { txHash, signedTransaction } = await sender.signer.signTransaction(transaction);
  const hash = baseEncode(txHash);
  let outcome: unknown;
  try {
    outcome = await rpc(fetchFn, cfg, "send_tx", { signed_tx_base64: bytesToBase64(signedTransaction.encode()), wait_until: WAIT_UNTIL });
  } catch (error) {
    if (!isTimeout(error)) throw error;
    return follow(fetchFn, cfg, hash, sender.accountId, options);
  }
  return hasFinalStatus(outcome) ? outcome : follow(fetchFn, cfg, hash, sender.accountId, options);
}
