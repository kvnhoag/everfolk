import { clientKey, createMemoryLimiter, type RateLimiter } from "../ranked/rate-limit.ts";
import type { ContentDatabase } from "../db/types.ts";
import { createAccountBalance, createTransfer, redact, TransferNotSentError, type AccountBalance, type Transfer } from "./funder.ts";
import { claimFunding, hasFunding, recordTransfer, releaseFunding } from "./funding-store.ts";
import { TokenServiceError, verifyPrivyToken, type VerifyToken } from "./privy-token.ts";

/** 0.1 testnet NEAR: enough gas for a new email player's first NFT actions. */
export const DEFAULT_DRIP_YOCTO = "100000000000000000000000";
export const DEFAULT_DRIP_DAILY_CAP = 5;
/** The funder keeps this much on top of one drip so its own gas and storage are never at risk (0.05 NEAR). */
export const FUNDER_RESERVE_YOCTO = "50000000000000000000000";
const DEFAULT_RPC_URL = "https://test.rpc.fastnear.com";
const MAX_BODY_BYTES = 1_024;
const IMPLICIT_ACCOUNT = /^[0-9a-f]{64}$/;
const POSITIVE_INTEGER = /^[1-9]\d*$/;

export interface SignInEnvironment {
  DB?: ContentDatabase; VITE_EVERFOLK_PRIVY_APP_ID?: string;
  EVERFOLK_FUNDER_ACCOUNT_ID?: string; EVERFOLK_FUNDER_PRIVATE_KEY?: string;
  EVERFOLK_DRIP_YOCTO?: string; EVERFOLK_DRIP_DAILY_CAP?: string; NEAR_RPC_URL?: string;
}

export interface SignInDependencies {
  verifyToken?: VerifyToken;
  transfer?: Transfer;
  accountBalance?: AccountBalance;
  now?: () => Date;
  limiter?: RateLimiter;
}

interface FundingSetup { db: ContentDatabase; appId: string; accountId: string; privateKey: string; rpcUrl: string; drip: string; dailyCap: number }

class RouteError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

/** Each client may try to get funded a handful of times a minute (per isolate). */
const defaultFundLimiter = createMemoryLimiter({ limit: 6, windowMs: 60_000 });

const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

export function dripYocto(env: SignInEnvironment): string {
  const value = env.EVERFOLK_DRIP_YOCTO?.trim();
  return value && POSITIVE_INTEGER.test(value) ? value : DEFAULT_DRIP_YOCTO;
}

export function dailyCap(env: SignInEnvironment): number {
  const value = env.EVERFOLK_DRIP_DAILY_CAP?.trim();
  const parsed = value && POSITIVE_INTEGER.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) ? parsed : DEFAULT_DRIP_DAILY_CAP;
}

function fundingSetup(env: SignInEnvironment): FundingSetup | null {
  const appId = env.VITE_EVERFOLK_PRIVY_APP_ID?.trim();
  const accountId = env.EVERFOLK_FUNDER_ACCOUNT_ID?.trim();
  const privateKey = env.EVERFOLK_FUNDER_PRIVATE_KEY?.trim();
  if (!env.DB || !appId || !accountId || !privateKey) return null;
  return { db: env.DB, appId, accountId, privateKey, rpcUrl: env.NEAR_RPC_URL || DEFAULT_RPC_URL, drip: dripYocto(env), dailyCap: dailyCap(env) };
}

function readConfig(env: SignInEnvironment): Response {
  return json({ privyAppId: env.VITE_EVERFOLK_PRIVY_APP_ID?.trim() || null, funding: fundingSetup(env) !== null, dripYocto: dripYocto(env) });
}

async function readAccountId(request: Request): Promise<string> {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) throw new RouteError(413, "This request is too large.");
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let length = 0;
  try {
    while (reader) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) { await reader.cancel().catch(() => {}); throw new RouteError(413, "This request is too large."); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader?.releaseLock(); }
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new RouteError(400, "Send the account as JSON."); }
  const accountId = (input as { accountId?: unknown } | null)?.accountId;
  if (typeof accountId !== "string" || !IMPLICIT_ACCOUNT.test(accountId)) throw new RouteError(400, "Only a new email account can be set up here.");
  return accountId;
}

async function authenticate(request: Request, appId: string, verify: VerifyToken): Promise<string> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "");
  if (!match) throw new RouteError(401, "Sign in again to finish setting up your account.");
  try {
    return (await verify(match[1], appId)).userId;
  } catch (error) {
    if (!(error instanceof TokenServiceError)) throw new RouteError(401, "Sign in again to finish setting up your account.");
    console.error("signin token keys unavailable", { error: error.message });
    throw new RouteError(503, "Sign-in is unavailable right now. Please try again in a moment.");
  }
}

