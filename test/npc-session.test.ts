import assert from "node:assert/strict";
import test from "node:test";
import { createEngine } from "../src/engine.ts";
import type { WorldPack } from "../src/types.ts";
import world from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import legacyWorld from "../worlds/demo/alexandria-lives-2.json" with { type: "json" };
import {
  createNpcSimulation,
  stepNpcSimulation,
  replayNpcSimulation,
  availableNpcActions,
  observeNpc,
  resources,
} from "../src/npc/simulation.ts";
import { createNpcSessionService, NpcError } from "../server/npc/service.ts";
import { memoryNpcStore } from "../server/npc/store.ts";
import { npcMcpRoute } from "../server/npc/mcp.ts";
import { npcRoute } from "../server/npc/http.ts";
import { compatibleNpcController } from "../server/npc/controller.ts";
const pack = world as unknown as WorldPack;
function fixture(base: WorldPack = pack) {
  const w = structuredClone(base);
  for (const e of w.events) {
    e.when = { type: "age", op: "gte", value: 1000 };
    e.maxOccurrences = 1;
  }
  delete w.eventPacing;
  delete w.character!.encounterPacing;
  for (const b of w.mortality!.bands) b.annualProbability = 0;
  for (const b of w.health!.incidenceBands) b.annualProbability = 0;
  for (const b of w.health!.declineBands) b.healthLoss = 0;
  delete w.health!.mortalityCalibration;
  w.stats.health.initial = 100;
  delete w.stats.health.initialRange;
  w.yearlyRules = [];
  w.yearlyEffects = [];
  return w;
}
const money = (s: ReturnType<typeof createNpcSimulation>) =>
  s.player.economy!.cash +
  Object.values(s.player.vocations!.accounts).reduce((a, b) => a + b, 0) +
  s.player.demo!.town.merchant.cash +
  Object.values(s.people).reduce((sum, n) => sum + n.cash, 0);
function age12(w: WorldPack) {
  const engine = createEngine(w);
  let s = createNpcSimulation(w, "npc-fixed");
  while (s.player.age < 12) {
    s = stepNpcSimulation(engine, s, { type: "resolve", decisions: {} });
    s = stepNpcSimulation(engine, s, {
      type: "player",
      command: { type: "advance" },
    });
  }
  return s;
}

test("five slots share one household/shop, endowments conserve cash and observations hide future state", () => {
  const w = fixture(),
    engine = createEngine(w),
    life = engine.start("cast"),
    s = createNpcSimulation(w, "cast");
  assert.equal(Object.keys(s.slots).length, 5);
  assert.equal(s.people[s.slots["caregiver-a"]].id, "family-mother");
  assert.equal(s.people[s.slots["caregiver-a"]].cash, 0);
  assert.equal(
    resources(s, s.people[s.slots.merchant]).cash,
    s.player.demo!.town.merchant.cash,
  );
  const baseline =
    life.economy!.cash +
    Object.values(life.vocations!.accounts).reduce((a, b) => a + b, 0) +
    life.demo!.town.merchant.cash;
  assert.equal(money(s), baseline);
  const observation = JSON.stringify(observeNpc(s, s.slots["caregiver-a"]));
  assert.doesNotMatch(observation, /deathAge|rngState|schedule|ownerHash/);
  assert.equal(s.people[s.slots.mentor].introduced, false);
});

test("accepted decisions and all NPC/player state replay exactly without mutating inputs", () => {
  const w = fixture(),
    before = createNpcSimulation(w, "history"),
    s = age12(w);
  assert.equal(before.commands.length, 0);
  assert.deepEqual(replayNpcSimulation(w, s.seed, s.commands), s);
  const engine = createEngine(w),
    npcId = s.slots.mentor,
    beforeMoney = money(s);
  const next = stepNpcSimulation(engine, s, {
    type: "resolve",
    decisions: {
      [npcId]: {
        action: "offer-lesson",
        speech: "A lesson is available.",
        source: "external",
      },
    },
  });
  assert.equal(money(next), beforeMoney);
  const offer = next.offers.find((o) => o.npcId === npcId)!;
  assert.ok(offer);
  const funded = structuredClone(next);
  funded.player.economy!.cash = 100; // Isolate acceptance accounting.
  const paid = stepNpcSimulation(engine, funded, {
    type: "answer",
    offerId: offer.id,
    accept: true,
  });
  assert.equal(money(paid), money(funded));
  assert.equal(
    paid.player.character!.skills.literacy,
    funded.player.character!.skills.literacy + 2,
  );
  assert.throws(
    () =>
      stepNpcSimulation(engine, paid, {
        type: "answer",
        offerId: offer.id,
        accept: true,
      }),
    /expired/,
  );
  assert.equal(next.people[npcId].workedAge, 12);
  assert.equal(s.people[npcId].workedAge, 11);
});

