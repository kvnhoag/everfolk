import type { ChainConfig } from "./config.ts";
import { requestFunding, waitForFunds, type FundingDeps } from "./email-funding.ts";
import { contractErrorMessage, readCallResult, transactionHash } from "./outcome.ts";
import { accountBalance } from "./rpc.ts";
import type { ContractCall, WalletSession } from "./types.ts";

export { accountLabel } from "./account-bar-model.ts";
export { confirmText } from "./spend-confirmation.ts";

/**
 * Email sign-in. A bridge (Privy, in `PrivyBridge.tsx`) sends the code, verifies it and signs raw hashes with the
 * player's embedded key; this session turns that into a `WalletSession`. After the code is verified the server
 * funds the new account once, and every call is then signed silently, except calls that spend NEAR, which wait
 * for the in-game spend sheet (`confirm`). near-api-js loads on the first call; Privy is never imported here.
 */

export interface VerifiedEmail { publicKeyHex: string; accessToken: string; email: string }
export interface EmailBridge {
  login(email: string): Promise<void>;
  verify(code: string): Promise<VerifiedEmail>;
  signHash(hex0x: string): Promise<string>;
  logout(): Promise<void>;
  /** The player Privy still remembers on this device, or null. */
  restore?(): Promise<VerifiedEmail | null>;
}
export interface EmailSessionDeps extends Pick<FundingDeps, "fetch" | "pollDelayMs" | "pollAttempts"> {
  /** Shows the spend sheet; resolves true on Confirm. Asked only for calls that spend NEAR. */
  confirm(call: ContractCall): Promise<boolean>;
}
export interface EmailSession extends WalletSession {
  readonly email: string | null;
  sendCode(email: string): Promise<void>;
  /** Verifies the code, then sets up (funds) the account. The router's `use("email")` finishes the sign-in. */
  verify(code: string): Promise<void>;
  /** Picks up the player Privy remembers, without asking for a code. */
  restore(): Promise<void>;
}

export const NOT_SET_UP = "Your account is still being set up — try again in a moment.";
export const CANCELLED = "Cancelled.";
const SIGNED_OUT_MID_MOVE = "You signed out before this was sent.";
const ENTER_CODE = "Enter the code from your email to sign in.";
const SEND_FAILED = "We couldn't send a code to that address. Check it and try again.";
const CODE_FAILED = "That code didn't work. Check it and try again.";
const SIGN_IN_FAILED = "Sign-in didn't finish. Please try again.";
const UNFUNDED = /does not exist|NotEnoughBalance|UNKNOWN_ACCOUNT|UNKNOWN_ACCESS_KEY|AccountDoesNotExist|LackBalanceForState/;

type Signed = { accountId: string; email: string };
type Loaded = { send: (call: ContractCall) => Promise<unknown> };

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function callErrorText(call: ContractCall, error: unknown): string {
  const message = messageOf(error);
  return UNFUNDED.test(message) ? NOT_SET_UP : `${call.method} failed: ${contractErrorMessage(message)}`;
}

/** Loads near-api-js and the Privy-backed signer for one signed-in account. */
async function loadSender(cfg: ChainConfig, deps: EmailSessionDeps, accountId: string, signHash: (hex: string) => Promise<string>): Promise<Loaded> {
  const [{ PrivyNearSigner, publicKeyFromHex }, { sendCall }] = await Promise.all([import("./privy-signer.ts"), import("./email-tx.ts")]);
  const publicKey = publicKeyFromHex(accountId);
  const sender = { accountId, publicKey, signer: new PrivyNearSigner(publicKey, signHash) };
  return { send: call => sendCall(deps.fetch, cfg, sender, call, { pollDelayMs: deps.pollDelayMs, pollAttempts: deps.pollAttempts }) };
}

export function createEmailSession(cfg: ChainConfig, bridge: EmailBridge, deps: EmailSessionDeps): EmailSession {
  let current: Signed | null = null;
  let loaded: { owner: Signed; sender: Promise<Loaded> } | null = null;
  /** One transaction at a time, so each reads the nonce the previous one used. */
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<(hash: string, method: string) => void>();
  const balance = (accountId: string) => accountBalance(deps.fetch, cfg.rpcUrl, accountId);

  const assertCurrent = (owner: Signed) => { if (current !== owner) throw new Error(SIGNED_OUT_MID_MOVE); };

  const senderFor = (owner: Signed): Promise<Loaded> => {
    if (loaded?.owner !== owner) {
      // Every signature re-checks the owner: a signed-out session can never sign again.
      const signHash = async (hex: string) => { assertCurrent(owner); return bridge.signHash(hex); };
      loaded = { owner, sender: loadSender(cfg, deps, owner.accountId, signHash) };
    }
    return loaded.sender;
  };

  /** `wait`: a fresh sign-in waits for the drip and fails loudly; a restored one never blocks on setup. */
  const install = async (verified: VerifiedEmail, wait: boolean) => {
    const { implicitAccountId } = await import("./privy-signer.ts");
    const accountId = implicitAccountId(verified.publicKeyHex);
    const funding = { ...deps, balance };
    try {
      await requestFunding(funding, accountId, verified.accessToken);
      if (wait) await waitForFunds(funding, accountId);
    } catch (error) {
      if (wait) {
        await bridge.logout().catch(() => {});
        throw error;
      }
      console.warn("Everfolk: account setup will be retried on the next sign-in.", messageOf(error));
    }
    current = { accountId, email: verified.email };
  };

  const send = async (owner: Signed, call: ContractCall) => {
    const run = queue.then(async () => {
      assertCurrent(owner);
      const outcome = await (await senderFor(owner)).send(call);
      const hash = transactionHash(outcome);
      if (hash) for (const listener of listeners) listener(hash, call.method);
      return readCallResult(outcome);
    });
    queue = run.catch(() => {});
    return run;
  };

  return {
    get accountId() { return current?.accountId ?? null; },
    get email() { return current?.email ?? null; },
    walletId: null,
    needsPlayKey: false,
    onTransaction(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async sendCode(email) {
      // A new code starts a new sign-in: a player restored on this device can no longer sign.
      current = null;
      loaded = null;
      try { await bridge.login(email); } catch (error) {
        console.warn("Everfolk: the sign-in code was not sent.", messageOf(error));
        throw new Error(SEND_FAILED);
      }
    },
    async verify(code) {
      let verified: VerifiedEmail;
      try { verified = await bridge.verify(code); } catch (error) {
        console.warn("Everfolk: the sign-in code was not accepted.", messageOf(error));
        throw new Error(/code|otp|invalid|expired/i.test(messageOf(error)) ? CODE_FAILED : SIGN_IN_FAILED);
      }
      current = null;
      await install(verified, true);
    },
    async restore() {
      const remembered = await bridge.restore?.().catch(() => null);
      // A returning player is signed in at once; a drip that failed earlier is retried in the background.
      if (remembered) await install(remembered, false);
    },
    async signIn() {
      if (!current) throw new Error(ENTER_CODE);
    },
    async signOut() {
      const previous = current;
      current = null;
      loaded = null;
      if (previous) await bridge.logout();
    },
    async call(call) {
      const owner = current;
      if (!owner) throw new Error("Sign in first.");
      if (BigInt(call.deposit) > 0n && !(await deps.confirm(call))) throw new Error(CANCELLED);
      assertCurrent(owner);
      try {
        return await send(owner, call);
      } catch (error) {
        if (messageOf(error) === SIGNED_OUT_MID_MOVE) throw error;
        throw new Error(callErrorText(call, error));
      }
    },
  };
}
