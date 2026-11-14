import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { base58 } from "../chain/base58.ts";
import { sha256Hex } from "../chain/hash.ts";
import { NPC_ACTIONS, NPC_WORLD_VERSION } from "../chain/ids.ts";
import { buildNpcWorld } from "../chain/npc-world.ts";
import type { AccountProof, NpcSessionAttestation } from "../chain/npc-proof.ts";
import { connectRankedNpcOnline, openRankedNpcServerSession, seedLocalRankedNpcSaveIfMissing } from "../client/chain/npc-online.ts";
import { createMockContract } from "../client/chain/mock-contract.ts";
import { practiceVerifier } from "../client/chain/practice-verifier.ts";
import { beginRankedSession, rankedSaveKey, sessionSaveScope, type SessionStorage } from "../client/chain/ranked-session.ts";
import { createEngine } from "../src/index.ts";
import { canonicalJson } from "../src/random.ts";
import type { Command, LifeState, SaveFile, WorldPack } from "../src/types.ts";
import { createNpcSessionService } from "../server/npc/service.ts";
import { memoryNpcStore } from "../server/npc/store.ts";
import { d1ChallengeStore } from "../server/npc/account-proof.ts";
import type { NpcController } from "../server/npc/controller.ts";
import { npcRankedRoute } from "../server/npc/ranked-http.ts";
import { createNpcRankedService } from "../server/npc/ranked-service.ts";
import { d1NpcRankedStore } from "../server/npc/ranked-store.ts";
import { defaultRankedDependencies } from "../server/ranked/default-verifier.ts";
import { createMemoryLimiter } from "../server/ranked/rate-limit.ts";
import { handleRankedApi, type RankedEnvironment } from "../server/ranked/routes.ts";
import { TestDatabase } from "./support/d1.ts";

const CONTRACT_ID = "everfolk-lives.testnet";
const RPC_URL = "https://rpc.testnet.test";
const VERIFIER_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const lives8 = JSON.parse(readFileSync(new URL("../worlds/demo/alexandria-lives-8.json", import.meta.url), "utf8")) as WorldPack;
const npcWorld = buildNpcWorld(lives8);
const npcEngine = createEngine(npcWorld);

function memoryStorage(): SessionStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: key => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: key => void items.delete(key),
  };
}

interface Ed25519Actor {
  accountId: string;
  publicKey: string;
  prove(message: string): Promise<AccountProof>;
}

async function createActor(accountId: string): Promise<Ed25519Actor> {
  const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const publicKey = `ed25519:${base58(rawPub)}`;
  return {
    accountId,
    publicKey,
    async prove(message: string): Promise<AccountProof> {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
      const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, digest));
      const signature = Array.from(sig, b => b.toString(16).padStart(2, "0")).join("");
      return { accountId, publicKey, signature };
    },
  };
}

function encodeRpcJson(value: unknown): Response {
  const bytes = Array.from(new TextEncoder().encode(JSON.stringify(value)));
  return Response.json({ jsonrpc: "2.0", id: "everfolk", result: { result: bytes } });
}

interface TestHarnessOptions {
  accountId?: string;
  npcWorldPack?: WorldPack;
  initialNowMs?: number;
  nobodyWeightBps?: number;
  controllerKind?: "llm" | "laya";
}

