/** Decoding of NEAR transaction outcomes and contract errors. Pure: no wallet or RPC library. */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToText(base64: string): string {
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

/** Parses a contract return value; an empty value is a method that returns nothing. */
export function parseReturnText(text: string): unknown {
  if (text === "") return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The contract returned a value that is not JSON.");
  }
}

const PANIC_PATTERNS = [/Smart contract panicked: ([^"\\]+)/, /panic_msg: \\?"([^"\\]+)/, /panicked at '([^']+)'/];

/** Pulls the human-readable panic out of a NEAR execution error, or returns the raw text. */
export function contractErrorMessage(raw: string): string {
  for (const pattern of PANIC_PATTERNS) {
    const match = raw.match(pattern);
    if (match) return match[1].trim();
  }
  return raw;
}

function describeFailure(failure: unknown): string {
  const text = typeof failure === "string" ? failure : JSON.stringify(failure);
  return contractErrorMessage(text);
}

/** The outcome is final when its status says success or failure; wallets may hand back pending ones. */
export function hasFinalStatus(outcome: unknown): boolean {
  if (!isRecord(outcome) || !isRecord(outcome.status)) return false;
  return "SuccessValue" in outcome.status || "Failure" in outcome.status;
}

/** Turns a `FinalExecutionOutcome` into the called method's JSON return value, or throws its panic. */
export function readCallResult(outcome: unknown): unknown {
  if (!hasFinalStatus(outcome)) throw new Error("The transaction has no final result yet.");
  const status = (outcome as { status: Record<string, unknown> }).status;
  if ("Failure" in status) throw new Error(describeFailure(status.Failure));
  const value = status.SuccessValue;
  if (typeof value !== "string") throw new Error("The transaction succeeded without a readable return value.");
  return parseReturnText(base64ToText(value));
}

export function transactionHash(outcome: unknown): string | null {
  if (!isRecord(outcome)) return null;
  const tx = outcome.transaction;
  if (isRecord(tx) && typeof tx.hash === "string") return tx.hash;
  const txOutcome = outcome.transaction_outcome;
  return isRecord(txOutcome) && typeof txOutcome.id === "string" ? txOutcome.id : null;
}
