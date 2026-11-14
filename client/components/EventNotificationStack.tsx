import { useEffect, useState, type RefObject } from "react";
import { formatYear } from "../../src/index.ts";
import type { LifeEvent, LifeState, WorldPack } from "../../src/types.ts";
import type { DemoScreen } from "../demo/screen.ts";
import { displayProse } from "../models/display-prose.ts";
import { contentFingerprint } from "../../src/random.ts";
import { eventNotificationLifeKey, NOTIFICATION_DURATION_MS } from "../models/event-notifications.ts";
import { readSeenEventNotifications, rememberSeenEventNotifications } from "../state/event-notification-store.ts";
import { useEventNotifications } from "../hooks/useEventNotifications.ts";
import { useNoticeClock } from "../hooks/useNoticeClock.ts";
import { learnedThisYear } from "../models/skill-learned-notice.ts";
import "../styles/event-notifications.css";

/** The once-a-year nudge to plan the fields, pick a focus and spend the yearly action. */
export interface YearReminder {
  key: string;
  title: string;
  body: string;
}

interface ActionItem {
  key: string;
  badge: string;
  age: number;
  year: number;
  title: string;
  body: string;
  kind: "decision" | "offer";
  actionLabel: string;
  onAction(): void;
  onDismiss?: () => void;
}

/** A notice that needs nothing from the player: text only, gone after a few seconds. */
interface InfoItem {
  key: string;
  badge: string;
  age: number;
  year: number;
  title: string;
  body: string;
  kind: "event" | "legacy" | "skill" | "reminder";
  expiresAt: number;
}

const MAX_SHOWN = 3;

