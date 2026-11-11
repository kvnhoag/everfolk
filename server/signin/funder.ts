import { Account, JsonRpcProvider, KeyPairSigner, type KeyPairString } from "near-api-js";

export type Transfer = (to: string, yocto: string) => Promise<{ hash: string }>;
export type AccountBalance = (accountId: string) => Promise<string | null>;

export interface FunderConfig { accountId: string; privateKey: string; rpcUrl: string }

interface RpcError { name?: string; cause?: { name?: string }; message?: string; data?: unknown }
interface ViewAccountReply { result?: { amount?: unknown; error?: unknown }; error?: RpcError }

/** Removes the secret from any text before it is logged or rethrown. */
export function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join("[redacted]") : text;
}

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

function failureOf(outcome: { status?: unknown }): string | null {
  const status = outcome.status;
  if (status && typeof status === "object" && "Failure" in status) return JSON.stringify((status as { Failure: unknown }).Failure);
  return null;
}

/** Sends NEAR from the funder account. The key stays inside this closure and is redacted from every error. */
export function createTransfer(config: FunderConfig): Transfer {
  return async (to, yocto) => {
    try {
      const signer = KeyPairSigner.fromSecretKey(config.privateKey as KeyPairString);
      const account = new Account(config.accountId, new JsonRpcProvider({ url: config.rpcUrl }), signer);
      const outcome = await account.transfer({ receiverId: to, amount: BigInt(yocto) });
      const failure = failureOf(outcome);
      if (failure) throw new Error(`transfer failed on chain: ${failure}`);
      return { hash: outcome.transaction.hash };
    } catch (error) {
      const message = redact(error instanceof Error ? error.message : String(error), config.privateKey);
      throw new Error(`Funding transfer to ${to} failed: ${message}`);
    }
  };
}
