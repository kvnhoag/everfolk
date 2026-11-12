import assert from "node:assert/strict";
import test from "node:test";
import { builtinEngine } from "../client/lib/world-session.ts";
import type { JournalEntry, LifeState } from "../src/types.ts";
import { dismissEventNotification, eventNotificationLifeKey, expireEventNotifications, syncEventNotifications } from "../client/models/event-notifications.ts";
import { createEventNotificationStore } from "../client/state/event-notification-store.ts";

const world = builtinEngine.world;
const base = { ...builtinEngine.start("notification-lifecycle"), journal: [] };
function withEvents(life: LifeState, ...ids: string[]): LifeState {
  const additions: JournalEntry[] = ids.map(id => ({ type: "event", id: `health-onset-${id}`, text: `Completed ${id}.`, age: life.age, year: life.year }));
  return { ...life, journal: [...life.journal, ...additions] };
}

test("an event expires at exactly 30 seconds, even without another life update", () => {
  const life = withEvents(base, "first");
  const state = syncEventNotifications(null, life, world, 1000);
  assert.equal(expireEventNotifications(state, 30_999).notifications.length, 1);
  assert.equal(expireEventNotifications(state, 31_000).notifications.length, 0);
  const expired = expireEventNotifications(state, 31_000);
  assert.equal(syncEventNotifications(expired, { ...life }, world, 32_000).notifications.length, 0,
    "A paused render or phase change cannot recreate an expired notification.");
});

test("the third newer event closes an old notification, including a single batch", () => {
  const firstLife = withEvents(base, "first");
  const first = syncEventNotifications(null, firstLife, world, 0);
  const twoNewerLife = withEvents(firstLife, "second", "third");
  const twoNewer = syncEventNotifications(first, twoNewerLife, world, 500);
  assert.deepEqual(twoNewer.notifications.map(item => item.text), ["Completed third.", "Completed second.", "Completed first."]);
  const fourthLife = withEvents(twoNewerLife, "fourth");
  const fourth = syncEventNotifications(twoNewer, fourthLife, world, 600);
  assert.deepEqual(fourth.notifications.map(item => item.text), ["Completed fourth.", "Completed third.", "Completed second."]);
  const batch = syncEventNotifications(first, withEvents(firstLife, "second", "third", "fourth", "fifth"), world, 500);
  assert.deepEqual(batch.notifications.map(item => item.text), ["Completed fifth.", "Completed fourth.", "Completed third."]);
});

test("manually dismissed newer events still count toward replacing older events", () => {
  const firstLife = withEvents(base, "first");
  const first = syncEventNotifications(null, firstLife, world, 0);
  const secondLife = withEvents(firstLife, "second");
  const second = syncEventNotifications(first, secondLife, world, 100);
  const dismissed = dismissEventNotification(second, second.notifications[0].key);
  assert.deepEqual(dismissed.notifications.map(item => item.text), ["Completed first."]);
  const rerender = syncEventNotifications(dismissed, secondLife, world, 200);
  assert.deepEqual(rerender.notifications.map(item => item.text), ["Completed first."]);
  const later = syncEventNotifications(rerender, withEvents(secondLife, "third", "fourth"), world, 300);
  assert.deepEqual(later.notifications.map(item => item.text), ["Completed fourth.", "Completed third."]);
});

test("quiet birthdays and pending decision prompts neither count nor extend deadlines", () => {
  const firstLife = withEvents(base, "first");
  const first = syncEventNotifications(null, firstLife, world, 0);
  const decision = world.events.find(event => event.mode !== "automatic")!;
  const quiet: LifeState = { ...firstLife, age: 1, year: firstLife.year + 1, phase: "choice", pendingEventId: decision.id,
    journal: [...firstLife.journal,
      { type: "year", age: 1, year: firstLife.year + 1, id: "birthday", text: "A year passes." },
      { type: "event", age: 1, year: firstLife.year + 1, id: decision.id, text: decision.text },
    ],
  };
  const updated = syncEventNotifications(first, quiet, world, 20_000);
  assert.equal(updated.createdCount, 1);
  assert.equal(updated.notifications[0].expiresAt, 30_000);
  assert.equal(expireEventNotifications(updated, 30_000).notifications.length, 0);
});

