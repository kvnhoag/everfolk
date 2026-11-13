import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { useNpcSession } from "../client/hooks/useNpcSession.ts";
import type { NpcSnapshot } from "../client/types/npc.ts";

interface DeferredRequest {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
  signal: AbortSignal | undefined;
  resolveJson: (data: unknown, status?: number) => void;
  rejectWith: (error: unknown) => void;
}

function makeSnapshot(id: string, revision: number): NpcSnapshot {
  return { id, revision } as unknown as NpcSnapshot;
}

function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function createFetchMock() {
  const requests: DeferredRequest[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : String(input);
    const method = init?.method ?? "GET";
    const rawBody = typeof init?.body === "string" ? init.body : null;
    const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : null;
    return new Promise<Response>((resolve, reject) => {
      requests.push({
        url,
        method,
        body,
        signal: init?.signal,
        resolveJson: (data: unknown, status = 200) => {
          resolve(
            new Response(JSON.stringify(data), {
              status,
              headers: { "Content-Type": "application/json" },
            }),
          );
        },
        rejectWith: reject,
      });
    });
  }) as typeof fetch;
  return {
    requests,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

function createSessionStorageMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const original = (globalThis as { sessionStorage?: Storage }).sessionStorage;
  const mock: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    writable: true,
    value: mock,
  });
  return {
    store,
    restore: () => {
      if (original === undefined) {
        delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
      } else {
        Object.defineProperty(globalThis, "sessionStorage", {
          configurable: true,
          writable: true,
          value: original,
        });
      }
    },
  };
}

function mountHook<T>(useHook: () => T) {
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
        H: unknown;
      };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const previousDispatcher = internals.H;

  const states: unknown[] = [];
  const refs: Array<{ current: unknown }> = [];
  const effects: Array<{
    create: () => void | (() => void);
    deps: readonly unknown[] | undefined;
    cleanup: (() => void) | undefined;
    pending: boolean;
  }> = [];

  let stateIdx = 0;
  let refIdx = 0;
  let effectIdx = 0;
  let mounted = true;
  let updatesAfterUnmount = 0;
  let scheduled = false;
  let latest!: T;

  const scheduleRender = () => {
    if (!mounted) {
      updatesAfterUnmount += 1;
      return;
    }
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (mounted) render();
    });
  };

  const dispatcher = {
    useState<S>(initial: S | (() => S)): [S, (next: S | ((prev: S) => S)) => void] {
      const idx = stateIdx++;
      if (!(idx in states)) {
        states[idx] = typeof initial === "function" ? (initial as () => S)() : initial;
      }
      const setter = (next: S | ((prev: S) => S)) => {
        if (!mounted) {
          updatesAfterUnmount += 1;
          return;
        }
        const prev = states[idx] as S;
        const resolved =
          typeof next === "function" ? (next as (p: S) => S)(prev) : next;
        if (!Object.is(prev, resolved)) {
          states[idx] = resolved;
          scheduleRender();
        }
      };
      return [states[idx] as S, setter];
    },
    useRef<R>(initial: R) {
      const idx = refIdx++;
      if (!(idx in refs)) refs[idx] = { current: initial };
      return refs[idx] as { current: R };
    },
    useEffect(create: () => void | (() => void), deps?: readonly unknown[]) {
      const idx = effectIdx++;
      const prev = effects[idx];
      const changed =
        !prev ||
        deps === undefined ||
        prev.deps === undefined ||
        deps.length !== prev.deps.length ||
        deps.some((d, i) => !Object.is(d, prev.deps![i]));
      effects[idx] = {
        create,
        deps,
        cleanup: prev?.cleanup,
        pending: changed,
      };
    },
  };

  function render() {
    stateIdx = 0;
    refIdx = 0;
    effectIdx = 0;
    internals.H = dispatcher;
    try {
      latest = useHook();
    } finally {
      internals.H = previousDispatcher;
    }
    for (const effect of effects) {
      if (!effect.pending) continue;
      effect.pending = false;
      effect.cleanup?.();
      const nextCleanup = effect.create();
      effect.cleanup = typeof nextCleanup === "function" ? nextCleanup : undefined;
    }
  }

  render();

  return {
    get current() {
      return latest;
    },
    get updatesAfterUnmount() {
      return updatesAfterUnmount;
    },
    rerender: () => {
      if (mounted) render();
    },
    unmount: () => {
      if (!mounted) return;
      mounted = false;
      for (const effect of effects) {
        effect.cleanup?.();
        effect.cleanup = undefined;
      }
    },
  };
}