/** Shortens at a sentence or word, never mid-word, so a notice always reads as words. */
function truncateText(text: string, maxLen = 96): string {
  const clean = displayProse(text);
  if (clean.length <= maxLen) return clean;
  const sentence = clean.match(/^.+?[.!?](?=\s|$)/)?.[0];
  if (sentence && sentence.length <= maxLen) return sentence;
  const cut = clean.slice(0, maxLen - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > maxLen * .5 ? cut.slice(0, space) : cut).replace(/[\s,;:]+$/, "")}…`;
}

/** A thin bar that drains while the notice is on screen. Its length is fixed when the notice first appears. */
function FadeTimer({ expiresAt }: { expiresAt: number }) {
  const [duration] = useState(() => Math.max(0, Math.min(NOTIFICATION_DURATION_MS, expiresAt - Date.now())));
  return <span className="event-toast-timer" aria-hidden="true"><span style={{ animationDuration: `${duration}ms` }} /></span>;
}

function InfoToast({ item }: { item: InfoItem }) {
  return <article className={`event-toast is-info is-${item.kind}`}>
    <div className="event-toast-top">
      <span className={`event-toast-badge is-${item.kind}`}>{item.badge}</span>
      <span className="event-toast-meta">Age {item.age} · {formatYear(item.year)}</span>
    </div>
    <strong className="event-toast-title">{item.title}</strong>
    {item.body && <p className="event-toast-body">{item.body}</p>}
    <FadeTimer expiresAt={item.expiresAt} />
  </article>;
}

function ActionToast({ item, buttonRef }: { item: ActionItem; buttonRef?: RefObject<HTMLButtonElement | null> }) {
  return <article className={`event-toast is-${item.kind}`} role={item.kind === "decision" ? "status" : undefined}>
    <div className="event-toast-top">
      <span className={`event-toast-badge is-${item.kind}`}>{item.badge}</span>
      <span className="event-toast-meta">Age {item.age} · {formatYear(item.year)}</span>
      {item.onDismiss && <button type="button" className="event-toast-dismiss" aria-label={`Dismiss ${item.title} notification`} onClick={item.onDismiss}>×</button>}
    </div>
    <strong className="event-toast-title">{item.title}</strong>
    <p className="event-toast-body">{item.body}</p>
    <div className="event-toast-footer"><button ref={buttonRef} type="button" className="event-toast-action" onClick={item.onAction}>{item.actionLabel}</button></div>
  </article>;
}

export default function EventNotificationStack({ life, world, decisionEvent, demoView, decisionButtonRef, reminder = null,
  onOpenDecision, onOpenPeopleTab, onShownChange, visible = true, persistent = true, decisionOpen = false,
}: {
  /** The decision window is open: its notice would only repeat it. */
  decisionOpen?: boolean;
  life: LifeState;
  world: WorldPack;
  decisionEvent?: LifeEvent;
  demoView?: DemoScreen | null;
  decisionButtonRef?: RefObject<HTMLButtonElement | null>;
  reminder?: YearReminder | null;
  onOpenDecision(): void;
  onOpenPeopleTab?(): void;
  /** Reports whether any notification is on screen (the tutorial explains them the first time). */
  onShownChange?(shown: boolean): void;
  visible?: boolean;
  /** False for preview lives: nothing about which notices were seen is saved. */
  persistent?: boolean;
}) {
  const completed = useEventNotifications(life, world, true, persistent);
  const lifeKey = eventNotificationLifeKey(life);
  // Offers the player closed, and skills already announced, stay closed for this life.
  const [dismissedKeys, setDismissedKeys] = useState(() => new Set(persistent ? readSeenEventNotifications(lifeKey) : []));
  useEffect(() => setDismissedKeys(new Set(persistent ? readSeenEventNotifications(lifeKey) : [])), [lifeKey, persistent]);
  const dismissKey = (key: string) => () => {
    if (persistent) rememberSeenEventNotifications(lifeKey, [key]);
    setDismissedKeys(previous => new Set(previous).add(key));
  };

  const skills = learnedThisYear(life, world).filter(skill => !dismissedKeys.has(skill.key));
  const actions: ActionItem[] = [];
  // Decisions remain actionable until answered.
  if (life.phase === "choice" && decisionEvent && !decisionOpen) {
    actions.push({
      key: `decision:${life.seed}:${life.age}:${decisionEvent.id}`,
      badge: decisionEvent.rarity === "rare" ? "Rare Encounter" : demoView?.activeOffer ? "Town Offer" : "Turning Point",
      age: life.age, year: life.year, title: displayProse(decisionEvent.title),
      body: truncateText(decisionEvent.text, 105), kind: "decision", actionLabel: "Open decision →", onAction: onOpenDecision,
    });
  }
  if (demoView?.activeOffer) {
    const offer = demoView.activeOffer;
    const key = `offer:${lifeKey}:${life.age}:${contentFingerprint(offer)}`;
    if (!dismissedKeys.has(key)) actions.push({
      key, badge: "Contract Offer", age: life.age, year: life.year,
      title: `${offer.role.charAt(0).toUpperCase() + offer.role.slice(1)} offers ${offer.kind.replace("-", " ")}`,
      body: `${offer.quantity} ${offer.item} at ${offer.price} dr each (${offer.total} dr total).`,
      kind: "offer", actionLabel: "View counterparty →", onAction: () => onOpenPeopleTab?.(), onDismiss: dismissKey(key),
    });
  }

  // A timed notice starts its clock only once it is actually drawn (the page is in view and a slot is free), so a
  // hidden dashboard or a full stack never uses up a skill notice unseen. Once drawn, it is remembered for reloads.
  const freeSlots = Math.max(0, MAX_SHOWN - Math.min(MAX_SHOWN, actions.length));
  const timedKeys = visible ? [...(reminder ? [reminder.key] : []), ...skills.map(skill => skill.key)].slice(0, freeSlots) : [];
  const { live, clock } = useNoticeClock(timedKeys, NOTIFICATION_DURATION_MS,
    keys => { if (persistent) rememberSeenEventNotifications(lifeKey, keys.filter(key => key !== reminder?.key)); });
  const expiry = (key: string) => clock.get(key) ?? Date.now() + NOTIFICATION_DURATION_MS;

  const infos: InfoItem[] = [];
  if (reminder && live.has(reminder.key)) infos.push({ key: reminder.key, badge: "New year", age: life.age, year: life.year,
    title: reminder.title, body: reminder.body, kind: "reminder", expiresAt: expiry(reminder.key) });
  for (const skill of skills) if (live.has(skill.key)) infos.push({ key: skill.key, badge: "Skill learned", age: skill.age, year: skill.year,
    title: skill.title, body: "", kind: "skill", expiresAt: expiry(skill.key) });
  for (const event of completed.notifications) {
    // The ending has its own banner at the top of the page.
    if (event.kind === "ending") continue;
    const granary = event.marker?.actionId === "farming.stock-granary";
    infos.push({
      key: event.key, badge: granary ? "Past-Life Granary" : "Life Event", age: event.age, year: event.year,
      title: granary ? `Granary opened · Life NFT #${event.marker!.tokenId}` : displayProse(event.title ?? event.marker?.actionLabel ?? "Life event"),
      body: truncateText(event.text, 90), kind: granary ? "legacy" : "event", expiresAt: event.expiresAt,
    });
  }

  const shownActions = actions.slice(0, MAX_SHOWN);
  const shownInfos = infos.slice(0, Math.max(0, MAX_SHOWN - shownActions.length));
  const shown = visible && shownActions.length + shownInfos.length > 0;
  useEffect(() => { onShownChange?.(shown); }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onShownChange?.(false), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  return <aside className="event-notification-stack" aria-label="Event notifications" role="region" aria-live="polite" aria-relevant="additions">
    {shownActions.map(item => <ActionToast key={item.key} item={item} buttonRef={item.kind === "decision" ? decisionButtonRef : undefined} />)}
    {shownInfos.map(item => <InfoToast key={item.key} item={item} />)}
  </aside>;
}
