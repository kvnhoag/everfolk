import { useEffect, useMemo, useState } from "react";
import { DEMO_WORLD_VERSION } from "../../chain/ids.ts";
import { parseRankedConfig, type RankedAvailability, type RankedConfig } from "./born-into-model.ts";
import { resolveChainConfig, type ChainConfig } from "./config.ts";
import { createLivesContract } from "./contract.ts";
import { createPreviewLedger, PREVIEW_ACCOUNT } from "./preview-ledger.ts";
import type { ContractCall, LivesContract, WalletSession } from "./types.ts";
import { accountBalance } from "./rpc.ts";
import { createWalletSession, REMEMBERED_WALLET_KEY } from "./wallet.ts";

/**
 * Which ledger the ranked screens talk to. "live" = the deployed contract through a wallet loaded on demand;
 * "preview" = the in-memory practice ledger, used while `/api/ranked/config` is unavailable.
 */
export interface ChainBackend {
  mode: "live" | "preview";
  contract: LivesContract;
  accountId: string | null;
  /** Wallet module of the signed-in account, e.g. "meteor-wallet". */
  walletId: string | null;
  worldVersion: string;
  contractId: string | null;
  /** The latest confirmed wallet transaction, for an explorer link. */
  lastTransaction: { hash: string; method: string } | null;
  /** Bumps after every confirmed transaction so balances can be read again. */
  revision: number;
  /** Opens the wallet. Browser only: call from an event handler. */
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Spendable NEAR of an account in yoctoNEAR; null in practice mode or when unknown. */
  nearBalance(accountId: string): Promise<string | null>;
}

type BackendEvents = {
  onAccount(accountId: string | null, walletId: string | null): void;
  onTransaction(hash: string, method: string): void;
};
type BaseBackend = Omit<ChainBackend, "accountId" | "walletId" | "lastTransaction" | "revision">;

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

export function useRankedAvailability(): RankedAvailability {
  const [availability, setAvailability] = useState<RankedAvailability>("checking");
  useEffect(() => {
    let cancelled = false;
    void loadRankedConfig().then(config => { if (!cancelled) setAvailability(config ? "available" : "unavailable"); });
    return () => { cancelled = true; };
  }, []);
  return availability;
}

/** A wallet session whose heavy wallet modules load on first use (sign-in or a change call). */
function lazyWallet(cfg: ChainConfig): WalletSession & { restore(): Promise<void> } {
  let request: Promise<WalletSession> | null = null;
  let loaded: WalletSession | null = null;
  const load = () => (request ??= createWalletSession(cfg).then(session => (loaded = session)));
  return {
    get accountId() { return loaded?.accountId ?? null; },
    get walletId() { return loaded?.walletId ?? null; },
    onTransaction(listener) {
      let off: (() => void) | undefined;
      void load().then(session => { off = session.onTransaction?.(listener); });
      return () => off?.();
    },
    /** Loads the wallet library, which restores a remembered account without opening any window. */
    async restore() { await load(); },
    async signIn() { await (await load()).signIn(); },
    async signOut() { if (loaded) await loaded.signOut(); },
    async call(call: ContractCall) { return (await load()).call(call); },
  };
}

function rememberedWallet(): boolean {
  try { return typeof localStorage !== "undefined" && Boolean(localStorage.getItem(REMEMBERED_WALLET_KEY)); } catch { return false; }
}

let previewLedger: Promise<LivesContract> | null = null;

async function createBackend(events: BackendEvents): Promise<BaseBackend> {
  const config = await loadRankedConfig();
  if (!config) {
    previewLedger ??= createPreviewLedger();
    const contract = await previewLedger;
    events.onAccount(PREVIEW_ACCOUNT, null);
    return {
      mode: "preview", contract, worldVersion: DEMO_WORLD_VERSION, contractId: null,
      connect: async () => events.onAccount(PREVIEW_ACCOUNT, null), disconnect: async () => {}, nearBalance: async () => null,
    };
  }
  const cfg = resolveChainConfig({ contractId: config.contract_id, rpcUrl: config.rpc_url });
  const wallet = lazyWallet(cfg);
  wallet.onTransaction?.((hash, method) => events.onTransaction(hash, method));
  const report = () => events.onAccount(wallet.accountId, wallet.walletId ?? null);
  // A returning player stays signed in: load the remembered wallet in the background, without opening it.
  if (rememberedWallet()) void wallet.restore().then(report, () => { /* stay disconnected; Connect still works */ });
  return {
    mode: "live", contract: createLivesContract(wallet, cfg), worldVersion: config.world_version, contractId: config.contract_id,
    connect: async () => { await wallet.signIn(); report(); },
    disconnect: async () => { await wallet.signOut(); events.onAccount(null, null); },
    nearBalance: accountId => accountBalance(fetch, cfg.rpcUrl, accountId),
  };
}

/** Null until the config answer is known. */
export function useChainBackend(): ChainBackend | null {
  const [base, setBase] = useState<BaseBackend | null>(null);
  const [account, setAccount] = useState<{ accountId: string | null; walletId: string | null }>({ accountId: null, walletId: null });
  const [lastTransaction, setLastTransaction] = useState<ChainBackend["lastTransaction"]>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void createBackend({
      onAccount: (accountId, walletId) => { if (!cancelled) setAccount({ accountId, walletId }); },
      onTransaction: (hash, method) => { if (!cancelled) { setLastTransaction({ hash, method }); setRevision(value => value + 1); } },
    }).then(backend => { if (!cancelled) setBase(backend); });
    return () => { cancelled = true; };
  }, []);
  return useMemo(() => (base ? { ...base, ...account, lastTransaction, revision } : null), [base, account, lastTransaction, revision]);
}

export function errorText(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