test("household grain offers wait until adulthood while lessons remain available at age 12", () => {
  const w = fixture();
  for (const origin of w.origins) origin.statRanges = { ...origin.statRanges, wealth: { min: 100, max: 100 } };
  const engine = createEngine(w);
  let state = age12(w);
  const mentor = state.slots.mentor;
  state = stepNpcSimulation(engine, state, { type: "resolve", decisions: {
    [mentor]: { action: "offer-lesson", speech: "A lesson is available.", source: "external" },
  } });
  const childGrain = state.offers.find(offer => offer.kind === "grain" && offer.expiresAge === 13)!;
  assert.ok(childGrain);
  assert.ok(state.player.economy!.cash >= childGrain.price, "Authority is the blocker, not affordability.");
  const snapshot = structuredClone(state);
  assert.throws(() => stepNpcSimulation(engine, state, { type: "answer", offerId: childGrain.id, accept: true }), /household still decides shared purchases/);
  assert.deepEqual(state, snapshot, "Rejected acceptance cannot spend cash, move stock or consume the offer.");
  const lesson = state.offers.find(offer => offer.kind === "lesson" && offer.npcId === mentor)!;
  assert.ok(lesson);
  const beforeLiteracy = state.player.character!.skills.literacy;
  state = stepNpcSimulation(engine, state, { type: "answer", offerId: lesson.id, accept: true });
  assert.equal(state.player.character!.skills.literacy, Math.min(100, beforeLiteracy + 2));
  assert.equal(state.player.character!.lastActivityAge, 12);
  while (state.player.age < 16) {
    if (state.lastResolvedAge !== state.player.age) state = stepNpcSimulation(engine, state, { type: "resolve", decisions: {} });
    state = stepNpcSimulation(engine, state, { type: "player", command: { type: "advance" } });
  }
  state = stepNpcSimulation(engine, state, { type: "resolve", decisions: {} });
  const adultGrain = state.offers.find(offer => offer.kind === "grain" && offer.expiresAge === 17)!;
  assert.ok(adultGrain);
  const before = structuredClone(state.player);
  state = stepNpcSimulation(engine, state, { type: "answer", offerId: adultGrain.id, accept: true });
  assert.equal(state.player.economy!.cash, before.economy!.cash - adultGrain.price);
  assert.equal(state.player.demo!.household.grain, before.demo!.household.grain + adultGrain.quantity);
  assert.equal(state.player.demo!.town.merchant.cash, before.demo!.town.merchant.cash + adultGrain.price);
  assert.equal(state.player.demo!.town.merchant.grain, before.demo!.town.merchant.grain - adultGrain.quantity);
  assert.deepEqual(replayNpcSimulation(w, state.seed, state.commands), state);
});

test("worlds without life stages keep age-12 NPC grain acceptance", () => {
  const w = fixture(legacyWorld as unknown as WorldPack);
  for (const origin of w.origins) origin.statRanges = { ...origin.statRanges, wealth: { min: 100, max: 100 } };
  assert.equal(w.lifeStages, undefined);
  const engine = createEngine(w);
  let state = age12(w);
  state = stepNpcSimulation(engine, state, { type: "resolve", decisions: {} });
  const offer = state.offers.find(offer => offer.kind === "grain" && offer.expiresAge === 13)!;
  assert.ok(offer);
  const cash = state.player.economy!.cash, grain = state.player.demo!.household.grain;
  state = stepNpcSimulation(engine, state, { type: "answer", offerId: offer.id, accept: true });
  assert.equal(state.player.economy!.cash, cash - offer.price);
  assert.equal(state.player.demo!.household.grain, grain + offer.quantity);
  assert.deepEqual(replayNpcSimulation(w, state.seed, state.commands), state);
});

