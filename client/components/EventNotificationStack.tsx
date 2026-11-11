import { useMemo, useState, type RefObject } from "react";
import { formatYear } from "../../src/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../../src/types.ts";
import type { DemoScreen } from "../demo/screen.ts";
import { displayProse } from "../models/display-prose.ts";
import { useEventNotifications } from "../hooks/useEventNotifications.ts";
import { eventNotificationLifeKey } from "../models/event-notifications.ts";
import { readSeenEventNotifications, rememberSeenEventNotifications } from "../state/event-notification-store.ts";
import "../styles/event-notifications.css";

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
}

function truncateText(text: string, maxLen = 96): string {
  const clean = displayProse(text);
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen - 1).trimEnd() + "…";
}

export default function EventNotificationStack({
  life,
  world,
  decisionEvent,
  demoView,
  decisionButtonRef,
  onOpenDecision,
  onOpenChronicle,
  onOpenPeopleTab,
}: {
  life: LifeState;
  world: WorldPack;
  decisionEvent?: LifeEvent;
  demoView?: DemoScreen | null;
  decisionButtonRef?: RefObject<HTMLButtonElement | null>;
  onOpenDecision(): void;
  onOpenChronicle(): void;
  onOpenPeopleTab?(): void;
}) {
  const { notifications: completed, dismissNotification } = useEventNotifications(life, world);
  const lifeKey = eventNotificationLifeKey(life);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set());
  const dismissed = new Set([...dismissedKeys, ...readSeenEventNotifications(lifeKey)]);
  function dismissItem(item: NotificationItem) {
    if (item.kind === "event") dismissNotification(item.key);
    else {
      setDismissedKeys(previous => new Set(previous).add(item.key));
      rememberSeenEventNotifications(lifeKey, [item.key]);
    }
  }

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    // 1. Active turning point / pending decision
    if (life.phase === "choice" && decisionEvent) {
      items.push({
        key: `decision:${life.seed}:${life.age}:${decisionEvent.id}`,
        badge:
          decisionEvent.rarity === "rare"
            ? "Rare Encounter"
            : demoView?.activeOffer
              ? "Town Offer"
              : "Turning Point",
        age: life.age,
        year: life.year,
        title: displayProse(decisionEvent.title),
        body: truncateText(decisionEvent.text, 105),
        kind: "decision",
        actionLabel: "Open decision →",
        onAction: onOpenDecision,
      });
    }

    // 2. Active town offer (if not already the pending decision)
    if (demoView?.activeOffer) {
      const offer = demoView.activeOffer;
      const offerKey = `offer:${life.seed}:${life.age}:${offer.role}:${offer.kind}`;
      if (!dismissed.has(offerKey)) {
        items.push({
          key: offerKey,
          badge: "Contract Offer",
          age: life.age,
          year: life.year,
          title: `${offer.role.charAt(0).toUpperCase() + offer.role.slice(1)} offers ${offer.kind.replace("-", " ")}`,
          body: `${offer.quantity} ${offer.item} at ${offer.price} dr each (${offer.total} dr total).`,
          kind: "offer",
          actionLabel: "View counterparty →",
          onAction: () => onOpenPeopleTab?.(),
        });
      }
    }

    // 3. Cross-life granary arrival
    if (demoView?.legacyHelp?.length) {
      for (const help of demoView.legacyHelp) {
        const legacyKey = `legacy:${life.seed}:${help.age}:${help.tokenId}`;
        if (!dismissed.has(legacyKey)) {
          items.push({
            key: legacyKey,
            badge: "Past-Life Granary",
            age: help.age,
            year: life.year - (life.age - help.age),
            title: `Granary opened · Life NFT #${help.tokenId}`,
            body: truncateText(help.text, 96),
            kind: "legacy",
            actionLabel: "View in record ↗",
            onAction: onOpenChronicle,
          });
        }
      }
    }

    // Completed facts share the persistent thirty-second lifecycle of classic play.
    for (const event of completed) {
      if (event.kind === "ending") continue;
      items.push({
        key: event.key, badge: "Life Event", age: life.journal.find(entry => entry.year === event.year)?.age ?? life.age,
        year: event.year, title: displayProse(event.title ?? "Recorded event"), body: truncateText(event.text, 92),
        kind: "event", actionLabel: "Life record ↗", onAction: onOpenChronicle,
      });
    }

    return items.slice(0, 3);
  }, [life, world, decisionEvent, demoView, dismissedKeys, completed, onOpenDecision, onOpenChronicle, onOpenPeopleTab]);

  if (notifications.length === 0) return null;

  return (
    <aside className="event-notification-stack" aria-label="Event notifications" role="region">
      {notifications.map(item => (
        <article
          key={item.key}
          className={`event-toast is-${item.kind}`}
          role={item.kind === "decision" ? "status" : undefined}
        >
          <div className="event-toast-top">
            <span className={`event-toast-badge is-${item.kind}`}>{item.badge}</span>
            <span className="event-toast-meta">
              Age {item.age} · {formatYear(item.year)}
            </span>
            {item.kind !== "decision" && (
              <button
                type="button"
                className="event-toast-dismiss"
                aria-label={`Dismiss ${item.title} notification`}
                onClick={() => dismissItem(item)}
              >
                ×
              </button>
            )}
          </div>
          <strong className="event-toast-title">{item.title}</strong>
          <p className="event-toast-body">{item.body}</p>
          <div className="event-toast-footer">
            <button
              ref={item.kind === "decision" ? decisionButtonRef : undefined}
              type="button"
              className="event-toast-action"
              onClick={item.onAction}
            >
              {item.actionLabel}
            </button>
          </div>
        </article>
      ))}
    </aside>
  );
}
