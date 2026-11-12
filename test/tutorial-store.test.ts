import assert from "node:assert/strict";
import test from "node:test";
import { createTutorialStore } from "../client/state/tutorial-store.ts";
import { hasSeenTutorial, rememberTutorial, TUTORIAL_STORAGE_KEY } from "../client/storage/tutorial-storage.ts";
import { TUTORIAL_STEPS } from "../client/models/tutorial-steps.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, data };
}

const brokenStorage = { getItem(): string | null { throw new Error("blocked"); }, setItem(): void { throw new Error("blocked"); } };

test("the storage key is versioned and reads tolerate missing or blocked storage", () => {
  assert.equal(TUTORIAL_STORAGE_KEY, "everfolk:tutorial:v1");
  assert.equal(hasSeenTutorial(undefined), false);
  assert.equal(hasSeenTutorial(brokenStorage), false);
  assert.doesNotThrow(() => rememberTutorial(brokenStorage, "closed"));
  assert.doesNotThrow(() => rememberTutorial(undefined, "closed"));
});

test("the tour opens by itself once on a first visit", () => {
  const storage = memoryStorage();
  const store = createTutorialStore({ steps: TUTORIAL_STEPS, storage: () => storage });
  assert.equal(store.autoOpen(), true);
  assert.equal(store.getSnapshot().open, true);
  assert.equal(store.getSnapshot().index, 0);
  const again = createTutorialStore({ steps: TUTORIAL_STEPS, storage: () => storage });
  assert.equal(again.autoOpen(), false, "a later visit does not reopen it");
  assert.equal(again.getSnapshot().open, false);
});

test("closing remembers that the player closed it", () => {
  const storage = memoryStorage();
  const store = createTutorialStore({ steps: TUTORIAL_STEPS, storage: () => storage });
  store.start();
  store.next();
  store.close();
  assert.equal(store.getSnapshot().open, false);
  assert.equal(storage.data.get(TUTORIAL_STORAGE_KEY), "closed");
  assert.equal(hasSeenTutorial(storage), true);
});

test("Next on the last step finishes and is remembered like a close", () => {
  const storage = memoryStorage();
  const store = createTutorialStore({ steps: TUTORIAL_STEPS, storage: () => storage });
  store.start(TUTORIAL_STEPS.length - 1);
  store.next();
  assert.equal(store.getSnapshot().open, false);
  assert.equal(storage.data.get(TUTORIAL_STORAGE_KEY), "closed");
});

test("the Tutorial button can always reopen the tour from step one", () => {
  const storage = memoryStorage({ [TUTORIAL_STORAGE_KEY]: "closed" });
  const store = createTutorialStore({ steps: TUTORIAL_STEPS, storage: () => storage });
  store.start();
  assert.deepEqual({ open: store.getSnapshot().open, index: store.getSnapshot().index }, { open: true, index: 0 });
});

test("each step change asks the registered screens to navigate", () => {
  const store = createTutorialStore({ steps: TUTORIAL_STEPS, storage: () => undefined });
  const seen: string[] = [];
  const stop = store.registerNavigator(screen => { seen.push(screen.kind === "chain" ? screen.hash : screen.kind); });
  store.start();
  store.next();
  store.goTo(TUTORIAL_STEPS.findIndex(step => step.id === "market"));
  store.back();
  stop();
  store.next();
  assert.deepEqual(seen, ["home", "home", "#market", "#weave"]);
});

test("a failing navigator does not stop the tour or other navigators", () => {
  const store = createTutorialStore({ steps: TUTORIAL_STEPS, storage: () => undefined });
  const calls: string[] = [];
  const originalError = console.error;
  console.error = () => {};
  try {
    store.registerNavigator(() => { throw new Error("boom"); });
    store.registerNavigator(screen => { calls.push(screen.kind); });
    store.start();
  } finally { console.error = originalError; }
  assert.deepEqual(calls, ["home"]);
  assert.equal(store.getSnapshot().open, true);
});

test("subscribers hear changes and snapshots are new objects", () => {
  const store = createTutorialStore({ steps: TUTORIAL_STEPS, storage: () => undefined });
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls += 1; });
  const before = store.getSnapshot();
  store.start();
  assert.notEqual(store.getSnapshot(), before);
  assert.equal(before.open, false, "the old snapshot is unchanged");
  store.back();
  assert.equal(calls, 1, "Back on step one emits nothing");
  unsubscribe();
  store.next();
  assert.equal(calls, 1);
  assert.equal(store.getServerSnapshot().open, false);
});
