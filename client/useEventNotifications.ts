import { useCallback, useEffect, useState } from "react";
import type { LifeState, WorldPack } from "../src/types.ts";
import { dismissEventNotification, eventNotificationLifeKey, expireEventNotifications, syncEventNotifications } from "./event-notifications.ts";
import { readSeenEventNotifications, rememberSeenEventNotifications } from "./event-notification-store.ts";

/** A single lifecycle for both the event panel and floating completed-event notices. */
export function useEventNotifications(life: LifeState, world: WorldPack) {
  const [updates, setUpdates] = useState(() => syncEventNotifications(null, life, world, Date.now(), readSeenEventNotifications(eventNotificationLifeKey(life))));
  useEffect(() => {
    const seenKeys = readSeenEventNotifications(eventNotificationLifeKey(life));
    setUpdates(previous => syncEventNotifications(previous, life, world, Date.now(), seenKeys));
  }, [life, world]);
  useEffect(() => {
    rememberSeenEventNotifications(updates.lifeKey, updates.observedKeys);
  }, [updates.lifeKey, updates.observedKeys]);
  useEffect(() => {
    if (!updates.notifications.length) return;
    const expiresAt = Math.min(...updates.notifications.map(notification => notification.expiresAt));
    const timer = window.setTimeout(() => setUpdates(previous => expireEventNotifications(previous, Date.now())), Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [updates.notifications]);
  useEffect(() => {
    const expireOnReturn = () => {
      if (!document.hidden) setUpdates(previous => expireEventNotifications(previous, Date.now()));
    };
    document.addEventListener("visibilitychange", expireOnReturn);
    return () => document.removeEventListener("visibilitychange", expireOnReturn);
  }, []);
  const dismiss = useCallback((key: string) => setUpdates(previous => dismissEventNotification(previous, key)), []);
  return { notifications: updates.notifications, dismiss };
}