test("caregiver authority ends at adulthood and world conditions affect NPC health", () => {
  const w = fixture(),
    engine = createEngine(w);
  let s = age12(w);
  const altered = structuredClone(s);
  altered.player.age = 16;
  assert.ok(
    !availableNpcActions(altered, altered.slots["caregiver-a"]).some(
      (a) => a.id === "buy-food",
    ),
  );
  const low = structuredClone(s),
    normal = structuredClone(s);
  low.player.demo!.year.flood = "low";
  normal.player.demo!.year.flood = "normal";
  const step = (input: typeof s) =>
    stepNpcSimulation(
      engine,
      stepNpcSimulation(engine, input, { type: "resolve", decisions: {} }),
      { type: "player", command: { type: "advance" } },
    );
  assert.ok(
    step(low).people[s.slots.peer].health <
      step(normal).people[s.slots.peer].health,
  );
});

test("dead people remain in history and a fresh person fills the core slot", () => {
  const w = fixture(),
    engine = createEngine(w),
    s = structuredClone(age12(w)),
    id = s.slots.peer;
  s.people[id].health = 1;
  s.people[id].cash = 0;
  const next = stepNpcSimulation(
    engine,
    stepNpcSimulation(engine, s, {
      type: "resolve",
      decisions: { [id]: { action: "train", speech: "", source: "external" } },
    }),
    { type: "player", command: { type: "advance" } },
  );
  assert.equal(next.people[id].status, "dead");
  assert.notEqual(next.slots.peer, id);
  assert.equal(Object.values(next.slots).length, 5);
  assert.ok(next.events.some((e) => e.actor === id && e.kind === "departure"));
});

test("revision checks, retry keys, scoped leases and revocation protect sessions", async () => {
  const service = createNpcSessionService({
      world: fixture(),
      store: memoryNpcStore(),
    }),
    a = await service.start("a", null),
    b = await service.start("b", null);
  await assert.rejects(service.get(a.id, b.token), /cannot control/);
  const lease = await service.lease(
    a.id,
    a.token,
    0,
    "lease-1",
    a.slots["caregiver-a"],
  );
  assert.ok("npcToken" in lease);
  const observed = await service.observe(a.id, lease.npcToken!);
  assert.equal(observed.observation.actor.id, a.slots["caregiver-a"]);
  await assert.rejects(
    service.observe(b.id, lease.npcToken!),
    /expired|revoked/,
  );
  const input = { action: "rest", speech: "I will wait." };
  const result = await service.propose(
    a.id,
    lease.npcToken!,
    observed.revision,
    "npc-1",
    input,
  );
  const retry = await service.propose(
    a.id,
    lease.npcToken!,
    observed.revision,
    "npc-1",
    input,
  );
  assert.equal(result.revision, retry.revision);
  await assert.rejects(
    service.propose(a.id, lease.npcToken!, 0, "stale", input),
    /Stale/,
  );
  const finished = await service.turn(a.id, a.token, result.revision, "turn-1");
  const again = await service.turn(a.id, a.token, result.revision, "turn-1");
  assert.equal(again.revision, finished.revision);
  const revoked = await service.lease(
    a.id,
    a.token,
    finished.revision,
    "revoke-1",
    a.slots["caregiver-a"],
    true,
  );
  await assert.rejects(service.observe(a.id, lease.npcToken!), /revoked/);
  const saved = await service.export(a.id, a.token),
    replayed = await service.verifyExport(saved);
  assert.deepEqual(replayed.player, revoked.life);
});

test("timeouts fall back once, guest sessions cannot incur model calls and retries do not call again", async () => {
  let calls = 0;
  const service = createNpcSessionService({
    world: fixture(),
    store: memoryNpcStore(),
    decisionTimeoutMs: 20,
    controller: {
      async decide() {
        calls++;
        return new Promise(() => {});
      },
    },
  });
  const guest = await service.start("guest", null);
  await service.turn(guest.id, guest.token, 0, "gturn");
  assert.equal(calls, 0);
  const live = await service.start("live", "trusted-user");
  const result = await service.turn(live.id, live.token, 0, "turn");
  assert.equal(calls, 2);
  assert.ok(result.events.some((e) => e.text.includes("fallback")));
  await service.turn(live.id, live.token, 0, "turn");
  assert.equal(calls, 2);
});

