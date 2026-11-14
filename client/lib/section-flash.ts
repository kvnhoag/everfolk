/**
 * Draws the player's eye to one section at a time: the page scrolls to it, its border lights up, the rest of the page
 * dims, and a "Look here" label with an arrow sits on it saying what it is and why. Then all of it fades. Sections
 * asked for together wait their turn instead of glowing at once. The view never moves without that label.
 *
 * A section is never lit while it cannot be used (locked, greyed out or unclickable), and nothing is lit while a tip
 * card or a popup has the player's attention; those requests wait until the screen is free.
 * Used when tips are off (a new section glows instead of opening a card), for the yearly reminder, and when the
 * player picks a line in "This year".
 */

import { spotlightSection } from "./section-spotlight.ts";
import { tipShownStore } from "../state/tip-shown.ts";

export const SECTION_FLASH_CLASS = "section-flash";
/** How long a section glows before the effect has faded completely. */
export const SECTION_FLASH_MS = 10_000;
/** A section that renders a moment after its stage begins gets a few more tries to be found. */
const RETRY_MS = 150;
const RETRIES = 8;
/** While a tip or popup is open, a waiting request checks again this often. */
const BUSY_RETRY_MS = 500;
/** A short breath between one lit section and the next. */
const BETWEEN_MS = 600;

export interface FocusOptions {
  durationMs?: number;
  /** The player asked for this one (a click): it replaces whatever is waiting and shows at once. */
  asked?: boolean;
}

/** A section to bring into focus, and the words shown on it: what it is and why the player is looking. */
export interface FocusTarget { selectors: readonly string[]; label: string }

interface Request { selectors: readonly string[]; label: string; durationMs: number; asked: boolean; tries: number; owner: symbol }
interface Active { element: Element; timer: number; request: Request; callout: HTMLElement | null; frame: number }

let queue: Request[] = [];
let active: Active | null = null;
let pumpTimer = 0;
let listening = false;

/** Locked, greyed-out or unclickable sections are never pointed at. */
export function actionable(element: Element): boolean {
  if (element.closest(".section-locked, .locked-area, [inert], [aria-hidden='true']")) return false;
  const lock = element.querySelector(".locked-area, .section-locked");
  if (!lock) return true;
  // A lock covering most of the section makes the whole section unavailable.
  const box = element.getBoundingClientRect(), covered = lock.getBoundingClientRect();
  return covered.height < box.height * 0.5;
}

