import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import world from "../worlds/demo/alexandria-lives-7.json" with { type: "json" };
import type { WorldPack } from "../src/types.ts";
import {
  createNpcSimulation,
  observeNpc,
  replayNpcSimulation,
} from "../src/npc/simulation.ts";
import { createNpcSessionService } from "../server/npc/service.ts";
import { memoryNpcStore } from "../server/npc/store.ts";
import { compatibleNpcController } from "../server/npc/controller.ts";
import { configuredNpcService } from "../server/npc/composition.ts";
import {
  layaNpcController,
  LAYA_MODEL,
} from "../server/npc/laya-controller.ts";
import { NpcProviderError } from "../server/npc/provider-status.ts";
const pack = world as unknown as WorldPack;

test("real HTTP provider failures preserve play, block the reward guard and recover after cooldown", async () => {
  let down = false,
    calls = 0,
    now = 100000;
  const server = createServer(async (req, res) => {
    for await (const _ of req) {
    }
    calls++;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify(
        down
          ? ((res.statusCode = 503), { error: "private-provider-diagnostic" })
          : {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      action: "rest",
                      speech: "I need to conserve my strength.",
                    }),
                  },
                },
              ],
            },
      ),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as { port: number };
  try {
    const service = createNpcSessionService({
      world: pack,
      store: memoryNpcStore(),
      now: () => now,
      controller: compatibleNpcController({
        endpoint: `http://127.0.0.1:${address.port}/v1/chat/completions`,
        apiKey: "test-key",
        model: "test",
      }),
    });
    const initial = await service.start("connection-check", "judge");
    await assert.rejects(
      service.requireLiveProviderForRewards(initial.id, "wrong-token"),
    );
    let s = await service.turn(initial.id, initial.token, 0, "up");
    assert.equal(s.npcProvider.status, "live");
    assert.equal(s.rewards.providerEligible, true);
    assert.ok(
      (await service.requireLiveProviderForRewards(s.id, initial.token))
        .checkedAt,
    );
    s = await service.get(s.id, initial.token);
    const before = s.life;
    down = true;
    await assert.rejects(
      service.requireLiveProviderForRewards(s.id, initial.token),
      /credits are disabled/,
    );
    s = await service.get(s.id, initial.token);
    assert.equal(s.npcProvider.status, "fallback");
    assert.equal(s.rewards.providerEligible, false);
    assert.deepEqual(s.life, before);
    const afterFailure = calls;
    s = await service.step(s.id, initial.token, s.revision, "year", {
      type: "advance",
    });
    while (s.life.phase === "choice")
      s = await service.step(
        s.id,
        initial.token,
        s.revision,
        crypto.randomUUID(),
        { type: "choose", choice: s.choices[0].id },
      );
    s = await service.turn(s.id, initial.token, s.revision, "fallback-year");
    assert.equal(calls, afterFailure);
    assert.ok(s.npcTurnDone);
    assert.equal(s.life.age, 1);
    assert.ok(s.events.some((e) => e.text.includes("(fallback)")));
    assert.doesNotMatch(
      JSON.stringify(s),
      /private-provider-diagnostic|test-key/,
    );
    down = false;
    now += 30001;
    assert.equal(
      (await service.get(s.id, initial.token)).npcProvider.status,
      "waiting",
    );
    await service.requireLiveProviderForRewards(s.id, initial.token);
    s = await service.get(s.id, initial.token);
    assert.equal(s.npcProvider.status, "live");
    assert.ok(calls > afterFailure);
    const save = await service.export(s.id, initial.token);
    assert.deepEqual(
      replayNpcSimulation(save.world, save.seed, save.commands).player,
      s.life,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("timeouts, credentials, invalid JSON and rate limits each produce bounded provider status", async () => {
  for (const [status, reason] of [
    [401, "authentication"],
    [429, "rate-limit"],
    [500, "unavailable"],
  ] as const) {
    const service = createNpcSessionService({
      world: pack,
      store: memoryNpcStore(),
      controller: compatibleNpcController({
        endpoint: "https://npc.test/chat",
        apiKey: "private",
        model: "test",
        fetcher: async () => new Response("private", { status }),
      }),
    });
    const s = await service.start(`http-${status}`, "judge"),
      result = await service.checkProvider(s.id, s.token, 0, "check");
    assert.equal(result.npcProvider.reason, reason);
    assert.equal(result.npcProvider.status, "fallback");
  }
  const invalid = createNpcSessionService({
    world: pack,
    store: memoryNpcStore(),
    controller: compatibleNpcController({
      endpoint: "https://npc.test/chat",
      apiKey: "private",
      model: "test",
      fetcher: async () =>
        Response.json({ choices: [{ message: { content: "not JSON" } }] }),
    }),
  });
  const s = await invalid.start("invalid", "judge");
  assert.equal(
    (await invalid.checkProvider(s.id, s.token, 0, "check")).npcProvider.reason,
    "invalid-response",
  );
  const slow = createNpcSessionService({
    world: pack,
    store: memoryNpcStore(),
    decisionTimeoutMs: 20,
    controller: {
      async decide() {
        return new Promise(() => {});
      },
    },
  });
  const t = await slow.start("slow", "judge");
  assert.equal(
    (await slow.checkProvider(t.id, t.token, 0, "check")).npcProvider.reason,
    "timeout",
  );
});

test("bad configuration falls back instead of making the session API unavailable", async () => {
  const memory = memoryNpcStore();
  const db = {
    prepare() {
      throw new Error("No database call should happen while configuring.");
    },
    async batch() {
      return [];
    },
  };
  assert.doesNotThrow(() =>
    configuredNpcService({
      DB: db,
      NPC_LLM_ENDPOINT: "invalid",
      NPC_LLM_KEY: "private",
      NPC_LLM_MODEL: "x",
    }),
  );
  const service = createNpcSessionService({
    world: pack,
    store: memory,
    configurationError: true,
  });
  const s = await service.start("unconfigured", null),
    turn = await service.turn(s.id, s.token, 0, "turn");
  assert.equal(turn.npcProvider.reason, "configuration");
  assert.ok(turn.npcTurnDone);
  await assert.rejects(
    service.requireLiveProviderForRewards(s.id, s.token),
    /credits are disabled/,
  );
});

test("Laya adapter validates the complete choice distribution and serializes resident inference", async () => {
  const state = createNpcSimulation(pack, "laya-schema"),
    obs = observeNpc(state, state.slots["caregiver-a"]);
  let concurrent = 0,
    peak = 0;
  const controller = layaNpcController({
    endpoint: "http://127.0.0.1:8766/v1/systemone",
    fetcher: async (_url, init) => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const request = JSON.parse(String(init!.body));
      assert.equal(request.model, LAYA_MODEL);
      assert.doesNotMatch(request.state, /deathAge|rngState/);
      const keys = Object.keys(request.questions.npc.criteria),
        choice = keys[0];
      concurrent--;
      return Response.json({
        model: LAYA_MODEL,
        answers: {
          npc: {
            type: "choice",
            choice,
            confidence: 0.8,
            probabilities: Object.fromEntries(
              keys.map((k) => [k, k === choice ? 1 : 0]),
            ),
          },
        },
        usage: { input_tokens: 100, output_tokens: 0 },
      });
    },
  });
  const replies = await Promise.all([
    controller.decide(obs, new AbortController().signal),
    controller.decide(obs, new AbortController().signal),
  ]);
  assert.equal(peak, 1);
  assert.equal(replies[0].action, "rest");
  const malformed = layaNpcController({
    endpoint: "http://127.0.0.1:8766/v1/systemone",
    fetcher: async () =>
      Response.json({
        model: LAYA_MODEL,
        answers: {
          npc: {
            type: "choice",
            choice: "mint_nft",
            confidence: 1,
            probabilities: { mint_nft: 1 },
          },
        },
        usage: {},
      }),
  });
  await assert.rejects(
    malformed.decide(obs, new AbortController().signal),
    NpcProviderError,
  );
  assert.throws(
    () => layaNpcController({ endpoint: "http://public.example/v1/systemone" }),
    /HTTPS/,
  );
  assert.throws(
    () =>
      layaNpcController({
        endpoint: "https://private-model.example/v1/systemone",
      }),
    /authentication/,
  );
});

test("a free local provider can serve guests without enabling paid guest calls or real awards", async () => {
  const service = createNpcSessionService({
    world: pack,
    store: memoryNpcStore(),
    allowGuestProvider: true,
    controller: {
      kind: "laya",
      async decide() {
        return { action: "rest", speech: "I will rest." };
      },
    },
  });
  const s = await service.start("guest-laya", null),
    result = await service.turn(s.id, s.token, 0, "turn");
  assert.equal(result.npcProvider.status, "live");
  assert.equal(result.providerName, "Laya");
  assert.ok(result.events.some((e) => e.text.includes("(laya)")));
  assert.equal(result.rewards.nftEnabled, false);
  assert.equal(result.rewards.accountCreditsEnabled, false);
});

test("GPT reasoning models use the supported completion budget without temperature", async () => {
  const state = createNpcSimulation(pack, "nano"),
    obs = observeNpc(state, state.slots["caregiver-a"]);
  let body: any;
  const controller = compatibleNpcController({
    endpoint: "https://api.openai.com/v1/chat/completions",
    apiKey: "private",
    model: "gpt-5.4-nano",
    fetcher: async (_url, init) => {
      body = JSON.parse(String(init!.body));
      return Response.json({
        choices: [
          { message: { content: '{"action":"rest","speech":"I will rest."}' } },
        ],
      });
    },
  });
  await controller.decide(obs, new AbortController().signal);
  assert.equal(body.max_completion_tokens, 220);
  assert.equal(body.max_tokens, undefined);
  assert.equal(body.temperature, undefined);
});