test("useNpcSession discards stale restore responses resolving after new session start (different and equal revisions)", async () => {
  for (const oldRev of [13, 0]) {
    const fetchMock = createFetchMock();
    const storageMock = createSessionStorageMock({
      "everfolk:npc-connection": JSON.stringify({
        id: "old-session",
        token: "old-token",
      }),
    });
    const hook = mountHook(() => useNpcSession());
    try {
      assert.equal(fetchMock.requests.length, 1);
      const restoreReq = fetchMock.requests[0];
      assert.equal(restoreReq.url, "/api/npc/sessions/old-session");

      const startPromise = hook.current.start("fresh-seed");
      await flushMicrotasks();
      assert.equal(restoreReq.signal?.aborted, true, "Starting a new session should abort pending restore");
      assert.equal(fetchMock.requests.length, 2);
      const startReq = fetchMock.requests[1];
      assert.equal(startReq.url, "/api/npc/sessions");

      startReq.resolveJson({
        ...makeSnapshot("new-session", 0),
        token: "new-token",
      });
      await startPromise;
      await flushMicrotasks();

      assert.equal(hook.current.session?.id, "new-session");
      assert.equal(hook.current.session?.revision, 0);
      assert.equal(
        storageMock.store.get("everfolk:npc-connection"),
        JSON.stringify({ id: "new-session", token: "new-token" }),
      );

      // Even if a delayed response ignores AbortSignal and resolves afterward, discard it.
      restoreReq.resolveJson(makeSnapshot("old-session", oldRev));
      await flushMicrotasks();

      assert.equal(hook.current.session?.id, "new-session");
      assert.equal(hook.current.session?.revision, 0);
      assert.equal(hook.current.error, "");

      const turnPromise = hook.current.act("turn");
      await flushMicrotasks();
      assert.equal(fetchMock.requests.length, 3);
      const turnReq = fetchMock.requests[2];
      assert.equal(turnReq.url, "/api/npc/sessions/new-session/turn");
      assert.equal(turnReq.body?.revision, 0);
      turnReq.resolveJson(makeSnapshot("new-session", 1));
      await turnPromise;
      await flushMicrotasks();
      assert.equal(hook.current.session?.id, "new-session");
      assert.equal(hook.current.session?.revision, 1);
    } finally {
      hook.unmount();
      fetchMock.restore();
      storageMock.restore();
    }
  }
});

test("useNpcSession discards stale restore success and failure arriving while start() is in flight", async () => {
  for (const outcome of ["resolve", "reject"] as const) {
    const fetchMock = createFetchMock();
    const storageMock = createSessionStorageMock({
      "everfolk:npc-connection": JSON.stringify({
        id: "old-session",
        token: "old-token",
      }),
    });
    const hook = mountHook(() => useNpcSession());
    try {
      const restoreReq = fetchMock.requests[0];
      const startPromise = hook.current.start("fresh-seed");
      await flushMicrotasks();
      const startReq = fetchMock.requests[1];

      if (outcome === "resolve") {
        restoreReq.resolveJson(makeSnapshot("old-session", 13));
      } else {
        restoreReq.rejectWith(new Error("network down"));
      }
      await flushMicrotasks();
      assert.equal(hook.current.session, null);
      assert.equal(hook.current.error, "");

      startReq.resolveJson({
        ...makeSnapshot("new-session", 0),
        token: "new-token",
      });
      await startPromise;
      await flushMicrotasks();

      assert.equal(hook.current.session?.id, "new-session");
      assert.equal(hook.current.session?.revision, 0);
      assert.equal(hook.current.error, "");
    } finally {
      hook.unmount();
      fetchMock.restore();
      storageMock.restore();
    }
  }
});