async function createHarness(options: TestHarnessOptions = {}) {
  let clockMs = options.initialNowMs ?? 1_780_000_000_000;
  const now = () => clockMs;
  const db = new TestDatabase();
  const accountId = options.accountId ?? "player.testnet";
  const contract = createMockContract({
    accountId,
    nobodyWeightBps: options.nobodyWeightBps ?? 0,
    now,
    treasuryId: "treasury.testnet",
  });

  const actor = await createActor(accountId);
  const keyPermissions = new Map<string, unknown>([
    [`${accountId}:${actor.publicKey}`, { FunctionCall: { receiver_id: CONTRACT_ID } }],
  ]);

  let decideCalls = 0;
  let controllerOnline = true;
  let controllerErrorMessage = "Simulated upstream provider outage";
  const kind = options.controllerKind ?? "llm";

  const controller: NpcController = {
    kind,
    async decide(observation) {
      decideCalls += 1;
      if (!controllerOnline) {
        throw new Error(controllerErrorMessage);
      }
      const action = observation.actions[0];
      return {
        action: action.id,
        speech: `Live ${kind} turn ${decideCalls} for ${observation.actor.name}`,
      };
    },
  };

  let rpcFetch!: typeof fetch;
  const challenges = d1ChallengeStore(db);
  const store = d1NpcRankedStore(db);

  const service = createNpcRankedService({
    contractId: CONTRACT_ID,
    rpcUrl: RPC_URL,
    npcWorld: options.npcWorldPack ?? npcWorld,
    store,
    challenges,
    controller,
    providerName: kind === "laya" ? "laya" : "test-llm",
    fetch: (input, init) => rpcFetch(input, init),
    now,
  });

  const env: RankedEnvironment = {
    DB: db,
    RANKED_CONTRACT_ID: CONTRACT_ID,
    RANKED_VERIFIER_SECRET: VERIFIER_SECRET,
    NEAR_RPC_URL: RPC_URL,
    NPC_RANKED: service,
  };
  const rankedDeps = {
    ...defaultRankedDependencies(),
    fetch: (input: RequestInfo | URL, init?: RequestInit) => rpcFetch(input, init),
    now: () => new Date(clockMs),
    limiter: createMemoryLimiter({ limit: 100, windowMs: 60_000, now }),
  };

  rpcFetch = async (input, init) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (rawUrl === RPC_URL) {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        params?: {
          request_type?: string;
          account_id?: string;
          public_key?: string;
          method_name?: string;
          args_base64?: string;
        };
      };
      const params = body.params;
      if (params?.request_type === "view_access_key") {
        const perm = keyPermissions.get(`${params.account_id}:${params.public_key}`);
        if (!perm) {
          return Response.json({ jsonrpc: "2.0", id: "everfolk", result: { error: "access key does not exist" } });
        }
        return Response.json({ jsonrpc: "2.0", id: "everfolk", result: { permission: perm } });
      }
      if (params?.request_type === "call_function") {
        const args = JSON.parse(Buffer.from(params.args_base64 ?? "", "base64").toString("utf8")) as Record<string, string>;
        if (params.method_name === "get_life") {
          return encodeRpcJson(await contract.getLife(args.life_id));
        }
        if (params.method_name === "get_world_versions") {
          return encodeRpcJson(["alexandria-demo-2", "alexandria-ranked-1", NPC_WORLD_VERSION]);
        }
      }
      throw new Error(`Unexpected RPC method: ${JSON.stringify(params)}`);
    }

    const url = new URL(rawUrl, "https://everfolk.test");
    const request = new Request(url, init);
    if (url.pathname.startsWith("/api/npc/ranked/")) {
      return npcRankedRoute(request, service);
    }
    if (url.pathname.startsWith("/api/ranked/")) {
      return handleRankedApi(request, env, rankedDeps);
    }
    throw new Error(`Unexpected fetch URL: ${url.toString()}`);
  };

  return {
    db,
    contract,
    actor,
    keyPermissions,
    store,
    service,
    env,
    rankedDeps,
    rpcFetch,
    get clockMs() {
      return clockMs;
    },
    setClockMs(next: number) {
      clockMs = next;
    },
    advanceClockMs(delta: number) {
      clockMs += delta;
    },
    get decideCalls() {
      return decideCalls;
    },
    setControllerOnline(online: boolean, message = "Simulated upstream provider outage") {
      controllerOnline = online;
      controllerErrorMessage = message;
    },
    backend(): { mode: "live"; proveAccount: (msg: string) => Promise<AccountProof> } {
      return { mode: "live", proveAccount: msg => actor.prove(msg) };
    },
    rebuildServiceWithWorld(nextWorld: WorldPack) {
      return createNpcRankedService({
        contractId: CONTRACT_ID,
        rpcUrl: RPC_URL,
        npcWorld: nextWorld,
        store,
        challenges,
        controller,
        providerName: kind === "laya" ? "laya" : "test-llm",
        fetch: (input, init) => rpcFetch(input, init),
        now,
      });
    },
  };
}

