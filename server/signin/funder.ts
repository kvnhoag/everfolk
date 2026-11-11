import { Account, actions, baseEncode, JsonRpcProvider, KeyPairSigner, type KeyPairString, type SignedTransaction } from "near-api-js";
import { ActionExecutionError, InvalidTransactionError, TransactionExecutionError } from "near-api-js/rpc-errors";

/**
 * Sends `yocto` to `to`. `onSigned` receives the transaction hash after signing and before broadcast.
 * Throws {@link TransferNotSentError} only when no NEAR can have moved; any other error means "maybe sent".
 */
export type Transfer = (to: string, yocto: string, onSigned?: (hash: string) => Promise<void>) => Promise<{ hash: string }>;
export type AccountBalance = (accountId: string) => Promise<string | null>;

export interface FunderConfig { accountId: string; privateKey: string; rpcUrl: string }

/** Proof that the transfer never reached the chain (or was refunded), so the reservation can be released. */
export class TransferNotSentError extends Error {}

const SEND_WAIT_UNTIL = "EXECUTED_OPTIMISTIC";
/** One broadcast attempt: near-api-js would otherwise resend on 5xx/timeouts, making a later rejection ambiguous. */
const SEND_ATTEMPTS = 1;

interface RpcError { name?: string; cause?: { name?: string }; message?: string; data?: unknown }
interface ViewAccountReply { result?: { amount?: unknown; error?: unknown }; error?: RpcError }

/** Removes a `curve:base58` key, and its bare base58 part, from text before it is logged or rethrown. */
export function redact(text: string, secret: string | undefined): string {
  const key = secret?.trim() ?? "";
  const bare = key.includes(":") ? key.slice(key.indexOf(":") + 1) : "";
  return [key, bare].filter(part => part.length > 0).reduce((result, part) => result.split(part).join("[redacted]"), text);
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function isUnknownAccount(reply: ViewAccountReply): boolean {
  const cause = reply.error?.cause?.name;
  if (cause === "UNKNOWN_ACCOUNT") return true;
  // Older nodes report a missing account as a string error inside `result`.
  const legacy = typeof reply.result?.error === "string" ? reply.result.error : "";
  return /does not exist while viewing/.test(legacy);
}

/** `view_account` over JSON-RPC: the account's liquid yoctoNEAR, or `null` if the account does not exist yet. */
export function createAccountBalance(rpcUrl: string, fetcher: typeof fetch = fetch): AccountBalance {
  return async accountId => {
    const response = await fetcher(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "everfolk", method: "query", params: { request_type: "view_account", finality: "final", account_id: accountId } }),
    });
    const reply = (await response.json().catch(() => ({}))) as ViewAccountReply;
    if (isUnknownAccount(reply)) return null;
    const amount = reply.result?.amount;
    if (reply.error || typeof amount !== "string" || !/^\d+$/.test(amount)) {
      throw new Error(`view_account failed (${reply.error?.cause?.name ?? reply.error?.name ?? response.status}).`);
    }
    return amount;
  };
}

/** The node refused the transaction outright (bad nonce, balance, expiry, signature…): it was never included. */
export function isRejectedBeforeInclusion(error: unknown): boolean {
  if (error instanceof InvalidTransactionError) return true;
  return error instanceof TransactionExecutionError && !(error instanceof ActionExecutionError);
}

async function signTransfer(config: FunderConfig, to: string, yocto: string): Promise<{ hash: string; signed: SignedTransaction }> {
  const signer = KeyPairSigner.fromSecretKey(config.privateKey.trim() as KeyPairString);
  const account = new Account(config.accountId, new JsonRpcProvider({ url: config.rpcUrl }), signer);
  const transaction = await account.createTransaction({ receiverId: to, actions: [actions.transfer(BigInt(yocto))], publicKey: await signer.getPublicKey() });
  const { txHash, signedTransaction } = await signer.signTransaction(transaction);
  return { hash: baseEncode(txHash), signed: signedTransaction };
}

async function broadcast(config: FunderConfig, signed: SignedTransaction, hash: string): Promise<void> {
  const provider = new JsonRpcProvider({ url: config.rpcUrl }, { retries: SEND_ATTEMPTS });
  let outcome: { status?: unknown };
  try { outcome = await provider.sendTransactionUntil(signed, SEND_WAIT_UNTIL); } catch (error) {
    if (isRejectedBeforeInclusion(error)) throw new TransferNotSentError(`rejected by the node: ${messageOf(error)}`);
    throw new Error(`outcome unknown for ${hash}: ${messageOf(error)}`);
  }
  const status = outcome?.status;
  // A failed transfer action refunds its deposit, so nothing was paid out.
  if (status && typeof status === "object" && "Failure" in status) {
    throw new TransferNotSentError(`failed on chain, deposit refunded: ${JSON.stringify((status as { Failure: unknown }).Failure)}`);
  }
}

/** Sends NEAR from the funder account. The key stays inside this closure and is redacted from every error. */
export function createTransfer(config: FunderConfig): Transfer {
  return async (to, yocto, onSigned) => {
    try {
      let prepared: { hash: string; signed: SignedTransaction };
      try {
        prepared = await signTransfer(config, to, yocto);
        await onSigned?.(prepared.hash);
      } catch (error) {
        throw new TransferNotSentError(`not signed or not recorded: ${messageOf(error)}`);
      }
      await broadcast(config, prepared.signed, prepared.hash);
      return { hash: prepared.hash };
    } catch (error) {
      const message = redact(`Funding transfer to ${to} failed: ${messageOf(error)}`, config.privateKey);
      throw error instanceof TransferNotSentError ? new TransferNotSentError(message) : new Error(message);
    }
  };
}
