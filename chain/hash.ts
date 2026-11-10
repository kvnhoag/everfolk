import { canonicalJson } from "../src/random.ts";

/** Lowercase hex SHA-256 of a UTF-8 string, via WebCrypto (Node 24 and Workers). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Hash of the command log before `step`; recorded on chain at every draw and checkpoint. */
export function commandsHash(commands: readonly unknown[], step: number): Promise<string> {
  if (!Number.isInteger(step) || step < 0 || step > commands.length) throw new Error("Checkpoint step is outside the command log.");
  return sha256Hex(canonicalJson(commands.slice(0, step)));
}
