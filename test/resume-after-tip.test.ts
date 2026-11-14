import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React from "react";
import { canResumeAfterTip, TIP_RESUME_DELAY_MS, useResumeAfterTip, type TipResumeState } from "../client/hooks/useResumeAfterTip.ts";

const ready: TipResumeState = { phase: "ready", hasBegun: true, visible: true, otherOverlayOpen: false, yearEndPending: false };

test("a closed tip carries the year on after a short rest of about two seconds", () => {
  assert.equal(TIP_RESUME_DELAY_MS, 2000);
  assert.equal(canResumeAfterTip(ready), true);
});

test("a closed tip never resumes past a decision, a year-end choice, another window or a hidden game", () => {
  assert.equal(canResumeAfterTip({ ...ready, phase: "choice" }), false, "a turning point is waiting");
  assert.equal(canResumeAfterTip({ ...ready, phase: "ended" }), false);
  assert.equal(canResumeAfterTip({ ...ready, hasBegun: false }), false);
  assert.equal(canResumeAfterTip({ ...ready, yearEndPending: true }), false, "this year's action choice is waiting");
  assert.equal(canResumeAfterTip({ ...ready, otherOverlayOpen: true }), false, "a help popover or pack moment is open");
  assert.equal(canResumeAfterTip({ ...ready, visible: false }), false, "the game screen is not in view");
});

function mountResume(t: TestContext, initiallyShown = true) {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const browser = Object.assign(new EventTarget(), { hidden: false });
  const restoreGlobals: (() => void)[] = [];
  for (const [key, value] of Object.entries({
    document: browser,
    window: { setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay), clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer) },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    restoreGlobals.push(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else Reflect.deleteProperty(globalThis, key);
    });
  }

  // Run the real hook with the same small dispatcher approach as npc-hook-race.test.ts.
  const internals = (React as unknown as {
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
  }).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const values: unknown[] = [];
  const effects: { deps: readonly unknown[]; cleanup?: () => void }[] = [];
  let cursor = 0, effectCursor = 0, dirty = false, waiting = false, resumes = 0;
  let pending: (() => void)[] = [];
  const input = { shown: initiallyShown, playing: false, state: { ...ready } };
  const dispatcher = {
    useRef(initial: unknown) {
      const index = cursor++;
      return values[index] ??= { current: initial };
    },
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      return [values[index], (next: unknown) => {
        if (Object.is(values[index], next)) return;
        values[index] = next;
        dirty = true;
      }];
    },
    useEffect(create: () => void | (() => void), deps: readonly unknown[]) {
      const index = effectCursor++, previous = effects[index];
      if (previous && deps.every((value, i) => Object.is(value, previous.deps[i]))) return;
      pending.push(() => {
        previous?.cleanup?.();
        effects[index] = { deps, cleanup: create() || undefined };
      });
    },
  };
  function render() {
    do {
      dirty = false;
      cursor = effectCursor = 0;
      pending = [];
      const original = internals.H;
      internals.H = dispatcher;
      try { waiting = useResumeAfterTip(input.shown, input.playing, input.state, () => { resumes++; }); }
      finally { internals.H = original; }
      for (const run of pending) run();
    } while (dirty);
  }
  function unmount() {
    for (const effect of effects) {
      effect.cleanup?.();
      effect.cleanup = undefined;
    }
  }
  render();
  t.after(() => {
    unmount();
    for (const restore of restoreGlobals.reverse()) restore();
  });
  return {
    input, browser, render, unmount,
    get waiting() { render(); return waiting; },
    get resumes() { return resumes; },
    tick(ms: number) { t.mock.timers.tick(ms); render(); },
  };
}

test("closing help resumes a stopped clock once after two seconds", t => {
  const hook = mountResume(t);
  hook.input.shown = false;
  assert.equal(hook.waiting, true);
  hook.tick(TIP_RESUME_DELAY_MS - 1);
  assert.equal(hook.resumes, 0);
  hook.tick(1);
  assert.equal(hook.resumes, 1);
  assert.equal(hook.waiting, false);
  hook.tick(TIP_RESUME_DELAY_MS);
  assert.equal(hook.resumes, 1);
});

test("opening more help cancels the wait and closing the last guide starts a fresh delay", t => {
  const hook = mountResume(t);
  hook.input.shown = false;
  hook.render();
  hook.tick(1_000);
  hook.input.shown = true;
  assert.equal(hook.waiting, false);
  hook.tick(TIP_RESUME_DELAY_MS);
  assert.equal(hook.resumes, 0);
  hook.input.shown = false;
  hook.render();
  hook.tick(TIP_RESUME_DELAY_MS);
  assert.equal(hook.resumes, 1);
});

test("manual Resume then Pause cancels a pending automatic resume", t => {
  const hook = mountResume(t);
  hook.input.shown = false;
  hook.render();
  hook.tick(1_000);
  hook.input.playing = true;
  assert.equal(hook.waiting, false);
  hook.input.playing = false;
  hook.render();
  hook.tick(TIP_RESUME_DELAY_MS);
  assert.equal(hook.resumes, 0);
});

test("a decision, year-end choice, window or dashboard exit cancels automatic resume", async t => {
  for (const blocked of [
    { phase: "choice" as const }, { phase: "ended" as const }, { hasBegun: false },
    { yearEndPending: true }, { otherOverlayOpen: true }, { visible: false },
  ]) {
    await t.test(JSON.stringify(blocked), t => {
      const hook = mountResume(t);
      hook.input.shown = false;
      hook.render();
      hook.tick(1_000);
      hook.input.state = { ...ready, ...blocked };
      assert.equal(hook.waiting, false);
      hook.input.state = { ...ready };
      hook.render();
      hook.tick(TIP_RESUME_DELAY_MS);
      assert.equal(hook.resumes, 0);
    });
  }
});

test("leaving the browser tab cancels resume even if the player returns before the delay ends", t => {
  const hook = mountResume(t);
  hook.input.shown = false;
  hook.render();
  hook.tick(1_000);
  hook.browser.hidden = true;
  hook.browser.dispatchEvent(new Event("visibilitychange"));
  hook.browser.hidden = false;
  hook.browser.dispatchEvent(new Event("visibilitychange"));
  assert.equal(hook.waiting, false);
  hook.tick(TIP_RESUME_DELAY_MS);
  assert.equal(hook.resumes, 0);
});

test("an already running clock, an initial closed screen and unmounted help never schedule resume", t => {
  const hook = mountResume(t, false);
  hook.tick(TIP_RESUME_DELAY_MS);
  assert.equal(hook.resumes, 0);
  hook.input.shown = true;
  hook.input.playing = true;
  hook.render();
  hook.input.shown = false;
  assert.equal(hook.waiting, false);
  hook.tick(TIP_RESUME_DELAY_MS);
  assert.equal(hook.resumes, 0);
  hook.input.shown = true;
  hook.input.playing = false;
  hook.render();
  hook.input.shown = false;
  assert.equal(hook.waiting, true);
  hook.unmount();
  t.mock.timers.tick(TIP_RESUME_DELAY_MS);
  assert.equal(hook.resumes, 0);
});