function visible(element: Element): boolean {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

function matches(selector: string): Element[] {
  try { return Array.from(document.querySelectorAll(selector)).filter(element => visible(element) && actionable(element)); }
  catch { return []; }
}

/** The first selector alternative that has anything usable on screen, as hints pick their targets. */
export function firstMatching(alternatives: readonly string[]): Element[] {
  for (const selector of alternatives) {
    const found = matches(selector);
    if (found.length) return found;
  }
  return [];
}

/** An open popup that does not contain the section covers it. */
function popupOver(element: Element): boolean {
  return Array.from(document.querySelectorAll("dialog[open]")).some(dialog => {
    try { return dialog.matches(":modal") && !dialog.contains(element); } catch { return false; }
  });
}

/** A tip card on screen or an open popup owns the player's attention. */
function busy(): boolean {
  if (tipShownStore.get()) return true;
  return Array.from(document.querySelectorAll("dialog[open]")).some(dialog => {
    try { return dialog.matches(":modal"); } catch { return false; }
  });
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Where the time bar pinned to the top of the screen ends; 0 when there is none. */
function pinnedBarBottom(): number {
  if (typeof document.querySelector !== "function") return 0;
  return Math.max(0, document.querySelector(".life-session-bar")?.getBoundingClientRect().bottom ?? 0);
}

/** Brings the section into view unless it is already fully on screen (below the pinned time bar). */
function bringIntoView(element: Element): void {
  const box = element.getBoundingClientRect();
  const height = document.documentElement.clientHeight || window.innerHeight;
  const covered = element.closest?.(".life-session-bar") ? 0 : pinnedBarBottom();
  if (box.top >= covered && box.bottom <= height) return;
  const tall = box.height > height * 0.7;
  element.scrollIntoView({ block: tall ? "start" : "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/** The "Look here" label: an arrow and words, kept on the section's top edge (or below it near the top of the screen). */
function showCallout(element: Element, label: string): { callout: HTMLElement | null; frame: number } {
  if (typeof document.createElement !== "function") return { callout: null, frame: 0 };
  const callout = document.createElement("div");
  callout.className = "focus-callout";
  callout.setAttribute("role", "status");
  callout.textContent = label;
  document.body.appendChild(callout);
  let frame = 0;
  const follow = () => {
    // A popup opening over the page takes the player's attention: the focus behind it ends at once.
    if (popupOver(element)) { finish(); return; }
    const box = element.getBoundingClientRect();
    // The pinned time bar covers the top of the screen: a label that would sit under it goes below the section's top.
    const below = box.top < pinnedBarBottom() + 56;
    callout.classList.toggle("is-below", below);
    callout.style.left = `${Math.round(Math.max(12, box.left + Math.min(box.width / 2, 160)))}px`;
    callout.style.top = `${Math.round(below ? box.bottom + 12 : box.top - 12)}px`;
    frame = window.requestAnimationFrame(follow);
    if (active?.callout === callout) active.frame = frame;
  };
  follow();
  return { callout, frame };
}

function finish(): void {
  if (!active) return;
  window.clearTimeout(active.timer);
  window.cancelAnimationFrame(active.frame);
  active.callout?.remove();
  active.element.classList.remove(SECTION_FLASH_CLASS);
  active = null;
  schedule(BETWEEN_MS);
}

function onPointerDown(event: Event): void {
  // A click ends the current light, so the next waiting section can have its turn.
  if (active && !(event.target instanceof Node && active.element.contains(event.target))) finish();
}

function listen(): void {
  if (listening || typeof window === "undefined") return;
  window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
  listening = true;
}

function light(element: Element, request: Request): void {
  bringIntoView(element);
  // Restart the animation when a section that is still glowing is lit again.
  element.classList.remove(SECTION_FLASH_CLASS);
  void (element as HTMLElement).offsetWidth;
  (element as HTMLElement).style?.setProperty("--section-flash-ms", `${request.durationMs}ms`);
  element.classList.add(SECTION_FLASH_CLASS);
  spotlightSection(element, request.durationMs);
  active = { element, request, timer: window.setTimeout(finish, request.durationMs), callout: null, frame: 0 };
  const { callout, frame } = showCallout(element, request.label);
  active.callout = callout;
  active.frame = frame;
}

function schedule(delay: number): void {
  window.clearTimeout(pumpTimer);
  pumpTimer = window.setTimeout(pump, delay);
}

function pump(): void {
  if (active || queue.length === 0) return;
  const request = queue[0];
  if (!request.asked && busy()) { schedule(BUSY_RETRY_MS); return; }
  const [element] = firstMatching(request.selectors);
  if (!element) {
    // Not drawn yet (or not usable now): a few more tries, then it is dropped.
    if (request.tries++ < RETRIES) { schedule(RETRY_MS); return; }
    queue = queue.slice(1);
    schedule(0);
    return;
  }
  queue = queue.slice(1);
  light(element, request);
}

/**
 * Lights each section, one after another, with its label. Returns a function that withdraws the ones still waiting.
 */
export function flashSections(sections: readonly FocusTarget[], durationMs = SECTION_FLASH_MS, options: Omit<FocusOptions, "durationMs"> = {}): () => void {
  if (typeof document === "undefined") return () => {};
  listen();
  const owner = Symbol("focus");
  const asked = Boolean(options.asked);
  const requests = sections.filter(section => section.selectors.length > 0).map(section => ({ selectors: section.selectors, label: section.label, durationMs, asked, tries: 0, owner }));
  if (requests.length === 0) return () => {};
  if (asked) {
    queue = [...requests, ...queue.filter(request => !request.asked)];
    if (active) finish();
  } else {
    queue = [...queue, ...requests];
  }
  schedule(0);
  return () => { queue = queue.filter(request => request.owner !== owner); };
}

/** Scrolls to one section and lights it at once, with its label, because the player asked (a checklist line, a button). */
export function focusSection(target: FocusTarget, durationMs = 4000): void {
  flashSections([target], durationMs, { asked: true });
}

/** For tests: forget everything waiting or lit. */
export function resetSectionFocus(): void {
  if (active) { window.clearTimeout(active.timer); window.cancelAnimationFrame(active.frame); active.callout?.remove(); active.element.classList.remove(SECTION_FLASH_CLASS); }
  active = null;
  queue = [];
  if (typeof window !== "undefined") window.clearTimeout(pumpTimer);
}
