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
  const below = { top: target.top + target.height + GAP, left: centeredLeft, placement: "bottom" as const };
  const above = { top: target.top - GAP - card.height, left: centeredLeft, placement: "top" as const };
  const right = { top: centeredTop, left: target.left + target.width + GAP, placement: "right" as const };
  const left = { top: centeredTop, left: target.left - GAP - card.width, placement: "left" as const };
  return [
    ...(fitsVertically(below.top, card, viewport) ? [below] : []),
    ...(fitsVertically(above.top, card, viewport) ? [above] : []),
    ...(fitsHorizontally(right.left, card, viewport) ? [right] : []),
    ...(fitsHorizontally(left.left, card, viewport) ? [left] : []),
  ];
}

/**
 * Places the card beside the target without covering it when there is room (below, above, right, left),
 * otherwise in the bottom-right corner. Without a target it goes to `fallback`. The card always stays fully on screen.
 */
export function placeTutorialCard(target: Rect | null, card: Size, viewport: Size, fallback: "center" | "corner" = "center"): CardPosition {
  const maxLeft = Math.max(0, viewport.width - card.width);
  const maxTop = Math.max(0, viewport.height - card.height);
  const corner: CardPosition = { top: clamp(viewport.height - card.height - EDGE, 0, maxTop), left: clamp(viewport.width - card.width - EDGE, 0, maxLeft), placement: "corner" };
  if (!target && fallback === "corner") return corner;
  if (!target) return { top: clamp((viewport.height - card.height) / 2, 0, maxTop), left: clamp((viewport.width - card.width) / 2, 0, maxLeft), placement: "center" };
  const [best] = candidates(target, card, viewport);
  return best ? { ...best, top: clamp(best.top, 0, maxTop), left: clamp(best.left, 0, maxLeft) } : corner;
}

export interface ScrollPlan { block: "center" | "start"; marginTop: number }

/** Targets taller than this share of the viewport are scrolled to show their top, not their middle. */
const TALL_SHARE = 0.55;
/** A tall target whose top is within this share of the viewport is left where it is. */
const VISIBLE_TOP_SHARE = 0.6;
/** Room kept above a tall target so sticky headers do not cover it. */
const TOP_ROOM_SHARE = 0.22;

/** How to bring a step's target into view: centered when it fits, top first when it is tall. Null: stay. */
export function tutorialScrollPlan(target: Rect, viewportHeight: number): ScrollPlan | null {
  if (target.height <= viewportHeight * TALL_SHARE) return { block: "center", marginTop: 0 };
  if (target.top >= 0 && target.top <= viewportHeight * VISIBLE_TOP_SHARE) return null;
  return { block: "start", marginTop: Math.round(viewportHeight * TOP_ROOM_SHARE) };
}
