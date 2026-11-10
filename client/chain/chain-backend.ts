import { useEffect, useMemo, useState } from "react";
import { RANKED_WORLD_VERSION } from "../../chain/ids.ts";
import { parseRankedConfig, type RankedAvailability, type RankedConfig } from "./born-into-model.ts";
import { resolveChainConfig, type ChainConfig } from "./config.ts";
import { createLivesContract } from "./contract.ts";
import { createPreviewLedger, PREVIEW_ACCOUNT } from "./preview-ledger.ts";
import type { ContractCall, LivesContract, WalletSession } from "./types.ts";
import { createWalletSession } from "./wallet.ts";

/**
 * Which ledger the ranked screens talk to. "live" = the deployed contract through a wallet loaded on demand;
 * "preview" = the in-memory practice ledger, used while `/api/ranked/config` is unavailable.
 */
export interface ChainBackend {
  mode: "live" | "preview";
  contract: LivesContract;
  accountId: string | null;
  worldVersion: string;
  /** Opens the wallet. Browser only: call from an event handler. */
  connect(): Promise<void>;
}

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
function lazyWallet(cfg: ChainConfig): WalletSession {
  let request: Promise<WalletSession> | null = null;
  let loaded: WalletSession | null = null;
  const load = () => (request ??= createWalletSession(cfg).then(session => (loaded = session)));
  return {
    get accountId() { return loaded?.accountId ?? null; },
    async signIn() { await (await load()).signIn(); },
    async signOut() { if (loaded) await loaded.signOut(); },
    async call(call: ContractCall) { return (await load()).call(call); },
  };
}

let previewLedger: Promise<LivesContract> | null = null;

async function createBackend(onAccount: (accountId: string | null) => void): Promise<Omit<ChainBackend, "accountId">> {
  const config = await loadRankedConfig();
  if (!config) {
    previewLedger ??= createPreviewLedger();
    const contract = await previewLedger;
    onAccount(PREVIEW_ACCOUNT);
    return { mode: "preview", contract, worldVersion: RANKED_WORLD_VERSION, connect: async () => onAccount(PREVIEW_ACCOUNT) };
  }
  const cfg = resolveChainConfig({ contractId: config.contract_id, rpcUrl: config.rpc_url });
  const wallet = lazyWallet(cfg);
  return {
    mode: "live", contract: createLivesContract(wallet, cfg), worldVersion: config.world_version,
    connect: async () => { await wallet.signIn(); onAccount(wallet.accountId); },
  };
}

/** Null until the config answer is known. */
export function useChainBackend(): ChainBackend | null {
  const [base, setBase] = useState<Omit<ChainBackend, "accountId"> | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void createBackend(account => { if (!cancelled) setAccountId(account); }).then(backend => { if (!cancelled) setBase(backend); });
    return () => { cancelled = true; };
  }, []);
  return useMemo(() => (base ? { ...base, accountId } : null), [base, accountId]);
}

export function errorText(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