test("MCP initialization, legal tool calls and errors stay inside the leased actor", async () => {
  const service = createNpcSessionService({
      world: fixture(),
      store: memoryNpcStore(),
    }),
    s = await service.start("mcp", null),
    lease = await service.lease(
      s.id,
      s.token,
      0,
      "issue",
      s.slots["caregiver-a"],
    );
  const call = async (
    method: string,
    params?: unknown,
    token = lease.npcToken!,
    origin = "https://game.test",
  ) =>
    npcMcpRoute(
      new Request(`https://game.test/api/npc/mcp?session=${s.id}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          origin,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method,
          ...(params ? { params } : {}),
        }),
      }),
      service,
    );
  const init = await call("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  assert.equal(init.status, 200);
  assert.equal(
    ((await init.json()) as any).result.serverInfo.name,
    "everfolk-npc",
  );
  const tools = (await (await call("tools/list")).json()) as any;
  assert.equal(tools.result.tools.length, 4);
  const observation = (await (
    await call("tools/call", { name: "npc_observe", arguments: {} })
  ).json()) as any;
  assert.doesNotMatch(
    JSON.stringify(observation),
    /rngState|deathAge|ownerHash/,
  );
  const denied = await call("tools/list", undefined, s.token);
  assert.equal(denied.status, 403);
  const foreign = await call(
    "tools/list",
    undefined,
    lease.npcToken!,
    "https://evil.test",
  );
  assert.equal(foreign.status, 403);
  const unknown = (await (
    await call("tools/call", { name: "mint_nft", arguments: {} })
  ).json()) as any;
  assert.equal(unknown.result.isError, true);
});

test("HTTP routes reject unauthenticated control, oversized and extra-field requests", async () => {
  const service = createNpcSessionService({
    world: fixture(),
    store: memoryNpcStore(),
  });
  const create = await npcRoute(
    new Request("https://game.test/api/npc/sessions", {
      method: "POST",
      headers: {
        origin: "https://game.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ seed: "http" }),
    }),
    service,
    null,
  );
  assert.equal(create.status, 201);
  const s = (await create.json()) as any;
  assert.equal(
    (
      await npcRoute(
        new Request(`https://game.test/api/npc/sessions/${s.id}`),
        service,
        null,
      )
    ).status,
    401,
  );
  const over = await npcRoute(
    new Request("https://game.test/api/npc/sessions", {
      method: "POST",
      headers: {
        origin: "https://game.test",
        "content-type": "application/json",
      },
      body: JSON.stringify({ seed: "x".repeat(17000) }),
    }),
    service,
    null,
  );
  assert.equal(over.status, 413);
});

test("compatible provider validates schemas, action legality, timeout signal and secret boundaries", async () => {
  const s = createNpcSimulation(fixture(), "llm"),
    observation = observeNpc(s, s.slots["caregiver-a"]);
  let requestBody = "";
  const controller = compatibleNpcController({
    endpoint: "https://model.test/v1/chat/completions",
    apiKey: "test-secret",
    model: "configured-model",
    fetcher: async (_url, init) => {
      requestBody = String(init!.body);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                action: "rest",
                speech: "I must conserve our resources.",
              }),
            },
          },
        ],
      });
    },
  });
  const result = await controller.decide(
    observation,
    new AbortController().signal,
  );
  assert.equal(result.action, "rest");
  assert.doesNotMatch(requestBody, /test-secret|deathAge|rngState/);
  const bad = compatibleNpcController({
    endpoint: "https://model.test/chat",
    apiKey: "test-secret",
    model: "m",
    fetcher: async () =>
      Response.json({
        choices: [{ message: { content: '{"action":"mint","speech":"No"}' } }],
      }),
  });
  await assert.rejects(
    bad.decide(observation, new AbortController().signal),
    /unavailable/,
  );
  assert.throws(
    () =>
      compatibleNpcController({
        endpoint: "http://public.example/chat",
        apiKey: "x",
        model: "m",
      }),
    /HTTPS/,
  );
});

