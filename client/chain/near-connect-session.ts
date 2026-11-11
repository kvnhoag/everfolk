import type { NearConnector, NearWalletBase } from "@hot-labs/near-connect";
import type { Account as NearAccount, KeyPairString } from "near-api-js";
import type { ChainConfig } from "./config.ts";
import { contractErrorMessage, hasFinalStatus, readCallResult, transactionHash } from "./outcome.ts";
import { forgetPlayKey, isPlayKeyRejected, loadPlayKey, playKeyRequest, savePlayKey, usesPlayKey, type KeyStore } from "./play-key.ts";
import type { ContractCall, WalletSession } from "./types.ts";
import { installWalletHost } from "./wallet-host.ts";

/**
 * NEAR wallets through NEAR Connect (`@hot-labs/near-connect`), with a popup-free play key. NEAR Connect and
 * near-api-js load lazily, in the browser only, so the worker/SSR bundles and Node tests never import them.
 *
 * Sign-in generates an ed25519 play key and asks the wallet to add it as a function-call key limited to
 * `ACCESS_KEY_METHODS` (NEAR Connect then only offers wallets that support that). Zero-deposit ranked calls are
 * signed here with that key; everything else, and every call with a deposit, goes through the wallet.
 */

const TX_POLL_ATTEMPTS = 20;
const TX_POLL_DELAY_MS = 1500;
const PLAY_KEY_WAIT_UNTIL = "EXECUTED_OPTIMISTIC";
/** Right after sign-in the wallet's AddKey may not be visible to the RPC yet; wait once before giving up on the key. */
const PLAY_KEY_SETTLE_WINDOW_MS = 60_000;
const PLAY_KEY_SETTLE_DELAY_MS = 2_000;
export const PLAY_KEY_REMOVED = "Your play key was removed; sign in again for popup-free play.";

type NearApi = typeof import("near-api-js");
interface Connected { wallet: NearWalletBase; accountId: string; walletId: string }
/** NEAR Connect and near-api-js, loaded on demand. Injectable so Node tests never import either library. */
export interface WalletLibraries { connector: NearConnector; near: NearApi }
export interface WalletSessionDeps { store?: KeyStore; load?: (cfg: ChainConfig) => Promise<WalletLibraries> }

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function loadLibraries(cfg: ChainConfig): Promise<WalletLibraries> {
  if (typeof window === "undefined") throw new Error("The NEAR wallet is only available in the browser.");
  installWalletHost();
  const [{ NearConnector }, near] = await Promise.all([import("@hot-labs/near-connect"), import("near-api-js")]);
  const connector = new NearConnector({ network: cfg.networkId, providers: { [cfg.networkId]: [cfg.rpcUrl] } });
  return { connector, near };
}

/** Browser wallets may return before execution finishes; poll the RPC until the outcome is final. */
async function finalOutcome(outcome: unknown, cfg: ChainConfig, signerId: string): Promise<unknown> {
  if (hasFinalStatus(outcome)) return outcome;
  const hash = transactionHash(outcome);
  if (!hash) throw new Error("The wallet did not return a transaction to follow.");
  for (let attempt = 0; attempt < TX_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(cfg.rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "everfolk", method: "tx", params: { tx_hash: hash, sender_account_id: signerId, wait_until: PLAY_KEY_WAIT_UNTIL } }),
    }).catch(() => null);
    const payload: unknown = response?.ok ? await response.json().catch(() => null) : null;
    const result = typeof payload === "object" && payload !== null ? (payload as { result?: unknown }).result : undefined;
    if (hasFinalStatus(result)) return result;
    await sleep(TX_POLL_DELAY_MS);
  }
  throw new Error(`Transaction ${hash} has not finished yet. Check it on the explorer and retry.`);
}

function signInErrorText(error: unknown): string {
  const message = messageOf(error);
  return /reject|cancel|closed/i.test(message) ? "Wallet connection was cancelled." : `The wallet could not connect: ${message}`;
}

async function restoreConnection(connector: NearConnector): Promise<Connected | null> {
  try {
    const { wallet, accounts } = await connector.getConnectedWallet();
    const accountId = accounts[0]?.accountId;
    return accountId ? { wallet, accountId, walletId: wallet.manifest.id } : null;
  } catch {
    return null; // Nothing remembered, or the wallet ended the session: stay signed out.
  }
}

