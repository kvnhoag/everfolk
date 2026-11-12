import { formatYear } from "../../src/calendar.ts";
import type { LifeState, WorldPack } from "../../src/types.ts";
import { useEventNotifications } from "../hooks/useEventNotifications.ts";
import PixelIcon from "./PixelIcon.tsx";
import { displayProse } from "../models/display-prose.ts";
import "../styles/event-notifications.css";

/** A completed moment, never a pending choice or an invented outcome. */
export default function LifeMoment({ life, world, onAdvance, onOpenChronicle, showNotifications = true }: {
  life: LifeState; world: WorldPack; onAdvance(): void; onOpenChronicle(): void; showNotifications?: boolean;
}) {
  const { notifications, dismissNotification } = useEventNotifications(life, world, showNotifications);
  return <section className="life-moment" aria-labelledby="life-moment-title">
    <p className="life-moment-intro" id="life-moment-title">{showNotifications ? "Important life events" : "Your life this year"}</p>
    <div className="event-notifications" role="log" aria-label="Important life events" aria-live="polite" aria-relevant="additions">
      {notifications.map(notification => <article className="event-notification" key={notification.key}>
        <header className="life-moment-heading"><span>{formatYear(notification.year)}</span><h2>{notification.title ?? "Life event"}</h2><button className="event-notification-dismiss" type="button" aria-label={`Dismiss event: ${notification.title ?? notification.text}`} onClick={() => dismissNotification(notification.key)}><PixelIcon name="close" size={14} /></button></header>
        <p className="life-moment-copy">{displayProse(notification.text)}</p>
      </article>)}
    </div>
    {!notifications.length && <p className="life-moment-copy">Your full story is saved in your life record.</p>}
    {life.phase === "ready" && <button className="moment-advance" type="button" onClick={onAdvance}>Live another year <PixelIcon name="arrow" size={16} /></button>}
    <button className="moment-chronicle" type="button" onClick={onOpenChronicle}>Read your life record <span aria-hidden="true">↗</span></button>
  </section>;
}
