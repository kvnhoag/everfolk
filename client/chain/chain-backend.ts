import { useEffect, useMemo, useState } from "react";
import { parseRankedConfig, type RankedConfig } from "./born-into-model.ts";
import { DEFAULT_CHAIN_CONFIG, resolveChainConfig, type ChainConfig } from "./config.ts";
import { PRACTICE_CONTRACT_ID } from "./practice-verifier.ts";
import type { RankedSaveScope } from "./ranked-session.ts";
import { createLivesContract } from "./contract.ts";
import type { AccountProof, ContractCall, LivesContract, WalletSession } from "./types.ts";
import { accountBalance } from "./rpc.ts";
import type { EmailSession } from "./email-session.ts";
import { createSessionRouter, SIGN_IN_STORAGE_KEY, type RoutedSession, type SessionOpeners, type SignInMethod } from "./session-router.ts";
import { loadSignInConfig } from "./sign-in-config.ts";
import { EMAIL_NOT_LOADED } from "./sign-in-errors.ts";
import type { EmailSignInFlow } from "./SignInPanel.tsx";

/**
 * Which ledger the ranked screens talk to. "live" = the deployed contract through a wallet loaded on demand;
 * Preview backends are used by isolated test screens.
 */
export interface ChainBackend {
  mode: "live" | "preview";
  contract: LivesContract;
  accountId: string | null;
  /** Wallet module of the signed-in account, e.g. "meteor-wallet". */
  walletId: string | null;
  worldVersion: string;
  contractId: string | null;
  networkId?: string;
  /** The latest confirmed wallet transaction, for an explorer link. */
  lastTransaction: { hash: string; method: string } | null;
  /** Bumps after every confirmed transaction so balances can be read again. */
  revision: number;
  /** Opens the wallet. Browser only: call from an event handler. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Available for the live ledger; signs a server ownership challenge with the current game key. */
  proveAccount?(message: string): Promise<AccountProof>;
  /** Spendable NEAR of an account in yoctoNEAR; null in practice mode or when unknown. */
  nearBalance(accountId: string): Promise<string | null>;
  /** The sign-in panel's choices; absent in practice mode. */
  signin?: SignInControls;
}

/** Who is signed in and how, for the sign-in panel and the account bar. */
export interface SignInState {
  method: SignInMethod | null;
  /** The email of an email player; null otherwise. */
  email: string | null;
  /** A NEAR wallet player whose popup-free play key is missing. */
  needsPlayKey: boolean;
}

export interface SignInControls extends SignInState {
  available: { email: boolean };
  emailFlow: EmailSignInFlow;
  /** Signs in with a NEAR wallet, or asks the signed-in wallet for a new play key. */
  useWallet(): Promise<void>;
}

type BackendEvents = {
  onAccount(accountId: string | null, walletId: string | null, state?: SignInState): void;
  onTransaction(hash: string, method: string): void;
};
type BaseBackend = Omit<ChainBackend, "accountId" | "walletId" | "lastTransaction" | "revision" | "signin"> & {
  signin?: Omit<SignInControls, keyof SignInState>;
};

const CONFIG_PATH = "/api/ranked/config";
let configRequest: Promise<RankedConfig | null> | null = null;

/** Fetched once per page; any error or malformed answer means "unavailable". */
export function loadRankedConfig(): Promise<RankedConfig | null> {
  configRequest ??= fetch(CONFIG_PATH, { credentials: "same-origin", cache: "no-store" })
    .then(response => (response.ok ? response.json() : null))
    .then(parseRankedConfig)
    .catch(() => null);
  return configRequest;
}

/** The router remembers the chosen sign-in method under this key; its presence means a session can be restored. */
export const REMEMBERED_WALLET_KEY = SIGN_IN_STORAGE_KEY;
export const EMAIL_NOT_READY = "Email sign-in is not set up yet.";

type EmailOpenerModule = typeof import("./email-opener.ts");
const loadEmailOpener = (): Promise<EmailOpenerModule> => import("./email-opener.ts");

/** The email session, opened (Privy mounted) once on first use; a failed open can be retried. */
export function emailOpener(cfg: ChainConfig, privyAppId: string | null, load: () => Promise<EmailOpenerModule> = loadEmailOpener) {
  let opening: Promise<EmailSession> | null = null;
  let session: EmailSession | null = null;
  const open = (): Promise<EmailSession> => {
    if (!privyAppId) return Promise.reject(new Error(EMAIL_NOT_READY));
    if (!opening) {
      const request = load()
        .catch(error => {
          // A stale or blocked chunk: say so plainly instead of the browser's module error.
          console.warn("Everfolk: email sign-in did not load.", error);
          throw new Error(EMAIL_NOT_LOADED);
        })
        .then(({ openEmailSession }) => openEmailSession(cfg, privyAppId));
      opening = request;
      request.then(opened => { session = opened; }, () => { if (opening === request) opening = null; });
    }
    return opening;
  };
  return { open, current: () => session };
}