test("routine events do not notify or push an important notification out of the queue", () => {
  const firstLife = withEvents(base, "first");
  const first = syncEventNotifications(null, firstLife, world, 0);
  const quietLife: LifeState = { ...firstLife, age: 3, year: firstLife.year + 3, journal: [...firstLife.journal,
    ...["small-doorway", "first-steps", "background-artisan-household-practice"].map(id => ({
      type: "event" as const, id, text: "An ordinary moment.", age: 3, year: firstLife.year + 3,
    })),
  ] };
  const updated = syncEventNotifications(first, quietLife, world, 20_000);
  assert.equal(updated.createdCount, 1);
  assert.deepEqual(updated.notifications.map(item => item.text), ["Completed first."]);
  assert.equal(updated.notifications[0].expiresAt, 30_000);
  assert.equal(syncEventNotifications(null, { ...quietLife, journal: quietLife.journal.slice(1) }, world, 0).notifications.length, 0);
});

test("rewinding or replaying a life never reopens an already-seen occurrence", () => {
  const early = withEvents(base, "first");
  const later = withEvents(early, "second");
  const before = JSON.stringify(later);
  const state = syncEventNotifications(null, later, world, 0);
  const dismissed = dismissEventNotification(state, state.notifications[1].key);
  const rewind = syncEventNotifications(dismissed, early, world, 1000);
  assert.equal(rewind.notifications.length, 0);
  assert.equal(syncEventNotifications(rewind, later, world, 2000).notifications.length, 0);
  const other = syncEventNotifications(state, { ...early, seed: "another-life" }, world, 2000);
  assert.equal(other.createdCount, 1);
  const replaced = syncEventNotifications(state, withEvents(base, "different", "second"), world, 3000);
  assert.deepEqual(replaced.notifications.map(item => item.text), ["Completed different."],
    "An alternate history may show new facts, while retaining seen occurrences.");
  assert.equal(JSON.stringify(later), before);
});

test("closed notifications stay closed after reload, remount and switching away from a life", () => {
  const saved = new Map<string, string>();
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
  const life = withEvents(base, "first", "second", "third", "fourth");
  const store = createEventNotificationStore();
  const shown = syncEventNotifications(null, life, world, 0);
  store.rememberSeenEventNotifications(shown.lifeKey, shown.observedKeys, storage);
  const dismissed = dismissEventNotification(shown, shown.notifications[0].key);
  assert.equal(expireEventNotifications(dismissed, 30_000).notifications.length, 0);

  const reloadedStore = createEventNotificationStore();
  const seen = reloadedStore.readSeenEventNotifications(eventNotificationLifeKey(life), storage);
  const reloaded = syncEventNotifications(null, life, world, 40_000, seen);
  assert.equal(reloaded.notifications.length, 0, "Manual closure, timeout and replacement all remain closed after reload.");
  const otherLife = { ...base, seed: "another-life" };
  const switched = syncEventNotifications(reloaded, otherLife, world, 41_000);
  assert.equal(syncEventNotifications(switched, life, world, 42_000, seen).notifications.length, 0);

  const recurrence = syncEventNotifications(reloaded, withEvents(life, "fourth"), world, 43_000, seen);
  assert.deepEqual(recurrence.notifications.map(item => item.text), ["Completed fourth."],
    "A genuinely new occurrence of the same authored event can still notify.");
});

test("different facts at the same journal position can notify without replaying old branch facts", () => {
  const life = withEvents(base, "first");
  const shown = syncEventNotifications(null, life, world, 0);
  const closed = dismissEventNotification(shown, shown.notifications[0].key);
  const branch = { ...life, journal: life.journal.map(entry => ({ ...entry, text: "A different completed fact." })) };
  const changed = syncEventNotifications(closed, branch, world, 1000);
  assert.deepEqual(changed.notifications.map(item => item.text), ["A different completed fact."]);
  assert.equal(syncEventNotifications(changed, life, world, 2000).notifications.length, 0);
});
