import { createEngine } from "../../src/engine.ts";
import type { WorldPack } from "../../src/types.ts";
import {
  createNpcSimulation,
  availableNpcActions,
  observeNpc,
  replayNpcSimulation,
  rulesDecision,
  stepNpcSimulation,
} from "../../src/npc/simulation.ts";
import {
  NpcInputError,
  decision,
  integer,
  object,
  playerCommand,
  text,
} from "../../src/npc/validation.ts";
import type { NpcDecision, NpcObservation } from "../../src/npc/types.ts";
import type { NpcController } from "./controller.ts";
import type { NpcSessionStore, SessionRecord } from "./store.ts";
export class NpcError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
const secret = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
export function createNpcSessionService(options: {
  world: WorldPack;
  store: NpcSessionStore;
  controller?: NpcController;
  now?: () => number;
  maxModelCalls?: number;
  decisionTimeoutMs?: number;
  dailyModelCalls?: number;
}) {
  const engine = createEngine(options.world),
    store = options.store,
    now = options.now ?? Date.now;
  const maxCalls = Math.min(200, Math.max(0, options.maxModelCalls ?? 100)),
    timeout = Math.min(10000, Math.max(20, options.decisionTimeoutMs ?? 4000));
  const worlds = new Map([[engine.fingerprint, engine]]);
  const recordEngine = (record: SessionRecord) =>
    worlds.get(record.worldFingerprint)!;
  const dailyLimit = Math.min(
    1000,
    Math.max(0, options.dailyModelCalls ?? 200),
  );
  async function budget(record: SessionRecord, count: number) {
    if (!count || !record.ownerId) return false;
    const day = new Date(now()).toISOString().slice(0, 10);
    return store.reserveUsage(
      `model:${day}:${await hash(record.ownerId)}`,
      count,
      dailyLimit,
    );
  }
  function snapshot(record: SessionRecord) {
    const engine = recordEngine(record);
    return {
      id: record.id,
      revision: record.revision,
      mode: "npc-free-play" as const,
      controller:
        options.controller && record.ownerId
          ? "model-with-rules-fallback"
          : "rules",
      modelCalls: record.llmAttempts,
      modelCallLimit: maxCalls,
      life: record.state.player,
      people: record.state.people,
      slots: record.state.slots,
      offers: record.state.offers,
      events: record.state.events.slice(-100),
      choices: engine.getChoices(record.state.player),
      activities: engine
        .getActivities(record.state.player)
        .filter((a) => a.available)
        .slice(0, 60),
      npcTurnDone: record.state.lastResolvedAge === record.state.player.age,
      externalControllers: Object.fromEntries(
        Object.entries(record.leases)
          .filter(([, l]) => l.expires > now())
          .map(([id, l]) => [id, { expires: l.expires }]),
      ),
    };
  }
  async function read(id: string) {
    text(id, 100);
    const record = await store.read(id);
    if (!record) throw new NpcError(404, "NPC session not found.");
    if (!worlds.has(record.worldFingerprint)) {
      const world = await store.readWorld(record.worldFingerprint);
      if (!world)
        throw new NpcError(
          409,
          "This session needs its original world revision.",
        );
      const restored = createEngine(world);
      if (restored.fingerprint !== record.worldFingerprint)
        throw new NpcError(409, "Stored world revision could not be verified.");
      worlds.set(record.worldFingerprint, restored);
    }
    return record;
  }
  async function owner(id: string, token: string) {
    const record = await read(id);
    if ((await hash(text(token, 200))) !== record.ownerHash)
      throw new NpcError(403, "This token cannot control the session.");
    return record;
  }
  async function external(id: string, token: string) {
    const record = await read(id),
      digest = await hash(text(token, 200));
    const entry = Object.entries(record.leases).find(
      ([, lease]) => lease.hash === digest && lease.expires > now(),
    );
    if (!entry || !Object.values(record.state.slots).includes(entry[0]))
      throw new NpcError(403, "NPC control has expired or was revoked.");
    return { record, npcId: entry[0] };
  }
  async function commit(record: SessionRecord, expected: number) {
    if (new TextEncoder().encode(JSON.stringify(record)).length > 1500000)
      throw new NpcError(
        413,
        "This session reached its storage limit. Export its replay before starting another life.",
      );
    record.revision = expected + 1;
    if (!(await store.compareAndSwap(expected, record)))
      throw new NpcError(
        409,
        "The session changed. Read its latest revision before retrying.",
      );
    return snapshot(record);
  }
  function request(
    record: SessionRecord,
    revision: number,
    key: string,
    input: unknown,
  ) {
    integer(revision);
    text(key, 128);
    const encoded = JSON.stringify(input);
    const old = record.receipts[key];
    if (old) {
      if (old.request !== encoded)
        throw new NpcError(
          409,
          "This idempotency key was used for different input.",
        );
      return true;
    }
    if (record.revision !== revision)
      throw new NpcError(
        409,
        "Stale session revision. Read the latest session.",
      );
    if (Object.keys(record.receipts).length >= 10000)
      throw new NpcError(409, "Session request limit reached.");
    return false;
  }
  function receipt(record: SessionRecord, key: string, input: unknown) {
    record.receipts[key] = {
      request: JSON.stringify(input),
      revision: record.revision + 1,
    };
  }
  async function model(
    record: SessionRecord,
    observation: NpcObservation,
    message?: string,
  ): Promise<{ action: NpcDecision["action"]; speech: string } | null> {
    if (!options.controller || !record.ownerId) return null;
    // Conversation may continue after the year's action is spent. Its reply has no game effect.
    const permitted: NpcObservation = message
      ? {
          ...observation,
          actions: [
            {
              id: "rest",
              label: "Reply in conversation",
              cost: "Dialogue only; changes no resources or annual actions.",
            },
          ],
        }
      : observation;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        options.controller.decide(permitted, abort.signal, message),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            abort.abort();
            reject(new Error("NPC timeout"));
          }, timeout);
        }),
      ]);
      const clean = object(result, ["action", "speech"]);
      if (!permitted.actions.some((a) => a.id === clean.action)) return null;
      return {
        action: clean.action as NpcDecision["action"],
        speech: text(clean.speech, 500),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      abort.abort();
    }
  }
  return {
    async start(
      seed: string,
      ownerId: string | null,
      guestIdentity = "anonymous",
    ) {
      text(seed, 256);
      const day = new Date(now()).toISOString().slice(0, 10);
      if (
        !(await store.reserveUsage(
          `create:${day}:${await hash(ownerId ?? guestIdentity)}`,
          1,
          20,
        ))
      )
        throw new NpcError(
          429,
          "Daily NPC session creation limit reached. Continue an existing life.",
        );
      await store.saveWorld(engine.fingerprint, engine.world);
      const id = crypto.randomUUID(),
        token = secret();
      const record: SessionRecord = {
        id,
        ownerHash: await hash(token),
        ownerId,
        revision: 0,
        worldFingerprint: engine.fingerprint,
        state: createNpcSimulation(engine.world, seed),
        leases: {},
        proposals: {},
        receipts: {},
        llmAttempts: 0,
        turnLock: null,
      };
      if (!(await store.create(record)))
        throw new NpcError(409, "Session could not be created.");
      return { ...snapshot(record), token };
    },
    async get(id: string, token: string) {
      return snapshot(await owner(id, token));
    },
    async step(
      id: string,
      token: string,
      revision: number,
      key: string,
      raw: unknown,
    ) {
      const record = await owner(id, token),
        command = playerCommand(raw),
        input = { op: "step", command };
      if (request(record, revision, key, input)) return snapshot(record);
      if (record.turnLock && record.turnLock.until > now())
        throw new NpcError(409, "An NPC turn is still being resolved.");
      record.state = stepNpcSimulation(recordEngine(record), record.state, {
        type: "player",
        command,
      });
      receipt(record, key, input);
      return commit(record, revision);
    },
    async answer(
      id: string,
      token: string,
      revision: number,
      key: string,
      offerId: string,
      accept: boolean,
    ) {
      const record = await owner(id, token),
        input = { op: "answer", offerId, accept };
      if (request(record, revision, key, input)) return snapshot(record);
      if (record.turnLock && record.turnLock.until > now())
        throw new NpcError(409, "Wait for the NPC turn to finish.");
      record.state = stepNpcSimulation(recordEngine(record), record.state, {
        type: "answer",
        offerId,
        accept,
      });
      receipt(record, key, input);
      return commit(record, revision);
    },
    async turn(id: string, token: string, revision: number, key: string) {
      let record = await owner(id, token);
      const input = { op: "turn" };
      if (request(record, revision, key, input)) return snapshot(record);
      if (record.turnLock && record.turnLock.until > now())
        throw new NpcError(409, "An NPC turn is already running.");
      if (
        record.state.lastResolvedAge === record.state.player.age ||
        record.state.player.phase !== "ready"
      )
        throw new NpcError(
          409,
          "Resolve the current choice or advance to the next year.",
        );
      const active = Object.values(record.state.slots).filter(
        (id) => availableNpcActions(record.state, id).length,
      );
      let calls =
        options.controller && record.ownerId
          ? active
              .filter(
                (id) =>
                  !(record.leases[id]?.expires > now()) &&
                  record.llmAttempts < maxCalls,
              )
              .slice(0, maxCalls - record.llmAttempts)
          : [];
      if (calls.length && !(await budget(record, calls.length))) calls = [];
      const lockKey = secret();
      record.turnLock = { key: lockKey, until: now() + timeout + 2000 };
      record.llmAttempts += calls.length;
      await commit(record, revision);
      const decisions = Object.fromEntries(
        await Promise.all(
          active.map(async (npcId) => {
            const pending = record.proposals[npcId];
            if (pending?.age === record.state.player.age)
              return [npcId, pending.decision];
            if (record.leases[npcId]?.expires > now())
              return [npcId, rulesDecision(record.state, npcId, "fallback")];
            const result = calls.includes(npcId)
              ? await model(record, observeNpc(record.state, npcId))
              : null;
            return [
              npcId,
              result
                ? decision({ ...result, source: "llm" })
                : rulesDecision(
                    record.state,
                    npcId,
                    options.controller ? "fallback" : "rules",
                  ),
            ];
          }),
        ),
      );
      record = await owner(id, token);
      if (record.turnLock?.key !== lockKey || record.turnLock.until < now())
        throw new NpcError(
          409,
          "This NPC turn expired. Retry with the latest revision.",
        );
      const before = record.revision;
      record.state = stepNpcSimulation(recordEngine(record), record.state, {
        type: "resolve",
        decisions,
      });
      record.turnLock = null;
      record.proposals = {};
      receipt(record, key, input);
      return commit(record, before);
    },
    async speak(
      id: string,
      token: string,
      revision: number,
      key: string,
      npcId: string,
      message: string,
    ) {
      const record = await owner(id, token),
        input = { op: "speak", npcId, message: text(message, 500) };
      if (request(record, revision, key, input)) return snapshot(record);
      if (record.turnLock && record.turnLock.until > now())
        throw new NpcError(409, "Wait for the NPC turn to finish.");
      if (record.state.player.phase === "ended")
        throw new NpcError(409, "This life has ended.");
      const observation = observeNpc(record.state, npcId);
      if (!record.state.people[npcId].introduced)
        throw new NpcError(409, "You have not met this person.");
      if (record.leases[npcId]?.expires > now())
        throw new NpcError(409, "An external agent controls this NPC.");
      if (
        record.state.events.filter(
          (e) =>
            e.age === record.state.player.age &&
            e.actor === "player" &&
            e.kind === "speech",
        ).length >= 5
      )
        throw new NpcError(429, "Conversation limit reached for this year.");
      let use = Boolean(
        options.controller && record.ownerId && record.llmAttempts < maxCalls,
      );
      if (use && !(await budget(record, 1))) use = false;
      if (use) record.llmAttempts++;
      record.turnLock = { key, until: now() + timeout + 2000 };
      await commit(record, revision);
      const response = use ? await model(record, observation, message) : null;
      const latest = await owner(id, token);
      if (latest.turnLock?.key !== key || latest.turnLock.until < now())
        throw new NpcError(409, "Conversation expired.");
      const before = latest.revision;
      latest.state = stepNpcSimulation(recordEngine(latest), latest.state, {
        type: "speak",
        npcId,
        text: message,
        reply:
          response?.speech ??
          `I am concerned with my own household and work. ${observation.actor.goal}`,
      });
      latest.turnLock = null;
      receipt(latest, key, input);
      return commit(latest, before);
    },
    async lease(
      id: string,
      token: string,
      revision: number,
      key: string,
      npcId: string,
      revoke = false,
    ) {
      const record = await owner(id, token),
        input = { op: "lease", npcId, revoke };
      if (request(record, revision, key, input)) {
        if (revoke) return snapshot(record);
        throw new NpcError(
          409,
          "A lease token is shown only once. Revoke it and issue another if it was lost.",
        );
      }
      observeNpc(record.state, npcId);
      if (record.turnLock && record.turnLock.until > now())
        throw new NpcError(409, "Wait for the active NPC turn.");
      const leaseToken = secret();
      if (revoke) {
        delete record.leases[npcId];
        delete record.proposals[npcId];
      } else
        record.leases[npcId] = {
          hash: await hash(leaseToken),
          expires: now() + 10 * 60 * 1000,
        };
      receipt(record, key, input);
      const result = await commit(record, revision);
      return { ...result, ...(!revoke ? { npcToken: leaseToken } : {}) };
    },
    async observe(id: string, token: string) {
      const { record, npcId } = await external(id, token);
      return {
        revision: record.revision,
        decisionAge: record.state.player.age,
        observation: observeNpc(record.state, npcId),
      };
    },
    async propose(
      id: string,
      token: string,
      revision: number,
      key: string,
      value: unknown,
    ) {
      const { record, npcId } = await external(id, token);
      const v = object(value, ["action", "speech"]);
      const proposed = decision({ ...v, source: "external" }),
        input = { op: "propose", npcId, decision: proposed };
      if (request(record, revision, key, input))
        return { revision: record.revision, queued: true };
      if (record.turnLock && record.turnLock.until > now())
        throw new NpcError(
          409,
          "The turn is resolving; submit during the next decision window.",
        );
      if (
        !availableNpcActions(record.state, npcId).some(
          (a) => a.id === proposed.action,
        )
      )
        throw new NpcError(409, "That action is unavailable.");
      if (record.proposals[npcId]?.age === record.state.player.age)
        throw new NpcError(409, "This NPC already submitted this year.");
      record.proposals[npcId] = {
        age: record.state.player.age,
        decision: proposed,
      };
      receipt(record, key, input);
      await commit(record, revision);
      return { revision: revision + 1, queued: true };
    },
    async export(id: string, token: string) {
      const record = await owner(id, token);
      return {
        format: "everfolk-npc-session",
        version: 1,
        world: recordEngine(record).world,
        seed: record.state.seed,
        commands: record.state.commands,
      };
    },
    async verifyExport(value: unknown) {
      const v = object(value, [
        "format",
        "version",
        "world",
        "seed",
        "commands",
      ]);
      if (v.format !== "everfolk-npc-session" || v.version !== 1)
        throw new NpcInputError("Unknown NPC export format.");
      const savedEngine = createEngine(v.world);
      return replayNpcSimulation(
        savedEngine.world,
        text(v.seed, 256),
        v.commands as never,
      );
    },
  };
}
export type NpcSessionService = ReturnType<typeof createNpcSessionService>;