async function ensureEmpty(accountId: string, balance: AccountBalance): Promise<void> {
  let amount: string | null;
  try { amount = await balance(accountId); } catch (error) {
    console.error("signin funding balance lookup failed", { accountId, error: error instanceof Error ? error.message : String(error) });
    throw new RouteError(503, "Account setup is unavailable right now. Please try again in a moment.");
  }
  if (amount !== null && BigInt(amount) > 0n) throw new RouteError(409, "This account is already set up.");
}

async function ensureFunderCanPay(setup: FundingSetup, balance: AccountBalance): Promise<void> {
  let amount: string | null;
  try { amount = await balance(setup.accountId); } catch (error) {
    console.error("signin funder balance lookup failed", { error: redact(error instanceof Error ? error.message : String(error), setup.privateKey) });
    throw new RouteError(503, "Account setup is unavailable right now. Please try again in a moment.");
  }
  if (amount === null || BigInt(amount) < BigInt(setup.drip) + BigInt(FUNDER_RESERVE_YOCTO)) {
    console.error("signin funding paused: funder balance is low", { balance: amount });
    throw new RouteError(503, "Funding is paused.");
  }
}

async function sendDrip(setup: FundingSetup, userId: string, accountId: string, transfer: Transfer): Promise<Response> {
  let hash: string;
  try {
    hash = (await transfer(accountId, setup.drip, signedHash => recordTransfer(setup.db, userId, signedHash))).hash;
  } catch (error) {
    const notSent = error instanceof TransferNotSentError;
    const message = redact(error instanceof Error ? error.message : String(error), setup.privateKey);
    console.error("signin funding transfer failed", { userId, accountId, amount: setup.drip, notSent, error: message });
    if (!notSent) {
      // The drip may be on chain: keep the reservation so a retry can never send a second one.
      return json({ funded: false, reason: "pending", error: "Your account is still being set up." }, 502);
    }
    await releaseFunding(setup.db, userId);
    throw new RouteError(502, "Your account could not be set up just now. Please try again in a moment.");
  }
  try { await recordTransfer(setup.db, userId, hash); } catch (error) {
    // The reservation row still blocks a second drip; only the hash is missing.
    console.error("signin funding hash not recorded", { userId, accountId, hash, error: error instanceof Error ? error.message : String(error) });
  }
  return json({ funded: true, hash });
}

async function fund(request: Request, env: SignInEnvironment, deps: SignInDependencies): Promise<Response> {
  const setup = fundingSetup(env);
  if (!setup) throw new RouteError(503, "Account setup is not available on this server yet.");
  if (!(await (deps.limiter ?? defaultFundLimiter).limit({ key: `fund:${clientKey(request)}` })).success) {
    await request.body?.cancel().catch(() => {});
    throw new RouteError(429, "Too many attempts from here just now. Wait a minute and try again.");
  }
  const userId = await authenticate(request, setup.appId, deps.verifyToken ?? verifyPrivyToken);
  const accountId = await readAccountId(request);
  if (await hasFunding(setup.db, userId)) return json({ funded: false, reason: "already-funded" });
  const balance = deps.accountBalance ?? createAccountBalance(setup.rpcUrl);
  await ensureEmpty(accountId, balance);
  await ensureFunderCanPay(setup, balance);
  const now = (deps.now ?? (() => new Date()))();
  const claim = await claimFunding(setup.db, { privyUserId: userId, accountId, amount: setup.drip, now, dailyCap: setup.dailyCap });
  if (claim === "already-funded") return json({ funded: false, reason: "already-funded" });
  if (claim === "account-taken") throw new RouteError(409, "This account is already set up.");
  if (claim === "daily-cap") throw new RouteError(429, "Today's new accounts are all set up. Please try again tomorrow.");
  const transfer = deps.transfer ?? createTransfer({ accountId: setup.accountId, privateKey: setup.privateKey, rpcUrl: setup.rpcUrl });
  return sendDrip(setup, userId, accountId, transfer);
}

/** `/api/signin/*`: public sign-in config and the one-time testnet drip for new email accounts. */
export async function handleSignInApi(request: Request, env: SignInEnvironment, deps: SignInDependencies = {}): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/\/$/, "");
  try {
    if (path === "/api/signin/config") {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      return readConfig(env);
    }
    if (path === "/api/signin/fund") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
      return await fund(request, env, deps);
    }
    return json({ error: "API route not found." }, 404);
  } catch (error) {
    if (error instanceof RouteError) return json({ error: error.message }, error.status);
    // Never expose keys, RPC payloads, SQL or stack traces to visitors.
    console.error("signin route failed", { path, error: redact(error instanceof Error ? error.message : String(error), env.EVERFOLK_FUNDER_PRIVATE_KEY) });
    return json({ error: "Account setup is unavailable right now. Please try again later." }, 503);
  }
}