/** Plays a ranked NPC life through OnlinePlay until `stop` or ending. */
async function playOnlineLife(
  online: Awaited<ReturnType<typeof connectRankedNpcOnline>>,
  stop: (state: LifeState) => boolean = state => state.phase === "ended",
  maxSteps = 400,
): Promise<LifeState> {
  let state = online.current();
  for (let i = 0; i < maxSteps && state.phase !== "ended" && !stop(state); i++) {
    let command: Command;
    if (state.phase === "choice") {
      const choices = npcEngine.getChoices(state);
      const safeChoice =
        choices.find(c => !/ill|poison|risk|flee|steal|fight|borrow|loan/i.test(c.id)) ??
        choices[0];
      assert.ok(safeChoice, `Expected a choice for pending event ${state.pendingEventId}`);
      command = { type: "choose", choice: safeChoice.id };
    } else {
      command = { type: "advance" };
    }
    state = await online.dispatch(command);
  }
  return state;
}

test("ranked NPC config advertises alexandria-npc-1 availability without breaking /api/ranked/config", async () => {
  const h = await createHarness();
  const npcCfgRes = await h.rpcFetch("https://everfolk.test/api/npc/ranked/config");
  assert.equal(npcCfgRes.status, 200);
  assert.deepEqual(await npcCfgRes.json(), {
    world_version: NPC_WORLD_VERSION,
    provider_configured: true,
    provider_name: "test-llm",
    contract_supported: true,
    available: true,
  });

  const rankedCfgRes = await h.rpcFetch("https://everfolk.test/api/ranked/config");
  assert.equal(rankedCfgRes.status, 200);
  const rankedCfg = (await rankedCfgRes.json()) as Record<string, unknown>;
  assert.equal(rankedCfg.world_version, "alexandria-weave-1", "Weave mode plays the figure-path world");
});

