import type { LifeState } from "../../src/types.ts";
import type { WorldPack } from "../../src/types.ts";
import { buildImportantLifeEvents } from "./important-life-events.ts";
import type { LifeEventRow } from "./life-events.ts";
import { contentFingerprint } from "../../src/random.ts";

/** Life-event notices are text only: each shows for three seconds, then fades. Nothing waits to be closed. */
export const NOTIFICATION_DURATION_MS = 3_000;

/** Journal facts the player caused this year and already sees where they acted (their own trades). */
const PLAYER_ACTION_IDS: readonly string[] = ["market-trade", "army-sale"];

/**
 * Notices that would only repeat what the player just did or already sees on screen: the result of their own
 * yearly action (shown on the action board) and their own market trades (shown in the market). Other activity
 * facts, such as a child born, a person met or a loan taken, still notify. The life record keeps every one of them.
 */
export function isObviousNotice(row: Pick<LifeEventRow, "key" | "kind">): boolean {
  return (row.kind === "activity" && row.key.includes("-outcome-")) || PLAYER_ACTION_IDS.some(id => row.key.endsWith(`-${id}`));
}

export function notificationExpiry(_row: Pick<LifeEventRow, "key" | "kind">, now: number): number {
  return now + NOTIFICATION_DURATION_MS;
}
export const MAX_EVENT_NOTIFICATIONS = 3;

export interface EventNotification extends LifeEventRow {
  age: number;
  year: number;
  sequence: number;
  expiresAt: number;
}

export interface EventNotificationState {
  lifeKey: string;
  journal: readonly string[];
  observedKeys: readonly string[];
  createdCount: number;
  /** Newest first. Seen markers survive dismissal, expiry and history rewinds. */
  notifications: readonly EventNotification[];
}

export function eventNotificationLifeKey(life: Pick<LifeState, "worldFingerprint" | "seed">): string {
  return `${life.worldFingerprint}:${life.seed}`;
}

export function expireEventNotifications(state: EventNotificationState, now: number): EventNotificationState {
  const notifications = state.notifications.filter(notification =>
    notification.expiresAt > now && state.createdCount - notification.sequence < MAX_EVENT_NOTIFICATIONS);
  return notifications.length === state.notifications.length ? state : { ...state, notifications };
}

/** Milliseconds until the next notification expires, or null when none is open. */
export function nextExpiryDelay(notifications: readonly EventNotification[], now: number): number | null {
  const timed = notifications.map(notification => notification.expiresAt).filter(Number.isFinite);
  return timed.length ? Math.max(0, Math.min(...timed) - now) : null;
}

export function dismissEventNotification(state: EventNotificationState, key: string): EventNotificationState {
  return { ...state, notifications: state.notifications.filter(notification => notification.key !== key) };
}

/** Observe completed facts without changing the life or restarting existing deadlines. */
export function syncEventNotifications(state: EventNotificationState | null, life: LifeState, world: WorldPack, now: number, seenKeys: readonly string[] = []): EventNotificationState {
  const lifeKey = eventNotificationLifeKey(life);
  const journal = life.journal.map(entry => JSON.stringify(entry));
  const previous = state?.lifeKey === lifeKey ? state : null;
  const sameHistory = previous && previous.journal.length <= journal.length &&
    previous.journal.every((entry, index) => entry === journal[index]);
  // The projection is newest first. Creation order must stay chronological,
  // including several outcomes delivered in a single engine update.
  const events = [
    ...buildImportantLifeEvents(life, world).flatMap(group => group.events.map(event => ({ ...event, age: group.age, year: group.year }))).reverse(),
  ].filter(event => !isObviousNotice(event)).map(event => ({
    ...event,
    // Journal position distinguishes real recurrences; content distinguishes
    // alternative branch facts recorded at that same position.
    key: `${event.key}:${contentFingerprint([event.title ?? null, event.text])}`,
  })).sort((left, right) => left.age - right.age);
  const observed = new Set([...(previous?.observedKeys ?? []), ...seenKeys]);
  const created = events.filter(event => !observed.has(event.key));
  const previousCount = Math.max(previous?.createdCount ?? 0, observed.size);
  const createdCount = previousCount + created.length;
  const importantKeys = new Set(events.map(event => event.key));
  const notifications = [
    ...created.map((event, index) => ({ ...event, sequence: previousCount + index + 1, expiresAt: notificationExpiry(event, now) })).reverse(),
    ...(sameHistory ? previous.notifications : []),
  ].filter(notification => importantKeys.has(notification.key) && notification.expiresAt > now && createdCount - notification.sequence < MAX_EVENT_NOTIFICATIONS);
  for (const event of created) observed.add(event.key);
  if (sameHistory && !created.length && observed.size === previous.observedKeys.length && notifications.length === previous.notifications.length && journal.length === previous.journal.length) return previous;
  return { lifeKey, journal, observedKeys: [...observed], createdCount, notifications };
}
