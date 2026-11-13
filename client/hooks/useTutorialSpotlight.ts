import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { intersectRect, placeTutorialCard, spotlightRect, tutorialScrollPlan, unionRect, type CardPosition, type Rect } from "../models/tutorial-placement.ts";
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
  /** Automatic hints scroll nothing: the player keeps their place in the game. */
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

/** Scrolls once; a tall target gets a temporary scroll margin so its top clears sticky headers. */
function bringIntoView({ first, rect }: Found, viewportHeight: number, behavior: ScrollBehavior): void {
  const plan = tutorialScrollPlan(rect, viewportHeight);
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

/**
 * Finds the hint's section, scrolls it into view once when the player asked, and keeps the spotlight and card
 * positioned on every frame while the hint is shown, so scrolling, resizing and layout changes are followed.
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
      const placed = placeTutorialCard(spotlight, size, viewport, (missing || offscreen) && waitForTarget ? "corner" : "center");
      const next: TutorialLayout = { spotlight, card: { ...placed, top: Math.round(placed.top), left: Math.round(placed.left) }, missing, ready: !searching, offscreen };
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
