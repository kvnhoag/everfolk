import { useEffect, useState, type RefObject } from "react";
import { formatYear } from "../../src/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../../src/types.ts";
import type { DemoScreen } from "../demo/screen.ts";
import { displayProse } from "../models/display-prose.ts";
import { contentFingerprint } from "../../src/random.ts";
import { eventNotificationLifeKey } from "../models/event-notifications.ts";
import { readSeenEventNotifications, rememberSeenEventNotifications } from "../state/event-notification-store.ts";
import { useEventNotifications } from "../hooks/useEventNotifications.ts";
import { learnedThisYear } from "../models/skill-learned-notice.ts";
import "../styles/event-notifications.css";

interface NotificationItem {
  key: string;
  badge: string;
  age: number;
  year: number;
  title: string;
  body: string;
  kind: "decision" | "offer" | "legacy" | "event" | "skill";
  actionLabel: string;
  onAction(): void;
  onDismiss?: () => void;
}

function truncateText(text: string, maxLen = 96): string {
  const clean = displayProse(text);
  return clean.length <= maxLen ? clean : clean.slice(0, maxLen - 1).trimEnd() + "…";
}

export default function EventNotificationStack({ life, world, decisionEvent, demoView, decisionButtonRef,
  onOpenDecision, onOpenChronicle, onOpenPeopleTab, onOpenSkillTree, visible = true,
}: {
  life: LifeState;
  world: WorldPack;
  decisionEvent?: LifeEvent;
  demoView?: DemoScreen | null;
  decisionButtonRef?: RefObject<HTMLButtonElement | null>;
  onOpenDecision(): void;
  onOpenChronicle(): void;
  onOpenPeopleTab?(): void;
  onOpenSkillTree?(): void;
  visible?: boolean;
}) {
  const completed = useEventNotifications(life, world);
  const lifeKey = eventNotificationLifeKey(life);
  // Offers and skill notices the player closed stay closed for this life.
  const [dismissedKeys, setDismissedKeys] = useState(() => new Set(readSeenEventNotifications(lifeKey)));
  useEffect(() => setDismissedKeys(new Set(readSeenEventNotifications(lifeKey))), [lifeKey]);
  const dismissKey = (key: string) => () => {
    rememberSeenEventNotifications(lifeKey, [key]);
    setDismissedKeys(previous => new Set(previous).add(key));
  };
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

  // Skills learned this year, with a direct way into the skill tree.
  if (onOpenSkillTree) for (const skill of learnedThisYear(life, world)) {
    if (dismissedKeys.has(skill.key)) continue;
    items.push({
      key: skill.key, badge: "Skill learned", age: skill.age, year: skill.year,
      title: skill.title, body: "A new skill is yours. See what it opens next in the skill tree.",
      kind: "skill", actionLabel: "Open skill tree →", onAction: onOpenSkillTree, onDismiss: dismissKey(skill.key),
    });
  }

  if (demoView?.activeOffer) {
    const offer = demoView.activeOffer;
    const key = `offer:${lifeKey}:${life.age}:${contentFingerprint(offer)}`;
    if (!dismissedKeys.has(key)) items.push({
      key, badge: "Contract Offer", age: life.age, year: life.year,
      title: `${offer.role.charAt(0).toUpperCase() + offer.role.slice(1)} offers ${offer.kind.replace("-", " ")}`,
      body: `${offer.quantity} ${offer.item} at ${offer.price} dr each (${offer.total} dr total).`,
      kind: "offer", actionLabel: "View counterparty →", onAction: () => onOpenPeopleTab?.(), onDismiss: dismissKey(key),
    });
  }

  for (const event of completed.notifications) {
    // The ending has its own banner at the top of the page.
    if (event.kind === "ending") continue;
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