/** Sign-in methods for `cfg`. Each loads its libraries on first use (sign-in, restore or a change call). */
export function sessionOpeners(cfg: ChainConfig, email: () => Promise<WalletSession> = () => Promise.reject(new Error(EMAIL_NOT_READY))): SessionOpeners {
  return {
    wallet: () => import("./wallet.ts").then(({ createWalletSession }) => createWalletSession(cfg)),
    email,
  };
}

/** One session for every sign-in method; nothing heavy loads until the player signs in or is restored. */
function lazyWallet(cfg: ChainConfig, email: () => Promise<WalletSession>): RoutedSession {
  return createSessionRouter(sessionOpeners(cfg, email));
}

function rememberedWallet(): boolean {
  try { return typeof localStorage !== "undefined" && Boolean(localStorage.getItem(REMEMBERED_WALLET_KEY)); } catch { return false; }
}

const SIGNED_OUT: SignInState = { method: null, email: null, needsPlayKey: false };

async function createBackend(events: BackendEvents): Promise<BaseBackend | null> {
  // Both configs are fetched together; the sign-in one never fails (no Privy App ID = no email sign-in).
  const [config, signInConfig] = await Promise.all([loadRankedConfig(), loadSignInConfig()]);
  if (!config) return null;
  const cfg = resolveChainConfig({ contractId: config.contract_id, rpcUrl: config.rpc_url });
  const { privyAppId } = signInConfig;
  const email = emailOpener(cfg, privyAppId);
  const wallet = lazyWallet(cfg, email.open);
  const report = () => events.onAccount(wallet.accountId, wallet.walletId ?? null, {
    method: wallet.method,
    email: wallet.method === "email" ? email.current()?.email ?? null : null,
    needsPlayKey: wallet.method === "wallet" && Boolean(wallet.needsPlayKey),
  });
  wallet.onTransaction?.((hash, method) => { events.onTransaction(hash, method); report(); });
  const emailFlow: EmailSignInFlow = {
    sendCode: async address => { await (await email.open()).sendCode(address); },
    // The router signs any other method out first, then installs the verified email session.
    verify: async code => { await (await email.open()).verify(code); await wallet.use("email"); report(); },
  };
  // A returning player stays signed in: load the remembered wallet in the background, without opening it.
  if (rememberedWallet()) void wallet.restore().then(report, () => { /* stay disconnected; Connect still works */ });
  return {
    mode: "live", contract: createLivesContract(wallet, cfg), worldVersion: config.world_version, contractId: config.contract_id, networkId: cfg.networkId,
    connect: async () => { await wallet.signIn(); report(); },
    // The router drops the session before the wallet answers, so the bar shows signed out even if that fails.
    disconnect: async () => { try { await wallet.signOut(); } finally { report(); } },
    proveAccount: message => wallet.proveAccount(message),
    nearBalance: accountId => accountBalance(fetch, cfg.rpcUrl, accountId),
    signin: {
      available: { email: privyAppId !== null },
      emailFlow,
      useWallet: async () => { try { await wallet.use("wallet"); } finally { report(); } },
    },
  };
}

/** Null until the config answer is known. */
export function useChainBackend(): ChainBackend | null {
  const [base, setBase] = useState<BaseBackend | null>(null);
  const [account, setAccount] = useState<{ accountId: string | null; walletId: string | null; state: SignInState }>({ accountId: null, walletId: null, state: SIGNED_OUT });
  const [lastTransaction, setLastTransaction] = useState<ChainBackend["lastTransaction"]>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void createBackend({
      onAccount: (accountId, walletId, state = SIGNED_OUT) => { if (!cancelled) setAccount({ accountId, walletId, state }); },
      onTransaction: (hash, method) => { if (!cancelled) { setLastTransaction({ hash, method }); setRevision(value => value + 1); } },
    }).then(backend => { if (!cancelled) setBase(backend); });
    return () => { cancelled = true; };
  }, []);
  return useMemo(() => {
    if (!base) return null;
    const { signin, ...rest } = base;
    const { state, ...who } = account;
    return { ...rest, ...who, lastTransaction, revision, ...(signin ? { signin: { ...signin, ...state } } : {}) };
  }, [base, account, lastTransaction, revision]);
}

export function backendSaveScope(backend: Pick<ChainBackend, "mode" | "contractId" | "networkId">): RankedSaveScope {
  const practice = backend.mode === "preview";
  return {
    networkId: backend.networkId ?? DEFAULT_CHAIN_CONFIG.networkId,
    contractId: backend.contractId ?? PRACTICE_CONTRACT_ID,
    practice,
  };
}

export function errorText(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
