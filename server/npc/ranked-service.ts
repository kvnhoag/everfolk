import { sha256Hex } from "../../chain/hash.ts";
import { keyDecisionCategory } from "../../chain/catalog/key-decisions.ts";
import { NPC_WORLD_VERSION } from "../../chain/ids.ts";
import type { AccountProof, NpcSessionAttestation } from "../../chain/npc-proof.ts";
import { checkRankedObligations, stepCommand } from "../../chain/ranked-rules.ts";
import type { LifeView } from "../../chain/types.ts";
import { activationCommand, applyCommand, validateRankedSave } from "../../chain/validate-ranked.ts";
import { createEngine } from "../../src/index.ts";
import {
  availableNpcActions,
  observeNpc,
  rulesDecision,
} from "../../src/npc/runtime.ts";
import { createNpcSimulation } from "../../src/npc/simulation.ts";
import { NPC_ROLES, type NpcDecision } from "../../src/npc/types.ts";
import { NpcInputError, integer, object, text } from "../../src/npc/validation.ts";
import { canonicalJson } from "../../src/random.ts";
import type { Command, LifeEngine, LifeState, SaveFile, WorldPack } from "../../src/types.ts";
import { viewLife, viewWorldVersions } from "../ranked/near-view.ts";
import { VerificationError, VerificationUnavailableError, type NpcRewardVerification } from "../ranked/verifier.ts";
import {
  AccountProofError,
  assertAccessKeyOnNear,
  buildAccountProofChallenge,
  parseAccountProofChallenge,
  verifyEd25519AccountProof,
  type AccountProofChallengeStore,
} from "./account-proof.ts";
import type { NpcController } from "./controller.ts";
import { providerFailure, type NpcProviderStatus } from "./provider-status.ts";
import type { NpcRankedStore, RankedNpcRecord, RankedNpcSessionSnapshot } from "./ranked-store.ts";

const ATTESTATION_TTL_MS = 120_000;
const ATTESTATION_REFRESH_MARGIN_MS = 15_000;
const DEFAULT_CHALLENGE_TTL_MS = 300_000;
const DEFAULT_DECISION_TIMEOUT_MS = 6_000;
const RANDOM_TOKEN_BYTES = 24;

export class RankedNpcHttpError extends Error {
  readonly status: number;
  readonly reason?: string;
  constructor(status: number, message: string, reason?: string) {
    super(message);
    this.name = "RankedNpcHttpError";
    this.status = status;
    this.reason = reason;
  }
}