test("end-to-end live AI life verifies replay, checks provider right before verify, mints NFT pack & credits sources", async () => {
  const h = await createHarness({ nobodyWeightBps: 0 });
  const saveStorage = memoryStorage();
  const tokenStorage = memoryStorage();

  const life = await h.contract.startLife(NPC_WORLD_VERSION);
  assert.equal(life.world_version, NPC_WORLD_VERSION);
  const scope = sessionSaveScope({ contractId: CONTRACT_ID, networkId: "testnet", practice: false });

  const rankedSession = await beginRankedSession({
    contract: h.contract,
    contractId: CONTRACT_ID,
    networkId: "testnet",
    verifyUrl: "https://everfolk.test/api/ranked/verify",
    world: npcWorld,
    storage: saveStorage,
  }, life);

  const online = await connectRankedNpcOnline({
    backend: h.backend(),
    rankedSession,
    contractId: CONTRACT_ID,
    networkId: "testnet",
    baseUrl: "https://everfolk.test/api/npc/ranked",
    tokenStorage,
    fetcher: h.rpcFetch,
  });

  const endState = await playOnlineLife(online);
  assert.equal(endState.phase, "ended");
  assert.ok(endState.commands.some(c => c.type === "npc-turn"), "Life must contain verified npc-turn commands");

  const snap = online.snapshot();
  assert.equal(snap.rewardEligible, true, `unexpected fallback: ${JSON.stringify({ hadFallback: snap.hadFallback, liveTurnCount: snap.liveTurnCount, fallbackTurnCount: snap.fallbackTurnCount, npcProvider: snap.npcProvider })}`);
  assert.equal(snap.hadFallback, false);
  assert.ok(snap.liveTurnCount > 0, "Expected recorded live AI turns");
  assert.equal(snap.fallbackTurnCount, 0);

  const callsBeforeVerify = h.decideCalls;
  const genesisBalanceBefore = BigInt(await h.contract.balanceOf("genesis.testnet"));
  const treasuryBalanceBefore = BigInt(await h.contract.balanceOf("treasury.testnet"));

  // Verification triggers a fresh live-provider probe right before issuing SignedEvidence + attestation.
  const signed = await rankedSession.finish(h.rpcFetch);
  assert.ok(h.decideCalls > callsBeforeVerify, "verify must probe live provider immediately before issuing reward");

  const attestation = signed.evidence.npc_session as NpcSessionAttestation | undefined;
  assert.ok(attestation, "SignedEvidence must include npc_session attestation");
  assert.equal(attestation.session_id, online.sessionId);
  assert.equal(attestation.transcript_hash, await sha256Hex(canonicalJson(JSON.parse(rankedSession.save()))));
  assert.equal(attestation.provider_checked_at, h.clockMs);
  assert.equal(attestation.expires_at, h.clockMs + 120_000);

  const actionId = NPC_ACTIONS[signed.evidence.career_group].actions[0];
  // The live NPC world has historical figure paths, so its evidence signs the cards the life earned (chain/earned-cards.ts).
  const earned = signed.evidence.earned_cards;
  assert.ok(Array.isArray(earned), "a figure-path world signs the earned cards, even when there are none");
  if (!earned.length) {
    // A person of the city who followed no figure earns no NFT: no pack, and no rolled direct mint.
    await assert.rejects(h.contract.openMintPack(life.life_id, signed, actionId), /earned no card/);
    await assert.rejects(rankedSession.mint(signed, actionId), /pack/);
    return;
  }
  const pack = await h.contract.openMintPack(life.life_id, signed, actionId);
  assert.deepEqual(pack.cards.map(card => card.card_id), earned.slice(0, 5).map(card => card.card_id));
  const mintResult = await rankedSession.chooseMint(0);
  assert.ok(mintResult.token_id);
  const mintedToken = await h.contract.token(mintResult.token_id);
  assert.equal(mintedToken?.owner_id, "player.testnet");
  assert.equal(h.db && saveStorage.getItem(rankedSaveKey(life.life_id, scope)), null, "Committed mint cleans local save");
  const genesisBalanceAfter = BigInt(await h.contract.balanceOf("genesis.testnet"));
  const treasuryBalanceAfter = BigInt(await h.contract.balanceOf("treasury.testnet"));
  assert.ok(treasuryBalanceAfter > treasuryBalanceBefore, "Protocol treasury received reward share");
  assert.ok(genesisBalanceAfter >= genesisBalanceBefore, "Source owners received payout shares cleanly");
});

test("retained world revision verifies even when live world pack updates later", async () => {
  const h = await createHarness();
  const life = await h.contract.startLife(NPC_WORLD_VERSION);
  const saveStorage = memoryStorage();
  const tokenStorage = memoryStorage();

  const rankedSession = await beginRankedSession({
    contract: h.contract,
    contractId: CONTRACT_ID,
    verifyUrl: "https://everfolk.test/api/ranked/verify",
    world: npcWorld,
    storage: saveStorage,
  }, life);

  const online = await connectRankedNpcOnline({
    backend: h.backend(),
    rankedSession,
    contractId: CONTRACT_ID,
    baseUrl: "https://everfolk.test/api/npc/ranked",
    tokenStorage,
    fetcher: h.rpcFetch,
  });

  const endState = await playOnlineLife(online);
  assert.equal(endState.phase, "ended");

  // Swap the server's active world revision to a modified world pack with a different fingerprint.
  const updatedWorld: WorldPack = {
    ...npcWorld,
    title: "Updated Alexandria World Revision",
  };
  const updatedService = h.rebuildServiceWithWorld(updatedWorld);
  h.env.NPC_RANKED = updatedService;

  const verifyReq = new Request("https://everfolk.test/api/ranked/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ life_id: life.life_id, save: rankedSession.save() }),
  });
  const res = await handleRankedApi(verifyReq, h.env, h.rankedDeps);
  assert.equal(res.status, 200, "Server must verify against the exact retained world revision stored for this life");

  // Submitting the same save rewritten with the newer worldFingerprint must be rejected.
  const alteredWorldSave: SaveFile = { ...(JSON.parse(rankedSession.save()) as SaveFile), worldFingerprint: "mismatched-fingerprint" };
  const rejectReq = new Request("https://everfolk.test/api/ranked/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ life_id: life.life_id, save: JSON.stringify(alteredWorldSave) }),
  });
  const rejectRes = await handleRankedApi(rejectReq, h.env, h.rankedDeps);
  assert.equal(rejectRes.status, 400);
});

