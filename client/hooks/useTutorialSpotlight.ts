import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { CARD_SETTLE_FRAMES, intersectRect, pinnedCardPosition, placeTutorialCard, spotlightRect, tutorialScrollPlan, unionRect, type CardPosition, type Rect } from "../models/tutorial-placement.ts";
import type { TutorialHint } from "../models/tutorial-hints.ts";

export interface TutorialLayout {
  spotlight: Rect | null;
  card: CardPosition;
  /** The hint's section is not on screen; the card explains it instead. */
  missing: boolean;
  /** False while the card is still waiting for its section to appear. */
  ready: boolean;
  /** The section is drawn but scrolled out of view; the card offers to show it. */
  offscreen: boolean;
}

export interface SpotlightOptions {
  /** Automatic hints wait for their section instead of showing a card about something not drawn. */
  waitForTarget: boolean;
  /** Scroll once to a section that opens off screen; a section already in view never moves the page. */
  scroll: boolean;
}

/** How long an opened hint waits for its section to render before explaining it without a highlight. */
const SEARCH_MS = 900;
const PADDING = 8;
const FALLBACK_CARD = { width: 360, height: 240 };
const INITIAL: TutorialLayout = { spotlight: null, card: { top: 0, left: 0, placement: "center" }, missing: false, ready: false, offscreen: false };

interface Found {
  first: Element;
  /** All matches together, for scrolling. */
  rect: Rect;
  /** The part actually visible inside scrolling popups and panels; null while scrolled out of view. */
  visible: Rect | null;
}

function toRect(box: DOMRect): Rect {
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

const clippersByElement = new WeakMap<Element, Element[]>();

/** Ancestors that clip their content (scrolling popups and panels). Cached per element. */
function clippingAncestors(element: Element): Element[] {
  const cached = clippersByElement.get(element);
  if (cached) return cached;
  const clippers: Element[] = [];
  for (let node = element.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (/auto|scroll|hidden|clip/.test(`${style.overflowX} ${style.overflowY}`)) clippers.push(node);
  }
  clippersByElement.set(element, clippers);
  return clippers;
}

function visibleMatches(selector: string): { element: Element; rect: Rect; visible: Rect | null }[] {
  let nodes: NodeListOf<Element>;
  try { nodes = document.querySelectorAll(selector); }
  catch { return []; }
  return Array.from(nodes).flatMap(element => {
    const rect = toRect(element.getBoundingClientRect());
    if (rect.width <= 0 || rect.height <= 0) return [];
    const visible = clippingAncestors(element).reduce<Rect | null>((clip, ancestor) => clip && intersectRect(clip, toRect(ancestor.getBoundingClientRect())), rect);
    return [{ element, rect, visible }];
  });
}

/** The first selector alternative with anything rendered wins; all of its matches are highlighted together. */
function findTarget(targets: readonly string[]): Found | null {
  for (const selector of targets) {
    const matches = visibleMatches(selector);
    const rect = unionRect(matches.map(match => match.rect));
    if (rect) return { first: matches[0].element, rect, visible: unionRect(matches.flatMap(match => match.visible ? [match.visible] : [])) };
  }
  return null;
}

function sameLayout(a: TutorialLayout, b: TutorialLayout): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function round(rect: Rect | null): Rect | null {
  return rect && { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) };
}

/** Where the time bar pinned to the top of the screen ends (0 without one, or when the target is the bar itself). */
function pinnedBarBottom(target: Element): number {
  const bar = document.querySelector(".life-session-bar");
  if (!bar || bar.contains(target)) return 0;
  return Math.max(0, bar.getBoundingClientRect().bottom);
}

/**
 * Scrolls only when the target is off screen (or hidden inside a scrolled popup); a tall target gets a temporary
 * scroll margin so its top clears sticky headers. A target already in view never moves the page.
 */
function bringIntoView({ first, rect, visible }: Found, viewportHeight: number, behavior: ScrollBehavior): void {
  const plan = tutorialScrollPlan(rect, viewportHeight, pinnedBarBottom(first)) ?? (visible ? null : { block: "center" as const, marginTop: 0 });
  if (!plan) return;
  const element = first as HTMLElement;
  const previousMargin = element.style?.scrollMarginTop ?? "";
  if (plan.marginTop && element.style) element.style.scrollMarginTop = `${plan.marginTop}px`;
  element.scrollIntoView({ block: plan.block, inline: "nearest", behavior });
  if (plan.marginTop && element.style) element.style.scrollMarginTop = previousMargin;
}

export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const CONTROLS = "button:not([disabled]), a[href], input:not([type=hidden]), select, textarea, [role=button], [role=switch], [role=tab]";
/** How often the page's controls are measured again while a card is shown. */
const CONTROLS_EVERY_MS = 400;

