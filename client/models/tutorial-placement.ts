/** Geometry for the tour: where the spotlight goes and where the card fits on screen. */

/** Class of the tour's own top-layer dialog; other top-layer screens must not lift themselves above it. */
export const TUTORIAL_LAYER_CLASS = "everfolk-tutorial-layer";

export interface Rect { top: number; left: number; width: number; height: number }
export interface Size { width: number; height: number }
export type CardPlacement = "bottom" | "top" | "right" | "left" | "center" | "corner";
export interface CardPosition { top: number; left: number; placement: CardPlacement }

const EDGE = 12;
const GAP = 14;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

/** The smallest rectangle around all `rects`, or null when there are none. */
export function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const top = Math.min(...rects.map(rect => rect.top));
  const left = Math.min(...rects.map(rect => rect.left));
  const bottom = Math.max(...rects.map(rect => rect.top + rect.height));
  const right = Math.max(...rects.map(rect => rect.left + rect.width));
  return { top, left, width: right - left, height: bottom - top };
}

/** The overlap of two rectangles, or null when they do not overlap. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const top = Math.max(a.top, b.top);
  const left = Math.max(a.left, b.left);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  const right = Math.min(a.left + a.width, b.left + b.width);
  return bottom > top && right > left ? { top, left, width: right - left, height: bottom - top } : null;
}

/** The highlighted cut-out: the target plus padding, clipped to the viewport. Null when off screen. */
export function spotlightRect(target: Rect | null, viewport: Size, padding: number): Rect | null {
  if (!target) return null;
  const top = Math.max(0, target.top - padding);
  const left = Math.max(0, target.left - padding);
  const bottom = Math.min(viewport.height, target.top + target.height + padding);
  const right = Math.min(viewport.width, target.left + target.width + padding);
  if (bottom <= top || right <= left) return null;
  return { top, left, width: right - left, height: bottom - top };
}

function fitsVertically(top: number, card: Size, viewport: Size): boolean {
  return top >= EDGE && top + card.height <= viewport.height - EDGE;
}

function fitsHorizontally(left: number, card: Size, viewport: Size): boolean {
  return left >= EDGE && left + card.width <= viewport.width - EDGE;
}

function candidates(target: Rect, card: Size, viewport: Size): CardPosition[] {
  const centeredLeft = clamp(target.left + target.width / 2 - card.width / 2, EDGE, viewport.width - card.width - EDGE);
  const centeredTop = clamp(target.top + target.height / 2 - card.height / 2, EDGE, viewport.height - card.height - EDGE);
  const startLeft = clamp(target.left, EDGE, viewport.width - card.width - EDGE);
  const endLeft = clamp(target.left + target.width - card.width, EDGE, viewport.width - card.width - EDGE);
  const belowTop = target.top + target.height + GAP;
  const aboveTop = target.top - GAP - card.height;
  const right = { top: centeredTop, left: target.left + target.width + GAP, placement: "right" as const };
  const left = { top: centeredTop, left: target.left - GAP - card.width, placement: "left" as const };
  // Beside the target first (centered, then lined up with either edge), so a button under the middle can be dodged.
  const below = [centeredLeft, startLeft, endLeft].map(x => ({ top: belowTop, left: x, placement: "bottom" as const }));
  const above = [centeredLeft, startLeft, endLeft].map(x => ({ top: aboveTop, left: x, placement: "top" as const }));
  return [
    ...(fitsVertically(belowTop, card, viewport) ? below.slice(0, 1) : []),
    ...(fitsVertically(aboveTop, card, viewport) ? above.slice(0, 1) : []),
    ...(fitsHorizontally(right.left, card, viewport) ? [right] : []),
    ...(fitsHorizontally(left.left, card, viewport) ? [left] : []),
    ...(fitsVertically(belowTop, card, viewport) ? below.slice(1) : []),
    ...(fitsVertically(aboveTop, card, viewport) ? above.slice(1) : []),
  ];
}

/** The four corners of the screen, bottom-right first (where a waiting tip has always sat). */
function corners(card: Size, viewport: Size): CardPosition[] {
  const maxLeft = Math.max(0, viewport.width - card.width);
  const maxTop = Math.max(0, viewport.height - card.height);
  const right = clamp(viewport.width - card.width - EDGE, 0, maxLeft);
  const bottom = clamp(viewport.height - card.height - EDGE, 0, maxTop);
  const left = clamp(EDGE, 0, maxLeft);
  const top = clamp(EDGE, 0, maxTop);
  return [[bottom, right], [bottom, left], [top, right], [top, left]].map(([y, x]) => ({ top: y, left: x, placement: "corner" as const }));
}

/** How much of `rects` a card at `position` would cover. */
function coveredArea(position: CardPosition, card: Size, rects: readonly Rect[]): number {
  const box = { top: position.top, left: position.left, width: card.width, height: card.height };
  return rects.reduce((sum, rect) => {
    const overlap = intersectRect(box, rect);
    return sum + (overlap ? overlap.width * overlap.height : 0);
  }, 0);
}

