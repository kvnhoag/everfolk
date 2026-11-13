import { NPC_WORLD_VERSION } from "../../chain/ids.ts";
import type { LifeView } from "../../chain/types.ts";
import type { NpcProviderStatus } from "../../server/npc/provider-status.ts";
import type { RankedNpcSessionSnapshot } from "../../server/npc/ranked-store.ts";
import type { Command, LifeState, SaveFile } from "../../src/types.ts";
import type { OnlinePlay } from "../types/online-play.ts";
import type { ChainBackend } from "./chain-backend.ts";
import { DEFAULT_CHAIN_CONFIG } from "./config.ts";
import {
  legacyRankedSaveKey,
  rankedSaveKey,
  type RankedSaveScope,
  type RankedSession,
  type SessionStorage,
} from "./ranked-session.ts";

export interface RankedNpcConfig {
  world_version: string;
  provider_configured: boolean;
  provider_name: string | null;
  contract_supported: boolean;
  available: boolean;
}

export interface RankedNpcServerConnection {
  sessionId: string;
  sessionToken: string;
  snapshot: RankedNpcSessionSnapshot;
}

export interface RankedNpcOnlinePlay extends OnlinePlay {
  readonly sessionId: string;
  snapshot(): RankedNpcSessionSnapshot;
  speak(npcId: string, message: string): Promise<LifeState>;
  answer(offerId: string, accept: boolean): Promise<LifeState>;
  checkProvider(): Promise<RankedNpcSessionSnapshot>;
  syncFromChain(): Promise<RankedNpcSessionSnapshot>;
}

export class RankedNpcClientError extends Error {
  readonly status: number;
  readonly reason?: string;

  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.name = "RankedNpcClientError";
    this.status = status;
    this.reason = reason;
  }
}

export interface RankedNpcServerOptions {
  backend: Pick<ChainBackend, "mode" | "proveAccount">;
  contractId: string;
  networkId?: string;
  lifeId: string;
  baseUrl?: string;
  tokenStorage?: SessionStorage;
  fetcher?: typeof fetch;
}

export interface ConnectRankedNpcOptions {
  backend: Pick<ChainBackend, "mode" | "proveAccount">;
  rankedSession: RankedSession;
  contractId: string;
  networkId?: string;
  initialConnection?: RankedNpcServerConnection;
  baseUrl?: string;
  tokenStorage?: SessionStorage;
  fetcher?: typeof fetch;
  onSynced?: (state: LifeState) => void;
  onSnapshot?: (snapshot: RankedNpcSessionSnapshot) => void;
}

const memoryTokenStore = new Map<string, string>();
const memoryTokenStorage: SessionStorage = {
  getItem: key => memoryTokenStore.get(key) ?? null,
  setItem: (key, value) => { memoryTokenStore.set(key, value); },
  removeItem: key => { memoryTokenStore.delete(key); },
};

function defaultTokenStorage(): SessionStorage {
  try {
    if (typeof window !== "undefined" && window.sessionStorage) return window.sessionStorage;
  } catch {
    // Fall back to in-memory storage when Web Storage is restricted.
  }
  return memoryTokenStorage;
}

function defaultSaveStorage(): SessionStorage {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // Fall back to no-op storage when Web Storage is unavailable.
  }
  return memoryTokenStorage;
}

export function npcSessionTokenStorageKey(networkId: string, contractId: string, lifeId: string): string {
  return `everfolk.npc-ranked-auth.${encodeURIComponent(networkId)}:${encodeURIComponent(contractId)}:${encodeURIComponent(lifeId)}`;
}

interface StoredNpcAuth {
  sessionId: string;
  sessionToken: string;
}

function readStoredNpcAuth(storage: SessionStorage, key: string): StoredNpcAuth | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredNpcAuth>;
    if (typeof parsed.sessionId === "string" && parsed.sessionId && typeof parsed.sessionToken === "string" && parsed.sessionToken) {
      return { sessionId: parsed.sessionId, sessionToken: parsed.sessionToken };
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredNpcAuth(storage: SessionStorage, key: string, auth: StoredNpcAuth): void {
  try {
    storage.setItem(key, JSON.stringify(auth));
  } catch {
    // Token still lives in the active closure even if storage quota is full.
  }
}

function removeStoredNpcAuth(storage: SessionStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Ignore restricted storage cleanup errors.
  }
}