/** Controls a tip card must never cover while another place is free: the time bar, Resume, Begin life, decisions. */
const PROTECTED = [
  ".life-session-bar", ".session-play", ".birth-popover-continue", ".ef-home-primary", ".turning-point-button",
  ".life-decision-dialog[open] button", ".life-decision-dialog[open] [role=button]",
].join(", ");

/** The visible `selector` matches the card should not cover (not its own), measured at most every few hundred ms. */
function controlRects(selector: string = CONTROLS): { read(card: HTMLElement | null, viewport: { width: number; height: number }, fresh?: boolean): Rect[] } {
  let cached: Rect[] = [];
  let at = -Infinity;
  return {
    read(card, viewport, fresh = false) {
      const now = performance.now();
      if (!fresh && now - at < CONTROLS_EVERY_MS) return cached;
      at = now;
      cached = Array.from(document.querySelectorAll(selector)).flatMap(element => {
        if (card?.contains(element) || element.closest("[inert], [aria-hidden=true]")) return [];
        const box = element.getBoundingClientRect();
        if (box.width <= 0 || box.height <= 0 || box.bottom <= 0 || box.right <= 0 || box.top >= viewport.height || box.left >= viewport.width) return [];
        return [{ top: box.top, left: box.left, width: box.width, height: box.height }];
      });
      return cached;
    },
  };
}

/**
 * Finds the hint's section, scrolls it into view once when it opens off screen, and keeps the spotlight on it every
 * frame. The card is placed beside the section, then pinned once the section stands still, so it never jumps while
 * the player scrolls; only a resized window places it again.
 */
export function useTutorialSpotlight(hint: TutorialHint | undefined, hintKey: string, cardRef: RefObject<HTMLElement | null>, { waitForTarget, scroll }: SpotlightOptions): TutorialLayout & { reveal(): void } {
  const [layout, setLayout] = useState<TutorialLayout>(INITIAL);
  const target = useRef<Found | null>(null);
  useLayoutEffect(() => {
    if (!hint) return;
    const startedAt = performance.now();
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    let everFound = false;
    let frame = 0;
    let previous = INITIAL;
    // Once its target stands still the card is pinned: scrolling the page afterwards never moves it.
    let pinned: { card: CardPosition; width: number; height: number; missing: boolean } | null = null;
    let stillFrames = 0;
    let lastSpot = "";
    const controls = controlRects();
    const guarded = controlRects(PROTECTED);
    const tick = () => {
      const found = findTarget(hint.targets);
      target.current = found;
      const viewport = { width: document.documentElement.clientWidth || window.innerWidth, height: document.documentElement.clientHeight || window.innerHeight };
      if (found && !everFound && scroll) bringIntoView(found, viewport.height, behavior);
      if (found) everFound = true;
      const waiting = waitForTarget ? !everFound : performance.now() - startedAt < SEARCH_MS;
      const searching = !found && hint.targets.length > 0 && waiting;
      const card = cardRef.current;
      const size = card && card.offsetWidth > 0 ? { width: card.offsetWidth, height: card.offsetHeight } : FALLBACK_CARD;
      const spotlight = round(spotlightRect(found?.visible ?? null, viewport, PADDING));
      const missing = !found && !searching && hint.targets.length > 0;
      const offscreen = Boolean(found) && !spotlight;
      // Only a target in view (or one truly missing) can settle: one still scrolling in is not counted.
      const spotKey = `${JSON.stringify(spotlight)}:${missing}`;
      const settling = (spotlight !== null || missing) && !searching;
      stillFrames = settling && spotKey === lastSpot ? stillFrames + 1 : 0;
      lastSpot = spotKey;
      // A resized window, or a target that appears or vanishes, places the card again.
      if (pinned && (pinned.width !== viewport.width || pinned.height !== viewport.height || pinned.missing !== missing)) pinned = null;
      const pinning = !pinned && card !== null && card.offsetWidth > 0 && stillFrames >= CARD_SETTLE_FRAMES;
      const placed = pinned ? pinnedCardPosition(pinned.card, size, viewport)
        : placeTutorialCard(spotlight, size, viewport, (missing || offscreen) && waitForTarget ? "corner" : "center", controls.read(card, viewport, pinning), guarded.read(card, viewport, pinning));
      const position = { ...placed, top: Math.round(placed.top), left: Math.round(placed.left) };
      if (pinning) pinned = { card: position, ...viewport, missing };
      const next: TutorialLayout = { spotlight, card: position, missing, ready: !searching, offscreen };
      if (!sameLayout(next, previous)) {
        previous = next;
        setLayout(next);
      }
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [hintKey]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Scrolls the section into view, only when the player asks. */
  const reveal = useCallback(() => {
    const found = target.current;
    if (found) bringIntoView(found, document.documentElement.clientHeight || window.innerHeight, prefersReducedMotion() ? "auto" : "smooth");
  }, []);
  return { ...layout, reveal };
}