/**
 * The best of `options` (in preference order): one that covers none of the `protect` controls if any does, then the
 * fewest of the page's other controls in `avoid`. Ties keep the preference order.
 */
function leastCovering(options: readonly CardPosition[], card: Size, protect: readonly Rect[], avoid: readonly Rect[]): CardPosition {
  const score = (position: CardPosition) => [coveredArea(position, card, protect), coveredArea(position, card, avoid)] as const;
  return options.reduce((best, next) => {
    const [bestProtected, bestAvoided] = score(best);
    const [nextProtected, nextAvoided] = score(next);
    return nextProtected < bestProtected || (nextProtected === bestProtected && nextAvoided < bestAvoided) ? next : best;
  });
}

/**
 * Places the card beside the target without covering it when there is room (below, above, right, left, then lined up
 * with the target's edges), else in a corner of the screen. Of those places it never takes one over the target or the
 * `protect` controls (the time bar, Resume, Begin life, decision buttons) when another place is free of them, and
 * among the rest it covers the fewest of the page's controls in `avoid`. Without a target it goes to `fallback`
 * unless that covers a protected control. The card always stays fully on screen.
 */
export function placeTutorialCard(target: Rect | null, card: Size, viewport: Size, fallback: "center" | "corner" = "center",
  avoid: readonly Rect[] = [], protect: readonly Rect[] = []): CardPosition {
  const maxLeft = Math.max(0, viewport.width - card.width);
  const maxTop = Math.max(0, viewport.height - card.height);
  const screenCorners = corners(card, viewport);
  if (!target) {
    const center: CardPosition = { top: clamp((viewport.height - card.height) / 2, 0, maxTop), left: clamp((viewport.width - card.width) / 2, 0, maxLeft), placement: "center" };
    return leastCovering(fallback === "center" ? [center, ...screenCorners] : screenCorners, card, protect, fallback === "center" ? [] : avoid);
  }
  const beside = candidates(target, card, viewport).map(best => ({ ...best, top: clamp(best.top, 0, maxTop), left: clamp(best.left, 0, maxLeft) }));
  // The target counts as protected: the card never sits over the section it explains when it can sit elsewhere.
  const guarded = [target, ...protect];
  const clear = (position: CardPosition) => coveredArea(position, card, guarded) === 0;
  // Beside the target when a place there is clear, else a clear corner, else whatever covers the least.
  const tiers = [beside.filter(clear), screenCorners.filter(clear), [...beside, ...screenCorners]];
  return leastCovering(tiers.find(tier => tier.length > 0)!, card, guarded, avoid);
}

export interface ScrollPlan { block: "center" | "start"; marginTop: number }

/** Targets taller than this share of the viewport are scrolled to show their top, not their middle. */
const TALL_SHARE = 0.55;
/** A tall target whose top is within this share of the viewport is left where it is. */
const VISIBLE_TOP_SHARE = 0.6;
/** Room kept above a tall target so sticky headers do not cover it. */
const TOP_ROOM_SHARE = 0.22;

/** The target is fully on screen, below anything pinned to the top (`topInset`, the time bar). */
export function targetOnScreen(target: Rect, viewportHeight: number, topInset = 0): boolean {
  return target.top >= topInset && target.top + target.height <= viewportHeight;
}

/**
 * How to bring a step's target into view: centered when it fits, top first when it is tall. Null: stay, which is
 * always the answer for a target already on screen, so a tip never moves the page the player is looking at.
 */
export function tutorialScrollPlan(target: Rect, viewportHeight: number, topInset = 0): ScrollPlan | null {
  if (targetOnScreen(target, viewportHeight, topInset)) return null;
  if (target.height <= viewportHeight * TALL_SHARE) return { block: "center", marginTop: 0 };
  if (target.top >= 0 && target.top <= viewportHeight * VISIBLE_TOP_SHARE) return null;
  return { block: "start", marginTop: Math.round(viewportHeight * TOP_ROOM_SHARE) };
}

/** Frames the target must stay still (after any opening scroll) before the card is pinned where it is. */
export const CARD_SETTLE_FRAMES = 8;

/**
 * The card's place while it shows: placed beside its target until the target has stood still for a few frames, then
 * pinned, so scrolling the page never moves the card. A pinned card is only re-clamped to stay fully on screen.
 */
export function pinnedCardPosition(pinned: CardPosition, card: Size, viewport: Size): CardPosition {
  const top = clamp(pinned.top, 0, Math.max(0, viewport.height - card.height));
  const left = clamp(pinned.left, 0, Math.max(0, viewport.width - card.width));
  return top === pinned.top && left === pinned.left ? pinned : { ...pinned, top, left };
}
