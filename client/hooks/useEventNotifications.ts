import { useCallback, useEffect, useState } from "react";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { dismissEventNotification, eventNotificationLifeKey, expireEventNotifications, nextExpiryDelay, syncEventNotifications } from "../models/event-notifications.ts";
import type { EventNotificationState } from "../models/event-notifications.ts";
import { readSeenEventNotifications, rememberSeenEventNotifications } from "../state/event-notification-store.ts";

/** One lifecycle for completed notices in both the classic and vocation views. */
export function useEventNotifications(life: LifeState, world: WorldPack, enabled = true, persistent = true) {
  const lifeKey = eventNotificationLifeKey(life);
  const [updates, setUpdates] = useState<EventNotificationState | null>(() => enabled
    ? syncEventNotifications(null, life, world, Date.now(), persistent ? readSeenEventNotifications(lifeKey) : []) : null);
  useEffect(() => {
    if (!enabled) { setUpdates(null); return; }
    const seen = persistent ? readSeenEventNotifications(lifeKey) : [];
    setUpdates(previous => syncEventNotifications(previous, life, world, Date.now(), seen));
  }, [life, world, lifeKey, enabled, persistent]);
  useEffect(() => {
    if (persistent && enabled && updates) rememberSeenEventNotifications(updates.lifeKey, updates.observedKeys);
  }, [persistent, enabled, updates?.lifeKey, updates?.observedKeys]);
  useEffect(() => {
    if (!enabled || !updates?.notifications.length) return;
    const delay = nextExpiryDelay(updates.notifications, Date.now());
    if (delay === null) return;
    const timer = window.setTimeout(() => setUpdates(previous => previous && expireEventNotifications(previous, Date.now())), delay);
    return () => window.clearTimeout(timer);
  }, [enabled, updates?.notifications]);
  useEffect(() => {
    if (!enabled) return;
    const expireOnReturn = () => {
      if (!document.hidden) setUpdates(previous => previous && expireEventNotifications(previous, Date.now()));
    };
    document.addEventListener("visibilitychange", expireOnReturn);
    return () => document.removeEventListener("visibilitychange", expireOnReturn);
  }, [enabled]);
  const dismiss = useCallback((key: string) => setUpdates(previous => previous && dismissEventNotification(previous, key)), []);
  return {
    notifications: enabled && updates?.lifeKey === lifeKey ? updates.notifications : [],
    dismissNotification: dismiss,
    dismiss,
  };
}
