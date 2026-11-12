export type NpcProviderFailure =
  | "configuration"
  | "authentication"
  | "rate-limit"
  | "timeout"
  | "network"
  | "invalid-response"
  | "unavailable";

/** Public failure codes contain no endpoint, credentials or provider response body. */
export class NpcProviderError extends Error {
  readonly reason: NpcProviderFailure;
  constructor(reason: NpcProviderFailure, message: string) {
    super(message);
    this.reason = reason;
  }
}

export interface NpcProviderStatus {
  status: "waiting" | "live" | "fallback";
  reason:
    | NpcProviderFailure
    | "not-configured"
    | "sign-in-required"
    | "quota"
    | "not-checked"
    | null;
  checkedAt: number | null;
  retryAt: number | null;
}

export function providerFailure(error: unknown): NpcProviderFailure {
  if (error instanceof NpcProviderError) return error.reason;
  if (
    error instanceof DOMException &&
    ["AbortError", "TimeoutError"].includes(error.name)
  )
    return "timeout";
  return "unavailable";
}