test("daily model budget spans sessions and concurrent turns cannot duplicate decisions", async () => {
  let calls = 0,
    release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const store = memoryNpcStore(),
    service = createNpcSessionService({
      world: fixture(),
      store,
      dailyModelCalls: 2,
      controller: {
        async decide() {
          calls++;
          await held;
          return { action: "rest", speech: "I will rest." };
        },
      },
    });
  const a = await service.start("budget-a", "same-owner"),
    b = await service.start("budget-b", "same-owner");
  const pending = service.turn(a.id, a.token, 0, "one");
  while (calls < 2) await new Promise((resolve) => setTimeout(resolve, 1));
  const locked = await service.get(a.id, a.token);
  await assert.rejects(
    service.turn(a.id, a.token, locked.revision, "overlap"),
    /already running/,
  );
  await assert.rejects(
    service.answer(a.id, a.token, locked.revision, "answer", "missing", true),
    /turn/,
  );
  release();
  const result = await pending;
  assert.equal(calls, 2);
  assert.equal(result.modelCalls, 2);
  const other = await service.turn(b.id, b.token, 0, "two");
  assert.equal(calls, 2);
  assert.equal(other.modelCalls, 0);
  assert.ok(other.events.some((e) => e.text.includes("fallback")));
});

test("expired leases cannot act; missing external decisions use rules without waiting", async () => {
  let now = 0;
  const service = createNpcSessionService({
    world: fixture(),
    store: memoryNpcStore(),
    now: () => now,
  });
  const s = await service.start("expiry", null),
    lease = await service.lease(
      s.id,
      s.token,
      0,
      "lease",
      s.slots["caregiver-a"],
    );
  const result = await service.turn(s.id, s.token, lease.revision, "missing");
  assert.ok(result.events.some((e) => e.text.includes("fallback")));
  now = 600001;
  await assert.rejects(service.observe(s.id, lease.npcToken!), /expired/);
});

test("malformed requests and protocol notifications do not leak internals", async () => {
  const service = createNpcSessionService({
    world: fixture(),
    store: memoryNpcStore(),
  });
  const request = (body: string) =>
    new Request("https://game.test/api/npc/sessions", {
      method: "POST",
      headers: {
        origin: "https://game.test",
        "content-type": "application/json",
      },
      body,
    });
  assert.equal((await npcRoute(request("{"), service, null)).status, 400);
  assert.equal(
    (await npcRoute(request('{"seed":"a","ownerId":"forged"}'), service, null))
      .status,
    422,
  );
  assert.equal(
    (
      await npcRoute(
        new Request("https://game.test/api/npc/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"seed":"a"}',
        }),
        service,
        null,
      )
    ).status,
    403,
  );
  const s = await service.start("notify", null),
    lease = await service.lease(
      s.id,
      s.token,
      0,
      "lease",
      s.slots["caregiver-a"],
    );
  const response = await npcMcpRoute(
    new Request(`https://game.test/api/npc/mcp?session=${s.id}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${lease.npcToken}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    }),
    service,
  );
  assert.equal(response.status, 202);
  assert.equal(await response.text(), "");
});

test("stored world revisions keep existing sessions replayable after a content update", async () => {
  const store = memoryNpcStore(),
    oldWorld = fixture(),
    before = createNpcSessionService({ world: oldWorld, store }),
    s = await before.start("versioned", null);
  const changed = fixture();
  changed.stats.health.initial = 99;
  const after = createNpcSessionService({ world: changed, store });
  const turn = await after.turn(s.id, s.token, 0, "old-turn");
  assert.equal(turn.life.stats.health, s.life.stats.health);
  const saved = await after.export(s.id, s.token),
    replayed = await after.verifyExport(saved);
  assert.deepEqual(replayed.player, turn.life);
  assert.equal(saved.world.stats.health.initial, 100);
});

test("live dialogue still works after the annual action and its recorded reply replays", async () => {
  const service = createNpcSessionService({
    world: fixture(),
    store: memoryNpcStore(),
    controller: {
      async decide(observation, _signal, message) {
        assert.ok(observation.actions.some((a) => a.id === "rest"));
        return {
          action: "rest",
          speech: message ? "I have finished my work." : "I will rest.",
        };
      },
    },
  });
  const s = await service.start("after-turn-dialogue", "trusted");
  const turn = await service.turn(s.id, s.token, 0, "turn");
  const spoken = await service.speak(
    s.id,
    s.token,
    turn.revision,
    "speak",
    s.slots["caregiver-a"],
    "How was your work?",
  );
  assert.equal(spoken.modelCalls, turn.modelCalls + 1);
  assert.deepEqual(spoken.life, turn.life);
  assert.ok(spoken.events.some((e) => e.text === "I have finished my work."));
  const saved = await service.export(s.id, s.token),
    replayed = await service.verifyExport(saved);
  assert.deepEqual(replayed.events, spoken.events);
});