test("useNpcSession ignores stale restore error after start completes and resets lease across sessions", async () => {
  const fetchMock = createFetchMock();
  const storageMock = createSessionStorageMock({
    "everfolk:npc-connection": JSON.stringify({
      id: "old-session",
      token: "old-token",
    }),
  });
  const hook = mountHook(() => useNpcSession());
  try {
    const restoreReq = fetchMock.requests[0];
    const startPromise = hook.current.start("seed-1");
    await flushMicrotasks();
    const startReq = fetchMock.requests[1];
    startReq.resolveJson({
      ...makeSnapshot("session-1", 0),
      token: "token-1",
    });
    await startPromise;
    await flushMicrotasks();

    restoreReq.rejectWith(new Error("old restore failed"));
    await flushMicrotasks();
    assert.equal(hook.current.error, "");
    assert.equal(hook.current.session?.id, "session-1");

    const leasePromise = hook.current.act("lease", { npcId: "mentor" });
    await flushMicrotasks();
    fetchMock.requests[2].resolveJson({
      ...makeSnapshot("session-1", 1),
      npcToken: "lease-token-1",
    });
    await leasePromise;
    await flushMicrotasks();
    assert.deepEqual(hook.current.lease, { npcId: "mentor", token: "lease-token-1" });

    const staleAct = hook.current.act;
    const secondStart = hook.current.start("seed-2");
    await flushMicrotasks();
    fetchMock.requests[3].resolveJson({
      ...makeSnapshot("session-2", 0),
      token: "token-2",
    });
    await secondStart;
    await flushMicrotasks();

    assert.equal(hook.current.session?.id, "session-2");
    assert.equal(hook.current.lease, null);

    await staleAct("turn");
    assert.equal(fetchMock.requests.length, 4, "Stale act closure from old session must not fire");
  } finally {
    hook.unmount();
    fetchMock.restore();
    storageMock.restore();
  }
});

test("useNpcSession aborts pending restore and action requests on unmount without post-unmount state updates", async () => {
  const fetchMock = createFetchMock();
  const storageMock = createSessionStorageMock({
    "everfolk:npc-connection": JSON.stringify({
      id: "old-session",
      token: "old-token",
    }),
  });
  const hook = mountHook(() => useNpcSession());
  try {
    const restoreReq = fetchMock.requests[0];
    hook.unmount();
    assert.equal(restoreReq.signal?.aborted, true);
    restoreReq.resolveJson(makeSnapshot("old-session", 3));
    await flushMicrotasks();
    assert.equal(hook.updatesAfterUnmount, 0);
  } finally {
    fetchMock.restore();
    storageMock.restore();
  }

  const fetchMock2 = createFetchMock();
  const storageMock2 = createSessionStorageMock({
    "everfolk:npc-connection": JSON.stringify({
      id: "active-session",
      token: "active-token",
    }),
  });
  const hook2 = mountHook(() => useNpcSession());
  try {
    fetchMock2.requests[0].resolveJson(makeSnapshot("active-session", 4));
    await flushMicrotasks();
    const actPromise = hook2.current.act("turn");
    await flushMicrotasks();
    const turnReq = fetchMock2.requests[1];
    hook2.unmount();
    assert.equal(turnReq.signal?.aborted, true);
    turnReq.rejectWith(new Error("aborted"));
    await actPromise;
    await flushMicrotasks();
    assert.equal(fetchMock2.requests.length, 2, "Unmounted act failure must not trigger follow-up read");
    assert.equal(hook2.updatesAfterUnmount, 0);
  } finally {
    fetchMock2.restore();
    storageMock2.restore();
  }
});