export function isNpcRankedVersion(worldVersion: string | undefined | null): boolean {
  return worldVersion === NPC_WORLD_VERSION;
}

export function parseRankedNpcConfig(raw: unknown): RankedNpcConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  if (
    typeof candidate.world_version !== "string" ||
    typeof candidate.provider_configured !== "boolean" ||
    typeof candidate.contract_supported !== "boolean" ||
    typeof candidate.available !== "boolean"
  ) {
    return null;
  }
  const providerName = typeof candidate.provider_name === "string" ? candidate.provider_name : null;
  return {
    world_version: candidate.world_version,
    provider_configured: candidate.provider_configured,
    provider_name: providerName,
    contract_supported: candidate.contract_supported,
    available: candidate.available,
  };
}

export async function loadRankedNpcConfig(
  fetcher: typeof fetch = fetch,
  baseUrl = "/api/npc/ranked",
): Promise<RankedNpcConfig | null> {
  try {
    const response = await fetcher(`${baseUrl.replace(/\/$/, "")}/config`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return null;
    return parseRankedNpcConfig(await response.json());
  } catch {
    return null;
  }
}

async function requestRankedNpcJson<T>(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  fallbackError: string,
): Promise<T> {
  const response = await fetcher(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });
  const payload = (await response.json().catch(() => null)) as { error?: string; reason?: string } | null;
  if (!response.ok) {
    throw new RankedNpcClientError(
      response.status,
      payload && typeof payload.error === "string" && payload.error ? payload.error : fallbackError,
      payload && typeof payload.reason === "string" ? payload.reason : undefined,
    );
  }
  if (!payload) {
    throw new RankedNpcClientError(response.status, fallbackError);
  }
  return payload as T;
}

/**
 * Opens or resumes the authoritative server session for a live alexandria-npc-1 Weave life.
 * Existing bearer tokens are validated first; missing, expired, or superseded tokens re-authenticate
 * automatically with an Ed25519 account challenge signature.
 */
export async function openRankedNpcServerSession(
  options: RankedNpcServerOptions,
): Promise<RankedNpcServerConnection> {
  const fetcher = options.fetcher ?? fetch;
  const base = (options.baseUrl ?? "/api/npc/ranked").replace(/\/$/, "");
  const networkId = options.networkId ?? DEFAULT_CHAIN_CONFIG.networkId;
  const storage = options.tokenStorage ?? defaultTokenStorage();
  const key = npcSessionTokenStorageKey(networkId, options.contractId, options.lifeId);

  const cached = readStoredNpcAuth(storage, key);
  if (cached) {
    try {
      const snapshot = await requestRankedNpcJson<RankedNpcSessionSnapshot>(
        fetcher,
        `${base}/sessions/${encodeURIComponent(cached.sessionId)}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${cached.sessionToken}` },
        },
        "Could not resume this ranked NPC session.",
      );
      if (snapshot.lifeId === options.lifeId && snapshot.contractId === options.contractId) {
        return { sessionId: cached.sessionId, sessionToken: cached.sessionToken, snapshot };
      }
    } catch (error) {
      if (!(error instanceof RankedNpcClientError) || (error.status !== 401 && error.status !== 404)) {
        throw error;
      }
      removeStoredNpcAuth(storage, key);
    }
  }

  if (options.backend.mode !== "live" || typeof options.backend.proveAccount !== "function") {
    throw new Error("Live Weave NPC lives require a connected live NEAR sign-in (offline previews cannot mint).");
  }

  const { challenge } = await requestRankedNpcJson<{ challenge: string; expiresAt: number; accountId: string }>(
    fetcher,
    `${base}/challenge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: options.contractId, lifeId: options.lifeId }),
    },
    "Could not start ownership verification for this ranked NPC life.",
  );

  const proof = await options.backend.proveAccount(challenge);

  const opened = await requestRankedNpcJson<RankedNpcSessionSnapshot & { sessionToken: string }>(
    fetcher,
    `${base}/sessions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractId: options.contractId,
        lifeId: options.lifeId,
        challenge,
        proof,
      }),
    },
    "Could not open the ranked NPC session.",
  );

  const { sessionToken, ...snapshot } = opened;
  writeStoredNpcAuth(storage, key, { sessionId: snapshot.sessionId, sessionToken });
  return { sessionId: snapshot.sessionId, sessionToken, snapshot };
}