test("provider outage at verify returns 503 without tainting, recovers on retry, and idempotency/duplicate mints are guarded", async () => {
  const h = await createHarness({ controllerKind: "laya" });
  const saveStorage = memoryStorage();
  const tokenStorage = memoryStorage();
  const life = await h.contract.startLife(NPC_WORLD_VERSION);

  const rankedSession = await beginRankedSession({
    contract: h.contract,
    contractId: CONTRACT_ID,
    verifyUrl: "https://everfolk.test/api/ranked/verify",
    world: npcWorld,
    storage: saveStorage,
  }, life);

  const online = await connectRankedNpcOnline({
    backend: h.backend(),
    rankedSession,
    contractId: CONTRACT_ID,
    baseUrl: "https://everfolk.test/api/npc/ranked",
    tokenStorage,
    fetcher: h.rpcFetch,
  });

  await playOnlineLife(online);
  assert.equal(online.snapshot().rewardEligible, true);

  // Drop provider immediately before verify.
  h.setControllerOnline(false, "503 gateway timeout");
  await assert.rejects(rankedSession.finish(h.rpcFetch), /live NPC provider is unavailable/i);
  const storedAfterFailure = await h.store.readByLife(CONTRACT_ID, life.life_id);
  assert.equal(storedAfterFailure?.hadFallback, false, "Failed verify probe must NOT permanently taint completed live session");

  // Recover provider: verify now succeeds!
  h.setControllerOnline(true);
  const firstSigned = await rankedSession.finish(h.rpcFetch);
  const secondSigned = await rankedSession.finish(h.rpcFetch);
  assert.equal(firstSigned.evidence_hash, secondSigned.evidence_hash, "Retry within attestation window is idempotent");
  assert.equal(firstSigned.signature, secondSigned.signature);

  // Advancing past refresh margin (120_000 - 15_000 = 105_000ms) probes and refreshes attestation cleanly.
  h.advanceClockMs(106_000);
  const refreshedSigned = await rankedSession.finish(h.rpcFetch);
  assert.notEqual(refreshedSigned.evidence_hash, firstSigned.evidence_hash);

  // Earned evidence never mints by a rolled direct mint; a life that earned no card cannot open a pack either.
  const actionId = NPC_ACTIONS[refreshedSigned.evidence.career_group].actions[0];
  assert.deepEqual(refreshedSigned.evidence.earned_cards, [], "this town life followed no historical figure");
  await assert.rejects(h.contract.mintLife(life.life_id, refreshedSigned, actionId), /pack/);
  await assert.rejects(h.contract.openMintPack(life.life_id, refreshedSigned, actionId), /earned no card/);
});

