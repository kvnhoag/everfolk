/**
 * The one-time setup of a new email account: ask `/api/signin/fund` for the testnet drip, then wait until the
 * account holds NEAR. Every refusal becomes plain text for the sign-in panel; nothing here names a wallet or gas.
 */

export interface FundingDeps {
  fetch: typeof fetch;
  /** Spendable yoctoNEAR of an account; null when it does not exist yet. */
  balance(accountId: string): Promise<string | null>;
  pollDelayMs?: number;
  pollAttempts?: number;
}

const FUND_PATH = "/api/signin/fund";
const POLL_DELAY_MS = 1500;
const POLL_ATTEMPTS = 20;

export const FUNDING_PAUSED = "New accounts are paused right now — try again later.";
const SIGN_IN_AGAIN = "Sign in again to finish setting up your account.";
const NOT_ALLOWED = "This account can't be set up here.";
const TRY_AGAIN = "Your account could not be set up just now. Please try again in a moment.";
const OFFLINE = "Could not reach Everfolk. Check your connection and try again.";

/** What each funding answer means for the player; `true` = the drip is sent, on its way, or not needed. */
const STATUS_TEXT: Record<number, string> = { 400: NOT_ALLOWED, 401: SIGN_IN_AGAIN, 429: FUNDING_PAUSED, 503: FUNDING_PAUSED };

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const holdsNear = (amount: string | null) => amount !== null && /^\d+$/.test(amount) && BigInt(amount) > 0n;

function fundedOrPending(status: number, body: unknown): boolean {
  const reply = (typeof body === "object" && body !== null ? body : {}) as { funded?: unknown; reason?: unknown };
  if (status === 200) return reply.funded === true || reply.reason === "already-funded";
  // 409: the account already holds NEAR. 502 "pending": the drip may already be on chain.
  return status === 409 || (status === 502 && reply.reason === "pending");
}

/** Resolves once the drip is sent or not needed; throws player-facing text otherwise. */
export async function requestFunding(deps: FundingDeps, accountId: string, accessToken: string): Promise<void> {
  if (holdsNear(await deps.balance(accountId).catch(() => null))) return;
  let response: Response;
  try {
    response = await deps.fetch(FUND_PATH, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ accountId }),
    });
  } catch {
    throw new Error(OFFLINE);
  }
  const body: unknown = await response.json().catch(() => null);
  if (fundedOrPending(response.status, body)) return;
  console.warn("Everfolk: account setup was refused.", response.status);
  throw new Error(STATUS_TEXT[response.status] ?? TRY_AGAIN);
}

/** True once the account holds NEAR; false after the last try (the first NFT action then explains the wait). */
export async function waitForFunds(deps: FundingDeps, accountId: string): Promise<boolean> {
  const attempts = deps.pollAttempts ?? POLL_ATTEMPTS;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (holdsNear(await deps.balance(accountId).catch(() => null))) return true;
    if (attempt < attempts - 1) await sleep(deps.pollDelayMs ?? POLL_DELAY_MS);
  }
  return false;
}
