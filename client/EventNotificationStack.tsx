import { useEffect, useState, type RefObject } from "react";
import { formatYear } from "../src/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../src/types.ts";
import type { DemoScreen } from "./demo/screen.ts";
import { displayProse } from "./display-prose.ts";
import { contentFingerprint } from "../src/random.ts";
import { eventNotificationLifeKey } from "./event-notifications.ts";
import { readSeenEventNotifications, rememberSeenEventNotifications } from "./event-notification-store.ts";
import { useEventNotifications } from "./useEventNotifications.ts";
import "./event-notifications.css";

interface NotificationItem {
  key: string;
  badge: string;
  age: number;
  year: number;
  title: string;
  body: string;
  kind: "decision" | "offer" | "legacy" | "event";
  actionLabel: string;
  onAction(): void;
  onDismiss?: () => void;
}

function truncateText(text: string, maxLen = 96): string {
  const clean = displayProse(text);
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen - 1).trimEnd() + "…";
}

export default function EventNotificationStack({ life, world, decisionEvent, demoView, decisionButtonRef,
  onOpenDecision, onOpenChronicle, onOpenPeopleTab, visible = true,
}: {
  life: LifeState;
  world: WorldPack;
  decisionEvent?: LifeEvent;
  demoView?: DemoScreen | null;
  decisionButtonRef?: RefObject<HTMLButtonElement | null>;
  onOpenDecision(): void;
  onOpenChronicle(): void;
  onOpenPeopleTab?(): void;
  visible?: boolean;
}) {
  const completed = useEventNotifications(life, world);
  const lifeKey = eventNotificationLifeKey(life);
  const [dismissedOffers, setDismissedOffers] = useState(() => new Set(readSeenEventNotifications(lifeKey)));
  useEffect(() => setDismissedOffers(new Set(readSeenEventNotifications(lifeKey))), [lifeKey]);
  const items: NotificationItem[] = [];

  // Decisions remain actionable until answered; completed notices have their own lifecycle.
  if (life.phase === "choice" && decisionEvent) {
    items.push({
      key: `decision:${life.seed}:${life.age}:${decisionEvent.id}`,
      badge: decisionEvent.rarity === "rare" ? "Rare Encounter" : demoView?.activeOffer ? "Town Offer" : "Turning Point",
      age: life.age, year: life.year, title: displayProse(decisionEvent.title),
      body: truncateText(decisionEvent.text, 105), kind: "decision", actionLabel: "Open decision →", onAction: onOpenDecision,
    });
  }

  if (demoView?.activeOffer) {
    const offer = demoView.activeOffer;
    const key = `offer:${lifeKey}:${life.age}:${contentFingerprint(offer)}`;
    if (!dismissedOffers.has(key)) items.push({
      key, badge: "Contract Offer", age: life.age, year: life.year,
      title: `${offer.role.charAt(0).toUpperCase() + offer.role.slice(1)} offers ${offer.kind.replace("-", " ")}`,
      body: `${offer.quantity} ${offer.item} at ${offer.price} dr each (${offer.total} dr total).`,
      kind: "offer", actionLabel: "View counterparty →", onAction: () => onOpenPeopleTab?.(),
      onDismiss: () => {
        rememberSeenEventNotifications(lifeKey, [key]);
        setDismissedOffers(previous => new Set(previous).add(key));
      },
    });
  }

  for (const event of completed.notifications) {
    const granary = event.marker?.actionId === "farming.stock-granary";
    items.push({
      key: event.key, badge: granary ? "Past-Life Granary" : "Life Event", age: event.age, year: event.year,
      title: granary ? `Granary opened · Life NFT #${event.marker!.tokenId}` : displayProse(event.title ?? event.marker?.actionLabel ?? "Life event"),
      body: truncateText(event.text, 105), kind: granary ? "legacy" : "event", actionLabel: "Life record ↗",
      onAction: onOpenChronicle, onDismiss: () => completed.dismiss(event.key),
    });
  }
  const notifications = items.slice(0, 3);
  if (!visible || !notifications.length) return null;
  return <aside className="event-notification-stack" aria-label="Event notifications" role="region" aria-live="polite" aria-relevant="additions">
    {notifications.map(item => <article key={item.key} className={`event-toast is-${item.kind}`} role={item.kind === "decision" ? "status" : undefined}>
      <div className="event-toast-top">
        <span className={`event-toast-badge is-${item.kind}`}>{item.badge}</span>
        <span className="event-toast-meta">Age {item.age} · {formatYear(item.year)}</span>
        {item.onDismiss && <button type="button" className="event-toast-dismiss" aria-label={`Dismiss ${item.title} notification`} onClick={item.onDismiss}>×</button>}
      </div>
      <strong className="event-toast-title">{item.title}</strong>
      <p className="event-toast-body">{item.body}</p>
      <div className="event-toast-footer"><button ref={item.kind === "decision" ? decisionButtonRef : undefined} type="button" className="event-toast-action" onClick={item.onAction}>{item.actionLabel}</button></div>
    </article>)}
  </aside>;
}