/**
 * Populates local ranked save storage from an authenticated server snapshot when resuming on a new browser/device,
 * so `beginRankedSession` can verify on-chain checkpoints and draws against the authoritative transcript.
 */
export function seedLocalRankedNpcSaveIfMissing(options: {
  life: LifeView;
  snapshot: RankedNpcSessionSnapshot;
  scope: RankedSaveScope;
  storage?: SessionStorage;
}): void {
  const storage = options.storage ?? defaultSaveStorage();
  const scopedKey = rankedSaveKey(options.life.life_id, options.scope);
  if (storage.getItem(scopedKey) || storage.getItem(legacyRankedSaveKey(options.life.life_id))) return;
  const saveFile: SaveFile = {
    schemaVersion: 1,
    worldId: options.snapshot.state.worldId,
    worldVersion: options.snapshot.state.worldVersion,
    worldFingerprint: options.snapshot.state.worldFingerprint,
    seed: options.snapshot.seed,
    commands: [...options.snapshot.state.commands],
  };
  try {
    storage.setItem(scopedKey, JSON.stringify(saveFile));
  } catch {
    // Unwritable storage will be surfaced by RankedSession if needed.
  }
}

function nextRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Connects `RankedSession` (on-chain NEAR commitments, draws, checkpoints) with `/api/npc/ranked/sessions`
 * (authoritative server AI turn decisions + replay log) into a single `OnlinePlay` driver for `useGame`.
 */
