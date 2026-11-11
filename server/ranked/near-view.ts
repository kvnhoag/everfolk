import type { LifeView } from "../../chain/types.ts";

interface RpcReply { result?: { result?: number[] }; error?: { message?: string; data?: unknown } }

/** Read-only contract call over NEAR JSON-RPC; returns the decoded JSON value. */
export async function viewCall<T>(rpcUrl: string, contractId: string, method: string, args: unknown, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "everfolk", method: "query",
      params: { request_type: "call_function", finality: "final", account_id: contractId, method_name: method, args_base64: btoa(JSON.stringify(args)) },
    }),
  });
  const reply = (await response.json()) as RpcReply;
  if (reply.error || !reply.result?.result) {
    throw new Error(`The verifier could not read the life from NEAR (${reply.error?.message ?? response.status}).`);
  }
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(reply.result.result))) as T;
}

export function viewLife(rpcUrl: string, contractId: string, lifeId: string, fetcher: typeof fetch = fetch): Promise<LifeView | null> {
  return viewCall<LifeView | null>(rpcUrl, contractId, "get_life", { life_id: lifeId }, fetcher);
}