test("mid-life provider failure lets play finish via rule fallback while permanently disqualifying NFT rewards", async () => {
  const h = await createHarness();
  const saveStorage = memoryStorage();
  const tokenStorage = memoryStorage();
  const life = await h.contract.startLife(NPC_WORLD_VERSION);

  const rankedSession = await beginRankedSession({
    contract: h.contract,
    contractId: CONTRACT_ID,
    verifyUrl: "https://everfolk.test/api/ranked/verify",
    world: npcWorld,
    storage: saveStorage,
  }, life);

  const online = await connectRankedNpcOnline({
    backend: h.backend(),
    rankedSession,
    contractId: CONTRACT_ID,
    baseUrl: "https://everfolk.test/api/npc/ranked",
    tokenStorage,
    fetcher: h.rpcFetch,
  });

  // Play at least one live turn first, then break the provider mid-life.
  await playOnlineLife(online, s => s.age >= 2);
  h.setControllerOnline(false);
  await playOnlineLife(online, s => s.age >= 5 || s.phase === "ended");

  const snapDuringFallback = online.snapshot();
  assert.equal(snapDuringFallback.hadFallback, true);
  assert.equal(snapDuringFallback.rewardEligible, false);
  assert.ok(snapDuringFallback.fallbackTurnCount > 0);

  // Even after provider recovers and life finishes, reward issuance is permanently rejected.
  h.setControllerOnline(true);
  await playOnlineLife(online);
  assert.equal(online.current().phase, "ended");

  await assert.rejects(
    rankedSession.finish(h.rpcFetch),
    /rule-based fallback turns/i,
  );
  await assert.rejects(
    practiceVerifier(npcWorld, h.contract)(life, JSON.parse(rankedSession.save()) as SaveFile),
    /cannot mint|live NPC/i,
  );
});

