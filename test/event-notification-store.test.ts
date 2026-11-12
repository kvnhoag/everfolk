import assert from "node:assert/strict";
import test from "node:test";
import { createEventNotificationStore } from "../client/state/event-notification-store.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}

test("seen occurrences persist across fresh store instances without removing previous marks", () => {
  const storage = memoryStorage();
  const first = createEventNotificationStore();
  first.rememberSeenEventNotifications("world:life", ["first", "second"], storage);
  first.rememberSeenEventNotifications("world:life", ["second", "third"], storage);
  first.rememberSeenEventNotifications("world:life", [], storage);
  const restored = createEventNotificationStore();
  assert.deepEqual(restored.readSeenEventNotifications("world:life", storage), ["first", "second", "third"]);
});

test("life identities remain separate, including reserved characters and unusual Unicode", () => {
  const storage = memoryStorage();
  const store = createEventNotificationStore();
  const lives = ["world:life", "world%3Alife", "__proto__", "world:\ud800", "world:\ufffd"];
  lives.forEach((life, index) => store.rememberSeenEventNotifications(life, [`event-${index}`], storage));
  const restored = createEventNotificationStore();
  lives.forEach((life, index) => assert.deepEqual(restored.readSeenEventNotifications(life, storage), [`event-${index}`]));
  assert.equal(storage.values.size, lives.length);
});

test("reads and writes merge storage marks with memory instead of losing either set", () => {
  const storage = memoryStorage();
  const current = createEventNotificationStore();
  const other = createEventNotificationStore();
  current.rememberSeenEventNotifications("life", ["in-memory"], storage);
  storage.values.clear();
  other.rememberSeenEventNotifications("life", ["from-storage"], storage);
  assert.deepEqual(current.readSeenEventNotifications("life", storage), ["in-memory", "from-storage"]);
  current.rememberSeenEventNotifications("life", ["latest"], storage);
  assert.deepEqual(createEventNotificationStore().readSeenEventNotifications("life", storage), ["in-memory", "from-storage", "latest"]);
});

test("blocked storage and unavailable storage retain marks for the browser lifetime", () => {
  const store = createEventNotificationStore();
  const blocked = { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } };
  store.rememberSeenEventNotifications("blocked-life", ["dismissed"], blocked);
  assert.deepEqual(store.readSeenEventNotifications("blocked-life", blocked), ["dismissed"]);
  store.rememberSeenEventNotifications("memory-life", ["expired"]);
  assert.deepEqual(store.readSeenEventNotifications("memory-life"), ["expired"]);
  assert.deepEqual(store.readSeenEventNotifications("different-life", blocked), []);
});

test("invalid stored records cannot erase seen marks or prevent new marks being remembered", () => {
  const storage = memoryStorage();
  const store = createEventNotificationStore();
  store.rememberSeenEventNotifications("life", ["seen"], storage);
  const key = [...storage.values.keys()][0];
  for (const malformed of ["{", "null", "{}", '"event"', '["valid", 1]']) {
    storage.values.set(key, malformed);
    assert.deepEqual(createEventNotificationStore().readSeenEventNotifications("life", storage), []);
    assert.deepEqual(store.readSeenEventNotifications("life", storage), ["seen"]);
  }
  store.rememberSeenEventNotifications("life", ["new"], storage);
  assert.deepEqual(createEventNotificationStore().readSeenEventNotifications("life", storage), ["seen", "new"]);
});