export interface NpcRankedServiceOptions {
  contractId: string;
  rpcUrl: string;
  npcWorld: WorldPack;
  store: NpcRankedStore;
  challenges: AccountProofChallengeStore;
  controller?: NpcController;
  providerName?: string | null;
  configurationError?: boolean;
  decisionTimeoutMs?: number;
  challengeTtlMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface RankedNpcConfigResponse {
  world_version: string;
  provider_configured: boolean;
  provider_name: string | null;
  contract_supported: boolean;
  available: boolean;
}

export type NpcRankedStepResponse = RankedNpcSessionSnapshot & { newCommands: Command[] };
export type NpcRankedOpenResponse = RankedNpcSessionSnapshot & { sessionToken: string };

export interface NpcRankedService {
  config(): Promise<RankedNpcConfigResponse>;
  issueChallenge(input: { contractId: string; lifeId: string }): Promise<{ challenge: string; expiresAt: number; accountId: string }>;
  openSession(input: { contractId: string; lifeId: string; challenge: string; proof: AccountProof }): Promise<NpcRankedOpenResponse>;
  getSession(sessionId: string, sessionToken: string): Promise<RankedNpcSessionSnapshot>;
  step(sessionId: string, sessionToken: string, revision: number, requestId: string, command: unknown): Promise<NpcRankedStepResponse>;
  speak(sessionId: string, sessionToken: string, revision: number, requestId: string, npcId: string, message: string): Promise<NpcRankedStepResponse>;
  answer(sessionId: string, sessionToken: string, revision: number, requestId: string, offerId: string, accept: boolean): Promise<NpcRankedStepResponse>;
  syncChain(sessionId: string, sessionToken: string): Promise<RankedNpcSessionSnapshot>;
  checkProvider(sessionId: string, sessionToken: string): Promise<RankedNpcSessionSnapshot>;
  verifyForReward(life: LifeView, save: SaveFile): Promise<NpcRewardVerification>;
}

function randomHex(byteCount: number): string {
  const bytes = new Uint8Array(byteCount);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

function saveOf(state: LifeState): SaveFile {
  return {
    schemaVersion: 1,
    worldId: state.worldId,
    worldVersion: state.worldVersion,
    worldFingerprint: state.worldFingerprint,
    seed: state.seed,
    commands: [...state.commands],
  };
}

function snapshotOf(record: RankedNpcRecord, providerName: string | null): RankedNpcSessionSnapshot {
  return {
    sessionId: record.id,
    contractId: record.contractId,
    lifeId: record.lifeId,
    accountId: record.accountId,
    seed: record.seed,
    worldVersion: record.worldVersion,
    worldFingerprint: record.worldFingerprint,
    revision: record.revision,
    state: structuredClone(record.state),
    rewardEligible: !record.hadFallback,
    hadFallback: record.hadFallback,
    liveTurnCount: record.liveTurnCount,
    fallbackTurnCount: record.fallbackTurnCount,
    providerName,
    npcProvider: { ...record.providerStatus },
  };
}

function parseClientStepCommand(value: unknown): Command {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RankedNpcHttpError(400, "Send a valid game command.");
  }
  const raw = value as Record<string, unknown>;
  switch (raw.type) {
    case "advance":
      object(raw, ["type"]);
      return { type: "advance" };
    case "choose":
      object(raw, ["type", "choice"]);
      return { type: "choose", choice: text(raw.choice, 128) };
    case "act":
      if ("calendarDeadline" in raw) {
        object(raw, ["type", "activity", "calendarDeadline"]);
        if (raw.calendarDeadline !== true) throw new RankedNpcHttpError(400, "calendarDeadline must be true when supplied.");
        return { type: "act", activity: text(raw.activity, 128), calendarDeadline: true };
      }
      object(raw, ["type", "activity"]);
      return { type: "act", activity: text(raw.activity, 128) };
    case "assess-jobs":
      object(raw, ["type", "nodeId", "jobIds"]);
      if (!Array.isArray(raw.jobIds) || raw.jobIds.length < 2 || raw.jobIds.length > 8) {
        throw new RankedNpcHttpError(400, "Select distinct completed job IDs for assessment.");
      }
      return {
        type: "assess-jobs",
        nodeId: text(raw.nodeId, 32),
        jobIds: raw.jobIds.map(id => text(id, 64)),
      };
    case "avatar":
      object(raw, ["type", "variant"]);
      return { type: "avatar", variant: integer(raw.variant, 0, 12) };
    case "market-order":
      object(raw, ["type", "side", "asset", "quantity"]);
      if (raw.side !== "buy" && raw.side !== "sell") throw new RankedNpcHttpError(400, "Market side must be buy or sell.");
      return {
        type: "market-order",
        side: raw.side,
        asset: text(raw.asset, 64) as never,
        quantity: integer(raw.quantity, 1, 1_000_000),
      };
    case "market-cancel":
      object(raw, ["type", "orderId"]);
      return { type: "market-cancel", orderId: integer(raw.orderId, 0, 1_000_000) };
    case "trade":
    case "plan":
    case "assign-agents":
    case "delegate":
    case "agent":
      return raw as unknown as Command;
    case "npc-answer":
      object(raw, ["type", "offerId", "accept"]);
      if (typeof raw.accept !== "boolean") throw new RankedNpcHttpError(400, "Choose accept or decline.");
      return { type: "npc-answer", offerId: text(raw.offerId, 160), accept: raw.accept };
    case "influence":
      throw new RankedNpcHttpError(403, "Influences only come from recorded NEAR draws.");
    case "npc-turn":
      throw new RankedNpcHttpError(403, "NPC turns are generated authoritatively by the server.");
    case "npc-speech":
      throw new RankedNpcHttpError(403, "Use the NPC dialogue endpoint so replies come from the server.");
    default:
      throw new RankedNpcHttpError(400, "Unsupported command.");
  }
}

export function createNpcRankedService(options: NpcRankedServiceOptions): NpcRankedService {
  const fetchFn = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const decisionTimeoutMs = options.decisionTimeoutMs ?? DEFAULT_DECISION_TIMEOUT_MS;
  const challengeTtlMs = options.challengeTtlMs ?? DEFAULT_CHALLENGE_TTL_MS;
  const providerName = options.providerName ?? (options.controller?.kind === "laya" ? "Laya" : options.controller ? "OpenAI-compatible" : null);
  const engineCache = new Map<string, LifeEngine>();
  const baseEngine = createEngine(options.npcWorld);
  engineCache.set(baseEngine.fingerprint, baseEngine);

  function engineFor(world: WorldPack): LifeEngine {
    const built = createEngine(world);
    const cached = engineCache.get(built.fingerprint);
    if (cached) return cached;
    engineCache.set(built.fingerprint, built);
    return built;
  }

  async function requireRetainedEngine(record: RankedNpcRecord): Promise<LifeEngine> {
    if (record.worldFingerprint === baseEngine.fingerprint) return baseEngine;
    const retained = await options.store.loadWorld(record.worldFingerprint);
    if (!retained) throw new RankedNpcHttpError(500, "The retained world revision for this session could not be loaded.");
    const engine = engineFor(retained);
    if (engine.fingerprint !== record.worldFingerprint) {
      throw new RankedNpcHttpError(500, "The retained world revision fingerprint does not match the session.");
    }
    return engine;
  }

  async function assertAuthenticated(sessionId: string, sessionToken: string): Promise<RankedNpcRecord> {
    if (!sessionId || !sessionToken) throw new RankedNpcHttpError(401, "Missing ranked NPC session credentials.");
    const record = await options.store.readById(sessionId);
    if (!record) throw new RankedNpcHttpError(404, "Ranked NPC session not found.");
    const tokenHash = await sha256Hex(sessionToken);
    if (tokenHash !== record.tokenHash) {
      throw new RankedNpcHttpError(401, "This ranked NPC session is disconnected or superseded. Reconnect with account proof.");
    }
    return record;
  }

  async function probeControllerNow(world: WorldPack): Promise<{ ok: true; checkedAt: number } | { ok: false; checkedAt: number; status: NpcProviderStatus }> {
    const checkedAt = now();
    if (options.configurationError) {
      return {
        ok: false,
        checkedAt,
        status: { status: "fallback", reason: "configuration", checkedAt, retryAt: null },
      };
    }
    if (!options.controller) {
      return {
        ok: false,
        checkedAt,
        status: { status: "fallback", reason: "not-configured", checkedAt, retryAt: null },
      };
    }
    const sim = createNpcSimulation(world, `probe:${checkedAt}`);
    const activeId = NPC_ROLES.map(role => sim.slots[role]).find(id => availableNpcActions(sim, id, world).length > 0);
    if (!activeId) {
      return {
        ok: false,
        checkedAt,
        status: { status: "fallback", reason: "unavailable", checkedAt, retryAt: null },
      };
    }
    const observation = observeNpc(sim, activeId, world);
    const controllerTimeout = new AbortController();
    const timer = setTimeout(() => controllerTimeout.abort(), decisionTimeoutMs);
    try {
      const choice = await options.controller.decide(observation, controllerTimeout.signal);
      if (!observation.actions.some(a => a.id === choice.action)) {
        return {
          ok: false,
          checkedAt,
          status: { status: "fallback", reason: "invalid-response", checkedAt, retryAt: checkedAt + 15_000 },
        };
      }
      return { ok: true, checkedAt };
    } catch (error) {
      const reason = providerFailure(error);
      return {
        ok: false,
        checkedAt,
        status: { status: "fallback", reason, checkedAt, retryAt: checkedAt + 15_000 },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function reconcileOnChainDraws(
    record: RankedNpcRecord,
    engine: LifeEngine,
    onChainLife: LifeView,
  ): Promise<{ state: LifeState; applied: number; pendingDrawMissing: boolean }> {
    let working = record.state;
    let applied = 0;
    const figureCount = onChainLife.figure_picks.length;
    while (true) {
      if (working.phase !== "choice" || !working.pendingEventId || working.commands.length < figureCount) {
        return { state: working, applied, pendingDrawMissing: false };
      }
      const category = keyDecisionCategory(working.pendingEventId, working.worldVersion);
      if (!category) {
        return { state: working, applied, pendingDrawMissing: false };
      }
      const tip = working.commands.length;
      // If a prior draw >= figureCount has no subsequent "choose" command, it already satisfied this decision.
      const priorSatisfiedDraw = onChainLife.draws.find(d =>
        d.step >= figureCount &&
        d.step < tip &&
        !working.commands.slice(d.step).some(cmd => cmd.type === "choose"),
      );
      if (priorSatisfiedDraw) {
        return { state: working, applied, pendingDrawMissing: false };
      }
      const onChainDraw = onChainLife.draws.find(d => d.step === tip);
      if (!onChainDraw) {
        return { state: working, applied, pendingDrawMissing: true };
      }
      const expectedHash = await sha256Hex(canonicalJson(working.commands.slice(0, tip)));
      if (onChainDraw.category !== category || onChainDraw.commands_hash !== expectedHash) {
        throw new RankedNpcHttpError(409, "On-chain draw record conflicts with this ranked NPC life.");
      }
      if (!onChainDraw.token_id) {
        return { state: working, applied, pendingDrawMissing: false };
      }
      working = engine.influence(working, applyCommand(onChainDraw, record.contractId));
      applied += 1;
    }
  }

  async function decideTurn(world: WorldPack, life: LifeState): Promise<{
    decisions: Record<string, NpcDecision>;
    usedFallback: boolean;
    liveCount: number;
    fallbackCount: number;
    status: NpcProviderStatus;
  }> {
    const simState = {
      ...life.npcs!,
      player: life,
      commands: [],
    };
    const activeSlots = NPC_ROLES.map(role => life.npcs!.slots[role]).filter(
      id => availableNpcActions(simState, id, world).length > 0,
    );
    const decisions: Record<string, NpcDecision> = {};
    let usedFallback = false;
    let liveCount = 0;
    let fallbackCount = 0;
    let status: NpcProviderStatus = {
      status: options.controller && !options.configurationError ? "live" : "fallback",
      reason: options.configurationError ? "configuration" : options.controller ? null : "not-configured",
      checkedAt: now(),
      retryAt: null,
    };
    const liveSource: NpcDecision["source"] = options.controller?.kind === "laya" ? "laya" : "llm";

    for (const npcId of activeSlots) {
      if (!options.controller || options.configurationError) {
        usedFallback = true;
        fallbackCount += 1;
        decisions[npcId] = rulesDecision(simState, npcId, "fallback", world);
        continue;
      }
      const observation = observeNpc(simState, npcId, world);
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), decisionTimeoutMs);
      try {
        const result = await options.controller.decide(observation, abort.signal);
        if (!observation.actions.some(a => a.id === result.action)) {
          throw new Error("Controller chose unavailable NPC action.");
        }
        decisions[npcId] = { action: result.action, speech: text(result.speech || "Very well.", 500), source: liveSource };
        liveCount += 1;
        status = { status: "live", reason: null, checkedAt: now(), retryAt: null };
      } catch (error) {
        usedFallback = true;
        fallbackCount += 1;
        status = { status: "fallback", reason: providerFailure(error), checkedAt: now(), retryAt: now() + 15_000 };
        decisions[npcId] = rulesDecision(simState, npcId, "fallback", world);
      } finally {
        clearTimeout(timer);
      }
    }
    return { decisions, usedFallback, liveCount, fallbackCount, status };
  }

  async function mutateWithLock(
    sessionId: string,
    sessionToken: string,
    expectedRevision: number,
    requestId: string,
    opKey: string,
    run: (record: RankedNpcRecord, engine: LifeEngine) => Promise<{
      nextState: LifeState;
      newCommands: Command[];
      usedFallback?: boolean;
      liveCount?: number;
      fallbackCount?: number;
      providerStatus?: NpcProviderStatus;
    }>,
  ): Promise<NpcRankedStepResponse> {
    if (typeof requestId !== "string" || !requestId || requestId.length > 128) {
      throw new RankedNpcHttpError(400, "Include a bounded requestId for idempotency.");
    }
    if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new RankedNpcHttpError(400, "Include the current session revision.");
    }
    const record = await assertAuthenticated(sessionId, sessionToken);
    if (record.lastRequest?.id === requestId) {
      if (record.lastRequest.fingerprint !== opKey) {
        throw new RankedNpcHttpError(409, "This requestId was already used for a different command.");
      }
      return structuredClone(record.lastRequest.response);
    }
    if (record.inflight) throw new RankedNpcHttpError(409, "Another command is already running for this life.");
    if (record.revision !== expectedRevision) {
      throw new RankedNpcHttpError(409, "Session state changed on another request. Refresh and retry.");
    }
    const engine = await requireRetainedEngine(record);
    const lockedRecord: RankedNpcRecord = { ...record, inflight: requestId, revision: record.revision + 1 };
    if (!(await options.store.compareAndSwap(record.revision, lockedRecord))) {
      throw new RankedNpcHttpError(409, "Concurrent update detected. Please retry.");
    }

    try {
      const outcome = await run(lockedRecord, engine);
      const finalized: RankedNpcRecord = {
        ...lockedRecord,
        inflight: null,
        revision: lockedRecord.revision + 1,
        state: outcome.nextState,
        hadFallback: lockedRecord.hadFallback || Boolean(outcome.usedFallback),
        liveTurnCount: lockedRecord.liveTurnCount + (outcome.liveCount ?? 0),
        fallbackTurnCount: lockedRecord.fallbackTurnCount + (outcome.fallbackCount ?? 0),
        providerStatus: outcome.providerStatus ?? lockedRecord.providerStatus,
        lastRequest: null,
        activeAttestation: null,
      };
      const response: NpcRankedStepResponse = {
        ...snapshotOf(finalized, providerName),
        newCommands: outcome.newCommands,
      };
      finalized.lastRequest = { id: requestId, fingerprint: opKey, response: structuredClone(response) };
      if (!(await options.store.compareAndSwap(lockedRecord.revision, finalized))) {
        throw new RankedNpcHttpError(409, "Failed to commit ranked NPC turn cleanly.");
      }
      return response;
    } catch (error) {
      const unlocked: RankedNpcRecord = { ...lockedRecord, inflight: null, revision: lockedRecord.revision + 1 };
      await options.store.compareAndSwap(lockedRecord.revision, unlocked);
      if (error instanceof RankedNpcHttpError) throw error;
      if (error instanceof NpcInputError) throw new RankedNpcHttpError(400, error.message);
      throw new RankedNpcHttpError(400, error instanceof Error ? error.message : "Could not apply ranked NPC command.");
    }
  }

  return {
    async config() {
      const versions = options.contractId
        ? await viewWorldVersions(options.rpcUrl, options.contractId, fetchFn).catch(() => [] as string[])
        : [];
      const contractSupported = versions.includes(NPC_WORLD_VERSION);
      const providerConfigured = Boolean(options.controller && !options.configurationError);
      return {
        world_version: NPC_WORLD_VERSION,
        provider_configured: providerConfigured,
        provider_name: providerName,
        contract_supported: contractSupported,
        available: contractSupported && providerConfigured,
      };
    },

    async issueChallenge({ contractId, lifeId }) {
      if (contractId !== options.contractId) throw new RankedNpcHttpError(400, "Unknown ranked contract.");
      if (!/^\d{1,19}$/.test(lifeId)) throw new RankedNpcHttpError(400, "Invalid ranked life id.");
      const life = await viewLife(options.rpcUrl, contractId, lifeId, fetchFn);
      if (!life) throw new RankedNpcHttpError(404, "Ranked life not found on NEAR.");
      if (life.status !== "alive") throw new RankedNpcHttpError(409, "This ranked life is already ended or minted.");
      if (life.world_version !== NPC_WORLD_VERSION) throw new RankedNpcHttpError(400, "This ranked life is not an alexandria-npc-1 life.");
      const expiresAt = now() + challengeTtlMs;
      const nonce = randomHex(16);
      await options.challenges.issue({
        nonce,
        contractId,
        lifeId,
        accountId: life.account_id,
        expiresAt,
      });
      return {
        challenge: buildAccountProofChallenge({ nonce, contractId, lifeId, accountId: life.account_id, expiresAt }),
        expiresAt,
        accountId: life.account_id,
      };
    },

    async openSession({ contractId, lifeId, challenge, proof }) {
      if (contractId !== options.contractId) throw new RankedNpcHttpError(400, "Unknown ranked contract.");
      if (!/^\d{1,19}$/.test(lifeId)) throw new RankedNpcHttpError(400, "Invalid ranked life id.");
      const parsed = parseAccountProofChallenge(challenge);
      if (!parsed || parsed.contractId !== contractId || parsed.lifeId !== lifeId) {
        throw new RankedNpcHttpError(401, "Invalid or mismatched account ownership challenge.");
      }
      const life = await viewLife(options.rpcUrl, contractId, lifeId, fetchFn);
      if (!life) throw new RankedNpcHttpError(404, "Ranked life not found on NEAR.");
      if (life.status !== "alive") throw new RankedNpcHttpError(409, "This ranked life is no longer in progress.");
      if (life.world_version !== NPC_WORLD_VERSION) throw new RankedNpcHttpError(400, "This ranked life is not an alexandria-npc-1 life.");
      if (!proof || proof.accountId !== life.account_id || parsed.accountId !== life.account_id) {
        throw new RankedNpcHttpError(403, "Only the NEAR account owning this life may open its NPC session.");
      }
      try {
        await verifyEd25519AccountProof(challenge, proof);
        const consumed = await options.challenges.consume(parsed.nonce, {
          contractId,
          lifeId,
          accountId: life.account_id,
          nowMs: now(),
        });
        if (!consumed) throw new AccountProofError(401, "This ownership challenge was already used or has expired.");
        await assertAccessKeyOnNear({
          rpcUrl: options.rpcUrl,
          contractId,
          accountId: life.account_id,
          publicKey: proof.publicKey,
          fetchFn,
        });
      } catch (error) {
        if (error instanceof AccountProofError) throw new RankedNpcHttpError(error.status, error.message);
        throw error;
      }

      const sessionToken = randomHex(RANDOM_TOKEN_BYTES);
      const tokenHash = await sha256Hex(sessionToken);
      const existing = await options.store.readByLife(contractId, lifeId);
      if (existing) {
        if (existing.seed !== life.seed || existing.accountId !== life.account_id) {
          throw new RankedNpcHttpError(409, "Existing server session does not match the on-chain life record.");
        }
        const engine = await requireRetainedEngine(existing);
        const reconciled = await reconcileOnChainDraws(existing, engine, life);
        const rotated: RankedNpcRecord = {
          ...existing,
          revision: existing.revision + 1,
          tokenHash,
          state: reconciled.state,
          inflight: null,
        };
        if (!(await options.store.compareAndSwap(existing.revision, rotated))) {
          throw new RankedNpcHttpError(409, "Concurrent session update occurred; retry connecting.");
        }
        return { ...snapshotOf(rotated, providerName), sessionToken };
      }

      await options.store.saveWorld(baseEngine.fingerprint, options.npcWorld);
      let state = baseEngine.start(life.seed);
      for (const pick of life.figure_picks) {
        state = baseEngine.influence(state, activationCommand(pick, contractId));
      }
      const created: RankedNpcRecord = {
        id: crypto.randomUUID(),
        contractId,
        lifeId,
        accountId: life.account_id,
        seed: life.seed,
        worldVersion: NPC_WORLD_VERSION,
        worldFingerprint: baseEngine.fingerprint,
        revision: 0,
        tokenHash,
        inflight: null,
        state,
        hadFallback: false,
        liveTurnCount: 0,
        fallbackTurnCount: 0,
        providerStatus: {
          status: options.controller && !options.configurationError ? "waiting" : "fallback",
          reason: options.configurationError ? "configuration" : options.controller ? "not-checked" : "not-configured",
          checkedAt: null,
          retryAt: null,
        },
        lastRequest: null,
        activeAttestation: null,
      };
      const reconciled = await reconcileOnChainDraws(created, baseEngine, life);
      created.state = reconciled.state;

      const inserted = await options.store.insert(created);
      if (!inserted) {
        const raced = await options.store.readByLife(contractId, lifeId);
        if (!raced) throw new RankedNpcHttpError(500, "Could not open the ranked NPC session.");
        const updated: RankedNpcRecord = { ...raced, revision: raced.revision + 1, tokenHash, inflight: null };
        if (!(await options.store.compareAndSwap(raced.revision, updated))) {
          throw new RankedNpcHttpError(409, "Concurrent session creation; retry connecting.");
        }
        return { ...snapshotOf(updated, providerName), sessionToken };
      }
      return { ...snapshotOf(created, providerName), sessionToken };
    },

    async getSession(sessionId, sessionToken) {
      const record = await assertAuthenticated(sessionId, sessionToken);
      return snapshotOf(record, providerName);
    },

    async syncChain(sessionId, sessionToken) {
      const record = await assertAuthenticated(sessionId, sessionToken);
      const engine = await requireRetainedEngine(record);
      const life = await viewLife(options.rpcUrl, record.contractId, record.lifeId, fetchFn);
      if (!life || life.status !== "alive") {
        throw new RankedNpcHttpError(409, "This ranked life is no longer active on NEAR.");
      }
      const reconciled = await reconcileOnChainDraws(record, engine, life);
      if (reconciled.applied === 0) return snapshotOf(record, providerName);
      const nextRecord: RankedNpcRecord = {
        ...record,
        revision: record.revision + 1,
        state: reconciled.state,
      };
      if (!(await options.store.compareAndSwap(record.revision, nextRecord))) {
        throw new RankedNpcHttpError(409, "Session changed while reconciling chain draws; retry.");
      }
      return snapshotOf(nextRecord, providerName);
    },

    async checkProvider(sessionId, sessionToken) {
      const record = await assertAuthenticated(sessionId, sessionToken);
      const engine = await requireRetainedEngine(record);
      const probe = await probeControllerNow(engine.world);
      const status: NpcProviderStatus = probe.ok
        ? { status: "live", reason: null, checkedAt: probe.checkedAt, retryAt: null }
        : probe.status;
      const updated: RankedNpcRecord = {
        ...record,
        revision: record.revision + 1,
        providerStatus: status,
      };
      if (!(await options.store.compareAndSwap(record.revision, updated))) {
        throw new RankedNpcHttpError(409, "Concurrent update while probing provider.");
      }
      return snapshotOf(updated, providerName);
    },

    async step(sessionId, sessionToken, revision, requestId, rawCommand) {
      const command = parseClientStepCommand(rawCommand);
      const opKey = await sha256Hex(canonicalJson({ op: "step", command }));
      return mutateWithLock(sessionId, sessionToken, revision, requestId, opKey, async (record, engine) => {
        const life = await viewLife(options.rpcUrl, record.contractId, record.lifeId, fetchFn);
        if (!life || life.status !== "alive") {
          throw new RankedNpcHttpError(409, "This ranked life is no longer active on NEAR.");
        }
        const reconciled = await reconcileOnChainDraws(record, engine, life);
        let working = reconciled.state;
        const newCommands: Command[] = [];
        if (reconciled.applied > 0) {
          for (let i = record.state.commands.length; i < working.commands.length; i++) {
            newCommands.push(working.commands[i]);
          }
        }
        if (reconciled.pendingDrawMissing) {
          throw new RankedNpcHttpError(409, "Record the required on-chain NPC draw before continuing this life.");
        }
        let usedFallback = false;
        let liveCount = 0;
        let fallbackCount = 0;
        let providerStatus = record.providerStatus;

        if (
          command.type === "advance" &&
          working.phase === "ready" &&
          engine.world.npcAgents &&
          working.npcs &&
          working.npcs.lastResolvedAge !== working.age
        ) {
          const turn = await decideTurn(engine.world, working);
          usedFallback = turn.usedFallback;
          liveCount = turn.liveCount;
          fallbackCount = turn.fallbackCount;
          providerStatus = turn.status;
          const npcTurn: Command = { type: "npc-turn", decisions: turn.decisions };
          working = stepCommand(engine, working, npcTurn);
          newCommands.push(npcTurn);
        }

        working = stepCommand(engine, working, command);
        newCommands.push(command);
        return { nextState: working, newCommands, usedFallback, liveCount, fallbackCount, providerStatus };
      });
    },

    async speak(sessionId, sessionToken, revision, requestId, npcId, rawMessage) {
      if (typeof npcId !== "string" || !npcId) throw new RankedNpcHttpError(400, "Specify which NPC to speak with.");
      const cleanMessage = text(rawMessage, 500);
      const opKey = await sha256Hex(canonicalJson({ op: "speak", npcId, message: cleanMessage }));
      return mutateWithLock(sessionId, sessionToken, revision, requestId, opKey, async (record, engine) => {
        const life = await viewLife(options.rpcUrl, record.contractId, record.lifeId, fetchFn);
        if (!life || life.status !== "alive") {
          throw new RankedNpcHttpError(409, "This ranked life is no longer active on NEAR.");
        }
        const reconciled = await reconcileOnChainDraws(record, engine, life);
        let working = reconciled.state;
        const newCommands: Command[] = [];
        for (let i = record.state.commands.length; i < working.commands.length; i++) newCommands.push(working.commands[i]);
        if (reconciled.pendingDrawMissing) {
          throw new RankedNpcHttpError(409, "Record the required on-chain NPC draw before continuing this life.");
        }
        if (working.phase !== "ready" || !working.npcs) {
          throw new RankedNpcHttpError(400, "Resolve the current life decision before speaking with an NPC.");
        }
        const simState = { ...working.npcs, player: working, commands: [] };
        const npc = simState.people[npcId];
        if (!npc || !npc.introduced || npc.status !== "alive") {
          throw new RankedNpcHttpError(400, "That NPC is not currently available in this life.");
        }
        let reply = `I must attend to ${npc.goal.charAt(0).toLowerCase() + npc.goal.slice(1)}`;
        let usedFallback = false;
        let liveCount = 0;
        let fallbackCount = 0;
        let providerStatus = record.providerStatus;

        if (!options.controller || options.configurationError) {
          usedFallback = true;
          fallbackCount = 1;
          providerStatus = {
            status: "fallback",
            reason: options.configurationError ? "configuration" : "not-configured",
            checkedAt: now(),
            retryAt: null,
          };
        } else {
          const observation = observeNpc(simState, npcId, engine.world);
          const abort = new AbortController();
          const timer = setTimeout(() => abort.abort(), decisionTimeoutMs);
          try {
            const decided = await options.controller.decide(observation, abort.signal, cleanMessage);
            reply = text(decided.speech || reply, 500);
            liveCount = 1;
            providerStatus = { status: "live", reason: null, checkedAt: now(), retryAt: null };
          } catch (error) {
            usedFallback = true;
            fallbackCount = 1;
            providerStatus = { status: "fallback", reason: providerFailure(error), checkedAt: now(), retryAt: now() + 15_000 };
          } finally {
            clearTimeout(timer);
          }
        }
        const speechCommand: Command = { type: "npc-speech", npcId, text: cleanMessage, reply };
        working = stepCommand(engine, working, speechCommand);
        newCommands.push(speechCommand);
        return { nextState: working, newCommands, usedFallback, liveCount, fallbackCount, providerStatus };
      });
    },

    async answer(sessionId, sessionToken, revision, requestId, offerId, accept) {
      if (typeof offerId !== "string" || !offerId || typeof accept !== "boolean") {
        throw new RankedNpcHttpError(400, "Specify the NPC offer and whether to accept or decline.");
      }
      return this.step(sessionId, sessionToken, revision, requestId, { type: "npc-answer", offerId, accept });
    },

    async verifyForReward(life, save) {
      const record = await options.store.readByLife(options.contractId, life.life_id);
      if (!record) {
        throw new VerificationError("No authoritative ranked NPC session exists for this life.");
      }
      if (record.seed !== save.seed || record.accountId !== life.account_id) {
        throw new VerificationError("This save does not match the bound ranked NPC session.");
      }
      const retainedWorld = await options.store.loadWorld(record.worldFingerprint);
      if (!retainedWorld) {
        throw new VerificationError("The retained world revision for this NPC life is unavailable.");
      }
      const engine = engineFor(retainedWorld);
      if (engine.fingerprint !== record.worldFingerprint || save.worldFingerprint !== record.worldFingerprint) {
        throw new VerificationError("This save was played on different world content than the retained NPC revision.");
      }

      const reconciled = await reconcileOnChainDraws(record, engine, life);
      const authoritativeCommands = reconciled.state.commands;
      if (canonicalJson(save.commands) !== canonicalJson(authoritativeCommands)) {
        throw new VerificationError("This save differs from the server's recorded NPC session.");
      }
      if (record.hadFallback) {
        throw new VerificationError(
          "This life used rule-based fallback turns while the live NPC provider was unavailable, so NFT rewards and account credits cannot be issued.",
        );
      }
      for (const command of save.commands) {
        if (command.type === "npc-turn") {
          const entries = Object.values(command.decisions);
          if (entries.length === 0 || entries.some(d => d.source !== "llm" && d.source !== "laya")) {
            throw new VerificationError("All NPC decisions in a reward-eligible life must come from a verified live AI provider.");
          }
        }
      }

      const saveCheck = await validateRankedSave(life, save, options.contractId);
      if (!saveCheck.ok) throw new VerificationError(saveCheck.reason);
      const obligations = checkRankedObligations(engine, life, save);
      if (!obligations.ok) throw new VerificationError(obligations.reason);
      if (obligations.state.phase !== "ended") {
        throw new VerificationError("This life has not ended yet.");
      }

      // Immediate live-provider verification before issuing or re-issuing reward credentials.
      const probe = await probeControllerNow(retainedWorld);
      if (!probe.ok) {
        const failedStatus = { ...probe.status };
        await options.store.compareAndSwap(record.revision, {
          ...record,
          revision: record.revision + 1,
          providerStatus: failedStatus,
        });
        throw new VerificationUnavailableError(
          "The live NPC provider is unavailable right now. Your completed life is saved — retry verification when the provider recovers.",
        );
      }

      const saveHash = await sha256Hex(canonicalJson(save));
      const nowMs = probe.checkedAt;
      const existing = record.activeAttestation;
      if (
        existing &&
        existing.session_id === record.id &&
        existing.transcript_hash === saveHash &&
        existing.expires_at > nowMs + ATTESTATION_REFRESH_MARGIN_MS
      ) {
        return { world: retainedWorld, attestation: existing };
      }

      const attestation: NpcSessionAttestation = {
        session_id: record.id,
        transcript_hash: saveHash,
        provider_checked_at: nowMs,
        expires_at: nowMs + ATTESTATION_TTL_MS,
      };
      const updatedRecord: RankedNpcRecord = {
        ...record,
        revision: record.revision + 1,
        state: reconciled.state,
        providerStatus: { status: "live", reason: null, checkedAt: nowMs, retryAt: null },
        activeAttestation: attestation,
      };
      if (!(await options.store.compareAndSwap(record.revision, updatedRecord))) {
        const latest = await options.store.readById(record.id);
        if (
          latest?.activeAttestation &&
          latest.activeAttestation.transcript_hash === saveHash &&
          latest.activeAttestation.expires_at > nowMs + ATTESTATION_REFRESH_MARGIN_MS
        ) {
          return { world: retainedWorld, attestation: latest.activeAttestation };
        }
        throw new VerificationUnavailableError("Verification raced with another request; please retry.");
      }
      return { world: retainedWorld, attestation };
    },
  };
}