test("rejects tampered saves, forged NPC commands, standalone free-play exports, wrong accounts, revoked keys & disconnected sessions", async () => {
  const h = await createHarness();
  const saveStorage = memoryStorage();
  const tokenStorageA = memoryStorage();
  const tokenStorageB = memoryStorage();
  const life = await h.contract.startLife(NPC_WORLD_VERSION);

  // 1. Wrong NEAR account attempting to open the session is rejected with 403.
  const challengeRes = await h.rpcFetch("https://everfolk.test/api/npc/ranked/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contractId: CONTRACT_ID, lifeId: life.life_id }),
  });
  const { challenge } = (await challengeRes.json()) as { challenge: string };
  const intruder = await createActor("intruder.testnet");
  h.keyPermissions.set(`intruder.testnet:${intruder.publicKey}`, "FullAccess");
  const intruderRes = await h.rpcFetch("https://everfolk.test/api/npc/ranked/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contractId: CONTRACT_ID,
      lifeId: life.life_id,
      challenge,
      proof: await intruder.prove(challenge),
    }),
  });
  assert.equal(intruderRes.status, 403);

  // 2. Re-using the same challenge nonce or bad Ed25519 signature or revoked key is rejected.
  const validProof = await h.actor.prove(challenge);
  const badSigRes = await h.rpcFetch("https://everfolk.test/api/npc/ranked/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contractId: CONTRACT_ID,
      lifeId: life.life_id,
      challenge,
      proof: { ...validProof, signature: "0".repeat(128) },
    }),
  });
  assert.equal(badSigRes.status, 401);

  // Consume challenge once legitimately (returns 201), then replaying the exact same challenge returns 401.
  const firstOpenRes = await h.rpcFetch("https://everfolk.test/api/npc/ranked/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contractId: CONTRACT_ID,
      lifeId: life.life_id,
      challenge,
      proof: validProof,
    }),
  });
  assert.equal(firstOpenRes.status, 201);

  const replayChallengeRes = await h.rpcFetch("https://everfolk.test/api/npc/ranked/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contractId: CONTRACT_ID,
      lifeId: life.life_id,
      challenge,
      proof: validProof,
    }),
  });
  assert.equal(replayChallengeRes.status, 401);

  const rankedSession = await beginRankedSession({
    contract: h.contract,
    contractId: CONTRACT_ID,
    verifyUrl: "https://everfolk.test/api/ranked/verify",
    world: npcWorld,
    storage: saveStorage,
  }, life);

  const onlineA = await connectRankedNpcOnline({
    backend: h.backend(),
    rankedSession,
    contractId: CONTRACT_ID,
    baseUrl: "https://everfolk.test/api/npc/ranked",
    tokenStorage: tokenStorageA,
    fetcher: h.rpcFetch,
  });

  // 3. Forged client `npc-turn` and `influence` commands sent directly to /step are rejected.
  const connAuthA = JSON.parse(tokenStorageA.items.values().next().value!) as { sessionId: string; sessionToken: string };
  for (const forbiddenCommand of [
    { type: "npc-turn", decisions: {} },
    { type: "influence", mode: "apply", entry: "letters.teach", power: 3, source: { contractId: CONTRACT_ID, tokenId: "1" } },
  ]) {
    const forgedRes = await h.rpcFetch(`https://everfolk.test/api/npc/ranked/sessions/${connAuthA.sessionId}/step`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${connAuthA.sessionToken}`,
      },
      body: JSON.stringify({
        revision: onlineA.snapshot().revision,
        requestId: "forged-cmd",
        command: forbiddenCommand,
      }),
    });
    assert.equal(forgedRes.status, 403);
  }

  // 4. Step requestId idempotency vs conflict on different command.
  const stepReqId = "idempotent-step-1";
  const callsBeforeStep = h.decideCalls;
  const revBefore = onlineA.snapshot().revision;
  const firstStepRes = await h.rpcFetch(`https://everfolk.test/api/npc/ranked/sessions/${connAuthA.sessionId}/step`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${connAuthA.sessionToken}` },
    body: JSON.stringify({ revision: revBefore, requestId: stepReqId, command: { type: "advance" } }),
  });
  assert.equal(firstStepRes.status, 200);
  const callsAfterStep = h.decideCalls;

  const duplicateStepRes = await h.rpcFetch(`https://everfolk.test/api/npc/ranked/sessions/${connAuthA.sessionId}/step`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${connAuthA.sessionToken}` },
    body: JSON.stringify({ revision: revBefore, requestId: stepReqId, command: { type: "advance" } }),
  });
  assert.equal(duplicateStepRes.status, 200);
  assert.equal(h.decideCalls, callsAfterStep, "Idempotent step retry must not invoke AI controller again");
  assert.ok(callsAfterStep >= callsBeforeStep);

  const mismatchReqRes = await h.rpcFetch(`https://everfolk.test/api/npc/ranked/sessions/${connAuthA.sessionId}/step`, {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${connAuthA.sessionToken}` },
    body: JSON.stringify({ revision: revBefore, requestId: stepReqId, command: { type: "avatar", variant: 1 } }),
  });
  assert.equal(mismatchReqRes.status, 409);

  const checkedSnap = await onlineA.checkProvider();
  assert.equal(checkedSnap.npcProvider.status, "live");

  // 5. Opening on Device B rotates the bearer token, immediately disconnecting Device A, while seeding Device B's local save!
  const deviceBSaveStorage = memoryStorage();
  const connB = await openRankedNpcServerSession({
    backend: h.backend(),
    contractId: CONTRACT_ID,
    networkId: "testnet",
    lifeId: life.life_id,
    baseUrl: "https://everfolk.test/api/npc/ranked",
    tokenStorage: tokenStorageB,
    fetcher: h.rpcFetch,
  });
  seedLocalRankedNpcSaveIfMissing({
    life,
    snapshot: connB.snapshot,
    scope: sessionSaveScope({ contractId: CONTRACT_ID, networkId: "testnet", practice: false }),
    storage: deviceBSaveStorage,
  });
  const resumedSessionB = await beginRankedSession({
    contract: h.contract,
    contractId: CONTRACT_ID,
    networkId: "testnet",
    verifyUrl: "https://everfolk.test/api/ranked/verify",
    world: npcWorld,
    storage: deviceBSaveStorage,
  }, life);
  const onlineB = await connectRankedNpcOnline({
    backend: h.backend(),
    rankedSession: resumedSessionB,
    contractId: CONTRACT_ID,
    networkId: "testnet",
    initialConnection: connB,
    baseUrl: "https://everfolk.test/api/npc/ranked",
    tokenStorage: tokenStorageB,
    fetcher: h.rpcFetch,
  });

  // Device A is now disconnected (401)!
  const staleRes = await h.rpcFetch(`https://everfolk.test/api/npc/ranked/sessions/${connAuthA.sessionId}`, {
    headers: { Authorization: `Bearer ${connAuthA.sessionToken}` },
  });
  assert.equal(staleRes.status, 401);

  await playOnlineLife(onlineB);
  assert.equal(onlineB.current().phase, "ended");

  // 6. Tampering with a single NPC decision in save fails /api/ranked/verify with 400.
  const validSave = JSON.parse(resumedSessionB.save()) as SaveFile;
  const tamperedSave: SaveFile = {
    ...validSave,
    commands: validSave.commands.map(cmd => {
      if (cmd.type !== "npc-turn") return cmd;
      const copy = structuredClone(cmd);
      const firstNpc = Object.values(copy.decisions)[0];
      if (firstNpc) firstNpc.speech = "Tampered speech";
      return copy;
    }),
  };
  const tamperedVerifyRes = await h.rpcFetch("https://everfolk.test/api/ranked/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ life_id: life.life_id, save: JSON.stringify(tamperedSave) }),
  });
  assert.equal(tamperedVerifyRes.status, 400);

  // 7. Standalone /npc free-play session remains preview-only and cannot mint or verify rewards.
  const freePlayNpc = createNpcSessionService({
    world: npcWorld,
    store: memoryNpcStore(),
  });
  const createdPreview = await freePlayNpc.start("free-play-seed", null);
  assert.equal(createdPreview.rewards.nftEnabled, false);
  assert.equal(createdPreview.rewards.accountCreditsEnabled, false);

  const freeSaveVerifyRes = await h.rpcFetch("https://everfolk.test/api/ranked/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      life_id: life.life_id,
      save: JSON.stringify({
        schemaVersion: 1,
        worldId: npcWorld.id,
        worldVersion: NPC_WORLD_VERSION,
        worldFingerprint: validSave.worldFingerprint,
        seed: "free-play-seed",
        commands: validSave.commands,
      }),
    }),
  });
  assert.equal(freeSaveVerifyRes.status, 400);

  // 8. Missing or foreign access key is rejected when opening a new life.
  h.advanceClockMs(24 * 60 * 60 * 1000);
  await h.contract.abandonLife(life.life_id);
  h.advanceClockMs(601_000);
  const secondLife = await h.contract.startLife(NPC_WORLD_VERSION);
  h.keyPermissions.delete(`${h.actor.accountId}:${h.actor.publicKey}`);
  const ch2Res = await h.rpcFetch("https://everfolk.test/api/npc/ranked/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contractId: CONTRACT_ID, lifeId: secondLife.life_id }),
  });
  const ch2 = (await ch2Res.json()) as { challenge: string };
  const revokedRes = await h.rpcFetch("https://everfolk.test/api/npc/ranked/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contractId: CONTRACT_ID,
      lifeId: secondLife.life_id,
      challenge: ch2.challenge,
      proof: await h.actor.prove(ch2.challenge),
    }),
  });
  assert.equal(revokedRes.status, 403);

  // Foreign FunctionCall key scoped to another contract is also rejected.
  h.keyPermissions.set(`${h.actor.accountId}:${h.actor.publicKey}`, { FunctionCall: { receiver_id: "other-contract.testnet" } });
  const ch3Res = await h.rpcFetch("https://everfolk.test/api/npc/ranked/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contractId: CONTRACT_ID, lifeId: secondLife.life_id }),
  });
  const ch3 = (await ch3Res.json()) as { challenge: string };
  const foreignKeyRes = await h.rpcFetch("https://everfolk.test/api/npc/ranked/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contractId: CONTRACT_ID,
      lifeId: secondLife.life_id,
      challenge: ch3.challenge,
      proof: await h.actor.prove(ch3.challenge),
    }),
  });
  assert.equal(foreignKeyRes.status, 403);
});
