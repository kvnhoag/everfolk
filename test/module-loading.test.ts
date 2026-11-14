import assert from "node:assert/strict";
import test from "node:test";
import { createModuleLoadingProgress, MODULE_LOADING_END, MODULE_LOADING_START } from "../client/state/module-loading.ts";

function browserFixture() {
  const originals = new Map(["document", "performance", "HTMLLinkElement", "MutationObserver", "PerformanceObserver"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const links: Link[] = [];
  let resourceCallback: (list: { getEntries(): unknown[] }) => void;
  let mutationCallback: () => void;
  let loadCallback: (event: { target: Link }) => void;
  let resourceDisconnected = false;
  let mutationDisconnected = false;
  let loadRemoved = false;
  const cached = "https://everfolk.test/shell.js";
  class Link {
    readonly href: string;
    constructor(href: string) { this.href = href; }
    matches() { return true; }
  }
  const globals = {
    document: {
      head: {},
      querySelectorAll: () => links,
      addEventListener: (_type: string, callback: typeof loadCallback) => { loadCallback = callback; },
      removeEventListener: () => { loadRemoved = true; },
    },
    performance: { getEntriesByType: () => [{ name: cached }] },
    HTMLLinkElement: Link,
    MutationObserver: class {
      constructor(callback: typeof mutationCallback) { mutationCallback = callback; }
      observe() {}
      disconnect() { mutationDisconnected = true; }
    },
    PerformanceObserver: class {
      constructor(callback: typeof resourceCallback) { resourceCallback = callback; }
      observe() {}
      disconnect() { resourceDisconnected = true; }
    },
  };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, value });
  links.push(new Link(cached));
  return {
    declare(...urls: string[]) { links.push(...urls.map(url => new Link(url))); mutationCallback(); },
    finish(url: string, status = 200) { resourceCallback({ getEntries: () => [{ name: url, responseStatus: status }] }); },
    load(url: string) { loadCallback({ target: links.find(link => link.href === url)! }); },
    cleaned: () => resourceDisconnected && mutationDisconnected && loadRemoved,
    restore() {
      for (const [name, descriptor] of originals) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
      }
    },
  };
}

test("real dependency completions update the fallback before the game import resolves", async () => {
  const browser = browserFixture();
  try {
    const loading = createModuleLoadingProgress();
    const snapshots: number[] = [];
    const unsubscribe = loading.subscribe(() => snapshots.push(loading.getSnapshot()));
    let resolve!: (value: string) => void;
    const pending = loading.track(() => {
      browser.declare("world-one.js", "world-two.js", "game.css");
      return new Promise<string>(done => { resolve = done; });
    });
    assert.equal(loading.getSnapshot(), MODULE_LOADING_START, "cached shell assets cannot pretend the game has loaded");
    browser.finish("world-one.js");
    const first = loading.getSnapshot();
    assert.ok(first > MODULE_LOADING_START && first < MODULE_LOADING_END);
    browser.finish("unrelated.js");
    browser.finish("world-one.js");
    browser.finish("world-two.js", 404);
    assert.equal(loading.getSnapshot(), first, "duplicates, unrelated requests and failures are excluded");
    browser.declare("extra-world.js");
    assert.equal(loading.getSnapshot(), first, "discovering more work must not move the bar backwards");
    browser.load("game.css");
    browser.finish("world-two.js");
    browser.finish("extra-world.js");
    assert.ok(loading.getSnapshot() > first && loading.getSnapshot() < MODULE_LOADING_END, "module evaluation still has to complete");
    resolve("game");
    assert.equal(await pending, "game");
    assert.equal(loading.getSnapshot(), MODULE_LOADING_END, "save and world setup keep the remaining progress");
    assert.equal(loading.getServerSnapshot(), MODULE_LOADING_START);
    assert.ok(snapshots.every((value, index) => index === 0 || value > snapshots[index - 1]));
    assert.ok(browser.cleaned());
    unsubscribe();
  } finally { browser.restore(); }
});

test("a rejected import cleans up observers and never reports code ready", async () => {
  const browser = browserFixture();
  try {
    const loading = createModuleLoadingProgress();
    await assert.rejects(loading.track(async () => { throw new Error("Download failed"); }), /Download failed/);
    assert.equal(loading.getSnapshot(), MODULE_LOADING_START);
    assert.ok(browser.cleaned());
  } finally { browser.restore(); }
});

test("cached imports and imports outside the browser still complete without simulated ticks", async () => {
  const loading = createModuleLoadingProgress();
  assert.equal(await loading.track(async () => "cached"), "cached");
  assert.equal(loading.getSnapshot(), MODULE_LOADING_END);
});


test("development imports advance at completed preload milestones before the game is ready", async () => {
  const loading = createModuleLoadingProgress();
  const finish: Array<() => void> = [];
  let imported = false;
  const pending = loading.track(async () => { imported = true; return "game"; }, [
    () => new Promise<void>(resolve => { finish.push(resolve); }),
    () => new Promise<void>(resolve => { finish.push(resolve); }),
  ]);
  assert.equal(loading.getSnapshot(), MODULE_LOADING_START);
  assert.equal(imported, false);
  finish[0]();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.ok(loading.getSnapshot() > MODULE_LOADING_START && loading.getSnapshot() < MODULE_LOADING_END);
  assert.equal(imported, false, "the main game waits for its dependencies");
  finish[1]();
  assert.equal(await pending, "game");
  assert.equal(loading.getSnapshot(), MODULE_LOADING_END);
});