/** Connects NEAR Connect for `cfg`. Resolves already signed in when the wallet remembers the account. */
export async function createWalletSession(cfg: ChainConfig, deps: WalletSessionDeps = {}): Promise<WalletSession> {
  const { connector, near } = await (deps.load ?? loadLibraries)(cfg);
  const store = deps.store ?? localStorage;
  const listeners = new Set<(hash: string, method: string) => void>();
  let connected = await restoreConnection(connector);
  /** One near-api-js account per play key, so its nonce tracking spans concurrent calls. */
  let playAccount: { secret: string; account: NearAccount } | null = null;
  let playKeyAddedAt = 0;

  const accountFor = (accountId: string, secret: string): NearAccount => {
    if (playAccount?.secret !== secret) {
      const signer = near.KeyPairSigner.fromSecretKey(secret as KeyPairString);
      playAccount = { secret, account: new near.Account(accountId, new near.JsonRpcProvider({ url: cfg.rpcUrl }), signer) };
    }
    return playAccount.account;
  };

  const sendWithPlayKey = async (accountId: string, secret: string, call: ContractCall): Promise<unknown> => {
    try {
      const action = near.actions.functionCall(call.method, call.args, BigInt(call.gas), BigInt(call.deposit));
      const outcome = await accountFor(accountId, secret).signAndSendTransaction({
        receiverId: cfg.contractId, actions: [action], waitUntil: PLAY_KEY_WAIT_UNTIL, throwOnFailure: false,
      });
      return await finalOutcome(outcome, cfg, accountId);
    } catch (error) {
      // Never let the secret reach an error message, a log or the UI.
      throw new Error(messageOf(error).split(secret).join("[redacted]"));
    }
  };

  const sendWithWallet = async (current: Connected, call: ContractCall): Promise<unknown> => {
    const outcome = await current.wallet.signAndSendTransaction({
      network: cfg.networkId,
      signerId: current.accountId,
      receiverId: cfg.contractId,
      actions: [{ type: "FunctionCall", params: { methodName: call.method, args: call.args, gas: call.gas, deposit: call.deposit } }],
    });
    return finalOutcome(outcome, cfg, current.accountId);
  };

  /** Right after sign-in a "missing key" may only mean the RPC has not seen the AddKey yet: wait, then try once more. */
  const retryFreshKey = async (accountId: string, secret: string, call: ContractCall): Promise<unknown> => {
    if (Date.now() - playKeyAddedAt >= PLAY_KEY_SETTLE_WINDOW_MS) return null;
    await sleep(PLAY_KEY_SETTLE_DELAY_MS);
    try {
      return await sendWithPlayKey(accountId, secret, call);
    } catch (retry) {
      if (isPlayKeyRejected(retry)) return null;
      throw retry;
    }
  };

  /** A play key the chain no longer accepts is forgotten, and this one call goes through the wallet instead. */
  const send = async (current: Connected, call: ContractCall): Promise<unknown> => {
    const secret = usesPlayKey(call) ? loadPlayKey(store, current.accountId) : null;
    if (!secret) return sendWithWallet(current, call);
    try {
      return await sendWithPlayKey(current.accountId, secret, call);
    } catch (error) {
      if (!isPlayKeyRejected(error)) throw error;
      const settled = await retryFreshKey(current.accountId, secret, call);
      if (settled !== null) return settled;
      forgetPlayKey(store, current.accountId);
      playAccount = null;
      try {
        return await sendWithWallet(current, call);
      } catch (fallback) {
        throw new Error(`${PLAY_KEY_REMOVED} ${messageOf(fallback)}`);
      }
    }
  };

  return {
    get accountId() { return connected?.accountId ?? null; },
    get walletId() { return connected?.walletId ?? null; },
    onTransaction(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async signIn() {
      if (connected) return;
      const playKey = near.KeyPair.fromRandom("ed25519");
      const request = playKeyRequest(cfg, playKey.getPublicKey().toString());
      const wallet = await connector.connect({ addFunctionCallKey: request }).catch(error => { throw new Error(signInErrorText(error)); });
      const accountId = (await wallet.getAccounts({ network: cfg.networkId }))[0]?.accountId;
      if (!accountId) throw new Error("The wallet did not share an account.");
      try {
        savePlayKey(store, accountId, playKey.toString());
        playKeyAddedAt = Date.now();
      } catch (error) {
        console.warn("Everfolk: the play key could not be stored; ranked moves will ask the wallet.", messageOf(error));
      }
      connected = { wallet, accountId, walletId: wallet.manifest.id };
    },
    async signOut() {
      const current = connected;
      connected = null;
      playAccount = null;
      playKeyAddedAt = 0;
      if (!current) return;
      forgetPlayKey(store, current.accountId);
      await connector.disconnect(current.wallet);
    },
    async call(call: ContractCall) {
      const current = connected;
      if (!current) throw new Error("Connect a NEAR wallet first.");
      try {
        const outcome = await send(current, call);
        const hash = transactionHash(outcome);
        if (hash) for (const listener of listeners) listener(hash, call.method);
        return readCallResult(outcome);
      } catch (error) {
        throw new Error(`${call.method} failed: ${contractErrorMessage(messageOf(error))}`);
      }
    },
  };
}
