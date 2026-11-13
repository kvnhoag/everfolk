import assert from "node:assert/strict";
import test from "node:test";
import { createTutorialStore } from "../client/state/tutorial-store.ts";
import { LEGACY_TUTORIAL_STORAGE_KEY, readTutorialProgress, TUTORIAL_STORAGE_KEY, writeTutorialProgress } from "../client/storage/tutorial-storage.ts";
import type { TutorialContext, TutorialLifeFacts } from "../client/models/tutorial-triggers.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, data };
}
const brokenStorage = { getItem(): string | null { throw new Error("blocked"); }, setItem(): void { throw new Error("blocked"); } };

function facts(over: Partial<TutorialLifeFacts> = {}): TutorialLifeFacts {
  return { age: 0, ended: false, decisionPending: false, learnedSkills: 0, focusShown: false, resourcesShown: true, wealthShown: true, deckShown: true, notificationShown: false, tradeAge: 10, ...over };
}
const game = (over: Partial<TutorialLifeFacts> = {}): TutorialContext => ({ view: "game", characterSection: null, life: facts(over) });
const home: TutorialContext = { view: "home", characterSection: null, life: facts() };

test("progress is stored under a new versioned key and reads tolerate missing, broken or blocked storage", () => {
  assert.equal(TUTORIAL_STORAGE_KEY, "everfolk:tutorial:v2");
  assert.deepEqual(readTutorialProgress(undefined), { seen: [], current: null });
  assert.deepEqual(readTutorialProgress(brokenStorage), { seen: [], current: null });
  assert.deepEqual(readTutorialProgress(memoryStorage({ [TUTORIAL_STORAGE_KEY]: "{not json" })), { seen: [], current: null });
  assert.deepEqual(readTutorialProgress(memoryStorage({ [TUTORIAL_STORAGE_KEY]: JSON.stringify({ seen: "rail", current: 4 }) })), { seen: [], current: null });
  assert.doesNotThrow(() => writeTutorialProgress(brokenStorage, { seen: ["rail"], current: "rail" }));
  assert.doesNotThrow(() => writeTutorialProgress(undefined, { seen: [], current: null }));
});

test("the old v1 key is ignored without a crash; a player who saw the old tour is not welcomed twice", () => {
  assert.deepEqual(readTutorialProgress(memoryStorage({ [LEGACY_TUTORIAL_STORAGE_KEY]: "closed" })), { seen: ["welcome"], current: null });
  assert.deepEqual(readTutorialProgress(memoryStorage({ [LEGACY_TUTORIAL_STORAGE_KEY]: "garbage" })), { seen: [], current: null });
  const store = createTutorialStore({ storage: () => memoryStorage({ [LEGACY_TUTORIAL_STORAGE_KEY]: "started" }) });
  store.setGameContext(home);
  assert.equal(store.getSnapshot().open, false);
});

test("unknown hint ids in storage are dropped", () => {
  const storage = memoryStorage({ [TUTORIAL_STORAGE_KEY]: JSON.stringify({ seen: ["rail", "finish", 3], current: "finish" }) });
  assert.deepEqual(readTutorialProgress(storage), { seen: ["rail", "finish"], current: "finish" });
  const store = createTutorialStore({ storage: () => storage });
  store.setGameContext(game({ age: 3 }));
  assert.deepEqual(store.getSnapshot().seen, ["rail"]);
  assert.notEqual(store.getSnapshot().hintId, "finish");
});

test("a first visit opens the welcome hint by itself, once", () => {
  const storage = memoryStorage();
  const store = createTutorialStore({ storage: () => storage });
  store.setGameContext(home);
  assert.equal(store.getSnapshot().hintId, "welcome");
  assert.equal(store.getSnapshot().open, true);
  store.close();
  const later = createTutorialStore({ storage: () => storage });
  later.setGameContext(home);
  assert.equal(later.getSnapshot().open, false, "a later visit does not repeat it");
});

