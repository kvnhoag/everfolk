import { bytesToBase64, contractErrorMessage, parseReturnText } from "./outcome.ts";

/** Read-only contract calls over plain NEAR JSON-RPC (`query` / `call_function`); no wallet or SDK needed. */

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeResultBytes(result: unknown): string {
  if (!Array.isArray(result) || !result.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
    throw new Error("The NEAR RPC returned a view result that is not bytes.");
  }
  return new TextDecoder().decode(Uint8Array.from(result as number[]));
}

/** Calls a view method and returns its decoded JSON value. Contract panics are rethrown with their message. */
export async function viewFunction(
  fetchFn: FetchLike, rpcUrl: string, contractId: string, method: string, args: Record<string, unknown>,
): Promise<unknown> {
  const body = {
    jsonrpc: "2.0",
    id: "everfolk",
    method: "query",
    params: {
      request_type: "call_function",
      finality: "optimistic",
      account_id: contractId,
      method_name: method,
      args_base64: bytesToBase64(new TextEncoder().encode(JSON.stringify(args))),
    },
  };
  let response: Response;
  try {
    response = await fetchFn(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch (error) {
    throw new Error(`Could not reach the NEAR RPC for ${method}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) throw new Error(`The NEAR RPC answered ${response.status} for ${method}.`);
  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload)) throw new Error(`The NEAR RPC returned an unreadable answer for ${method}.`);
  if (payload.error) throw new Error(contractErrorMessage(JSON.stringify(payload.error)));
  const result = payload.result;
  if (!isRecord(result)) throw new Error(`The NEAR RPC returned no result for ${method}.`);
  if (typeof result.error === "string") throw new Error(contractErrorMessage(result.error));
  return parseReturnText(decodeResultBytes(result.result));
}