export async function connectRankedNpcOnline(options: ConnectRankedNpcOptions): Promise<RankedNpcOnlinePlay> {
  const fetcher = options.fetcher ?? fetch;
  const base = (options.baseUrl ?? "/api/npc/ranked").replace(/\/$/, "");
  const networkId = options.networkId ?? DEFAULT_CHAIN_CONFIG.networkId;
  const tokenStorage = options.tokenStorage ?? defaultTokenStorage();
  const authKey = npcSessionTokenStorageKey(networkId, options.contractId, options.rankedSession.life.life_id);

  const connection = options.initialConnection ?? (await openRankedNpcServerSession({
    backend: options.backend,
    contractId: options.contractId,
    networkId,
    lifeId: options.rankedSession.life.life_id,
    baseUrl: base,
    tokenStorage,
    fetcher,
  }));

  const sessionId = connection.sessionId;
  const sessionToken = connection.sessionToken;
  let currentSnapshot = connection.snapshot;
  let currentState = currentSnapshot.state;

  const publishSnapshot = (next: RankedNpcSessionSnapshot) => {
    currentSnapshot = next;
    currentState = next.state;
    options.onSnapshot?.(next);
  };

  async function authedGet<T>(path: string, fallbackError: string): Promise<T> {
    try {
      return await requestRankedNpcJson<T>(
        fetcher,
        path,
        { method: "GET", headers: { Authorization: `Bearer ${sessionToken}` } },
        fallbackError,
      );
    } catch (error) {
      if (error instanceof RankedNpcClientError && error.status === 401) {
        removeStoredNpcAuth(tokenStorage, authKey);
      }
      throw error;
    }
  }

  async function authedPost<T>(path: string, body: unknown, fallbackError: string): Promise<T> {
    try {
      return await requestRankedNpcJson<T>(
        fetcher,
        path,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(body),
        },
        fallbackError,
      );
    } catch (error) {
      if (error instanceof RankedNpcClientError && error.status === 401) {
        removeStoredNpcAuth(tokenStorage, authKey);
      }
      throw error;
    }
  }

  async function syncFromChainInternal(): Promise<RankedNpcSessionSnapshot> {
    const next = await authedPost<RankedNpcSessionSnapshot>(
      `${base}/sessions/${encodeURIComponent(sessionId)}/sync-chain`,
      {},
      "Could not synchronize on-chain draws with the ranked NPC server.",
    );
    publishSnapshot(next);
    return next;
  }

  async function refreshSession(): Promise<RankedNpcSessionSnapshot> {
    const next = await authedGet<RankedNpcSessionSnapshot>(
      `${base}/sessions/${encodeURIComponent(sessionId)}`,
      "Could not reload the ranked NPC session.",
    );
    publishSnapshot(next);
    return next;
  }

  async function settlePendingChainAndSyncServer(): Promise<void> {
    if (options.rankedSession.state.commands.length < currentSnapshot.state.commands.length) {
      await options.rankedSession.sync(currentSnapshot.state);
    } else {
      await options.rankedSession.sync(options.rankedSession.state);
    }
    if (options.rankedSession.state.commands.length > currentSnapshot.state.commands.length) {
      await syncFromChainInternal();
    }
    currentState = options.rankedSession.state;
  }

  // Reconcile any lag or unsettled on-chain obligation on initial connection.
  await settlePendingChainAndSyncServer();
  publishSnapshot(currentSnapshot);

  async function executeMutatingEndpoint(
    endpoint: "step" | "speak" | "answer",
    payloadFor: (revision: number, requestId: string) => Record<string, unknown>,
    fallbackError: string,
  ): Promise<LifeState> {
    await settlePendingChainAndSyncServer();
    if (currentState.phase === "ended") {
      return currentState;
    }

    const requestId = nextRequestId();
    const url = `${base}/sessions/${encodeURIComponent(sessionId)}/${endpoint}`;

    let result: RankedNpcSessionSnapshot & { newCommands: Command[] };
    try {
      result = await authedPost<RankedNpcSessionSnapshot & { newCommands: Command[] }>(
        url,
        payloadFor(currentSnapshot.revision, requestId),
        fallbackError,
      );
    } catch (error) {
      if (error instanceof RankedNpcClientError && error.status === 409) {
        const beforeCommands = currentSnapshot.state.commands.length;
        await refreshSession();
        await settlePendingChainAndSyncServer();
        const refreshedPhase = (currentState as LifeState).phase;
        if (currentSnapshot.state.commands.length === beforeCommands && refreshedPhase !== "ended") {
          result = await authedPost<RankedNpcSessionSnapshot & { newCommands: Command[] }>(
            url,
            payloadFor(currentSnapshot.revision, requestId),
            fallbackError,
          );
        } else {
          return currentState;
        }
      } else {
        throw error;
      }
    }

    publishSnapshot(result);
    await options.rankedSession.sync(result.state);
    if (options.rankedSession.state.commands.length > result.state.commands.length) {
      await syncFromChainInternal();
    } else {
      currentState = options.rankedSession.state;
    }
    return currentState;
  }

  const initialState = currentState;

  return {
    sessionId,
    initial: initialState,
    current: () => currentState,
    snapshot: () => currentSnapshot,
    onSynced: options.onSynced,
    dispatch(command: Command): Promise<LifeState> {
      return executeMutatingEndpoint(
        "step",
        (revision, requestId) => ({ revision, requestId, command }),
        "Could not step this ranked NPC life.",
      );
    },
    speak(npcId: string, message: string): Promise<LifeState> {
      return executeMutatingEndpoint(
        "speak",
        (revision, requestId) => ({ revision, requestId, npcId, message }),
        "Could not send speech to this NPC.",
      );
    },
    answer(offerId: string, accept: boolean): Promise<LifeState> {
      return executeMutatingEndpoint(
        "answer",
        (revision, requestId) => ({ revision, requestId, offerId, accept }),
        "Could not respond to this NPC offer.",
      );
    },
    async checkProvider(): Promise<RankedNpcSessionSnapshot> {
      const next = await authedPost<RankedNpcSessionSnapshot>(
        `${base}/sessions/${encodeURIComponent(sessionId)}/check-provider`,
        {},
        "Could not check live NPC provider status.",
      );
      publishSnapshot(next);
      return next;
    },
    syncFromChain: syncFromChainInternal,
  };
}

export function formatNpcProviderStatusNotice(status: NpcProviderStatus, rewardEligible: boolean): string | null {
  if (!rewardEligible) {
    return "Rule-based fallback was used earlier in this life because the live AI provider went offline. You can finish playing, but this life cannot mint an NFT or earn credits.";
  }
  if (status.status === "live") return null;
  if (status.status === "fallback") {
    return "The live NPC provider is currently unreachable. Wait before advancing if you want this life to stay eligible for NFT rewards.";
  }
  return null;
}