test("closing persists seen hints and the current step; reopening resumes there", () => {
  const storage = memoryStorage();
  const store = createTutorialStore({ storage: () => storage });
  store.setGameContext(game({ age: 0 }));
  store.close();
  assert.deepEqual(JSON.parse(storage.data.get(TUTORIAL_STORAGE_KEY)!), { seen: ["time-bar"], current: "time-bar" });
  const reloaded = createTutorialStore({ storage: () => storage });
  reloaded.setGameContext(game({ age: 0 }));
  assert.equal(reloaded.getSnapshot().open, false, "the seen hint does not come back after a reload");
  reloaded.openFromButton();
  assert.equal(reloaded.getSnapshot().open, true);
  assert.equal(reloaded.getSnapshot().hintId, "time-bar");
});

test("the Tutorial button opens the section on screen and never navigates", () => {
  const store = createTutorialStore({ storage: () => undefined });
  assert.equal("registerNavigator" in store, false, "the tutorial has no way to change screens");
  store.setGameContext({ view: "character", characterSection: "wealth", life: facts({ age: 9 }) });
  store.close();
  store.setChainView("figures");
  store.openFromButton();
  assert.equal(store.getSnapshot().hintId, "figures");
  assert.equal(store.getContext().view, "figures");
  store.setChainView(null);
  assert.equal(store.getContext().view, "character", "leaving the Weave screen returns to the game's own screen");
});

test("a ? button opens its hint even after it was seen", () => {
  const store = createTutorialStore({ storage: () => undefined });
  store.setGameContext(game({ age: 11 }));
  store.openHint("market");
  store.close();
  store.openHint("market");
  assert.equal(store.getSnapshot().hintId, "market");
  assert.equal(store.getSnapshot().open, true);
});

test("context updates that change nothing stay quiet; real changes reach subscribers", () => {
  const store = createTutorialStore({ storage: () => undefined });
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  store.setGameContext(game({ age: 0 }));
  const after = calls;
  store.setGameContext(game({ age: 0 }));
  assert.equal(calls, after);
  store.close();
  assert.ok(calls > after);
  unsubscribe();
  assert.equal(store.getServerSnapshot().open, false);
});

test("blocked storage never breaks the tutorial", () => {
  const store = createTutorialStore({ storage: () => brokenStorage });
  assert.doesNotThrow(() => { store.setGameContext(game({ age: 0 })); store.close(); store.openFromButton(); });
  assert.equal(store.getSnapshot().open, true);
});

test("turning tips off is remembered across reloads; old saves keep tips on", () => {
  const storage = memoryStorage();
  const store = createTutorialStore({ storage: () => storage });
  store.setGameContext(game({ age: 0 }));
  store.setTipsOn(false);
  assert.equal(store.getSnapshot().tipsOn, false);
  assert.equal(JSON.parse(storage.data.get(TUTORIAL_STORAGE_KEY)!).tipsOff, true);
  const reloaded = createTutorialStore({ storage: () => storage });
  reloaded.setGameContext(game({ age: 16 }));
  assert.equal(reloaded.getSnapshot().tipsOn, false);
  assert.equal(reloaded.getSnapshot().open, false, "a reloaded game with tips off opens no card by itself");
  assert.ok(reloaded.getSnapshot().flash?.ids.includes("planting"));
  store.setTipsOn(true);
  assert.equal(JSON.parse(storage.data.get(TUTORIAL_STORAGE_KEY)!).tipsOff, undefined);
  const old = createTutorialStore({ storage: () => memoryStorage({ [TUTORIAL_STORAGE_KEY]: JSON.stringify({ seen: ["welcome"], current: null }) }) });
  old.setGameContext(home);
  assert.equal(old.getSnapshot().tipsOn, true);
});

test("the saved On/Off is shown before any screen reports in", () => {
  const storage = memoryStorage({ [TUTORIAL_STORAGE_KEY]: JSON.stringify({ seen: ["welcome"], current: null, tipsOff: true }) });
  const store = createTutorialStore({ storage: () => storage });
  assert.equal(store.getSnapshot().tipsOn, false, "no reset to On while the page is still starting");
  assert.deepEqual(store.getSnapshot().seen, ["welcome"]);
});
