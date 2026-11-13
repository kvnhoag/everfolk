import { useEffect, useState } from "react";
import { formatYear } from "../../src/calendar.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { dismissEventNotification, eventNotificationLifeKey, expireEventNotifications, syncEventNotifications } from "../models/event-notifications.ts";
import { readSeenEventNotifications, rememberSeenEventNotifications } from "../state/event-notification-store.ts";
import PixelIcon from "./PixelIcon.tsx";
import { displayProse } from "../models/display-prose.ts";
import "../styles/event-notifications.css";

/** A completed moment, never a pending choice or an invented outcome. */
export default function LifeMoment({ life, world, onAdvance, onOpenChronicle, persistent = true }: {
  life: LifeState; world: WorldPack; onAdvance(): void; onOpenChronicle(): void; persistent?: boolean;
}) {
  const [updates, setUpdates] = useState(() => syncEventNotifications(null, life, world, Date.now(), persistent ? readSeenEventNotifications(eventNotificationLifeKey(life)) : []));
  useEffect(() => {
    const seenKeys = persistent ? readSeenEventNotifications(eventNotificationLifeKey(life)) : [];
    setUpdates(previous => syncEventNotifications(previous, life, world, Date.now(), seenKeys));
  }, [life, world, persistent]);
  useEffect(() => {
    if (!persistent) return;
    rememberSeenEventNotifications(updates.lifeKey, updates.observedKeys);
  }, [updates.lifeKey, updates.observedKeys, persistent]);
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
  return <section className="life-moment" aria-labelledby="life-moment-title">
    <p className="life-moment-intro" id="life-moment-title">Important life events</p>
    <div className="event-notifications" role="log" aria-label="Important life events" aria-live="polite" aria-relevant="additions">
      {updates.notifications.map(notification => <article className="event-notification" key={notification.key}>
        <header className="life-moment-heading"><span>{formatYear(notification.year)}</span><h2>{notification.title ?? "Life event"}</h2><button className="event-notification-dismiss" type="button" aria-label={`Dismiss event: ${notification.title ?? notification.text}`} onClick={() => setUpdates(previous => dismissEventNotification(previous, notification.key))}><PixelIcon name="close" size={14} /></button></header>
        <p className="life-moment-copy">{displayProse(notification.text)}</p>
      </article>)}
    </div>
    {!updates.notifications.length && <p className="life-moment-copy">Your full story is saved in your life record.</p>}
    {life.phase === "ready" && <button className="moment-advance" type="button" onClick={onAdvance}>Live another year <PixelIcon name="arrow" size={16} /></button>}
    <button className="moment-chronicle" type="button" onClick={onOpenChronicle}>Read your life record <span aria-hidden="true">↗</span></button>
  </section>;
}
