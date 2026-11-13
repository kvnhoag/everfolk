import type { Rect, Size } from "./tutorial-placement.ts";

/** How long the card takes to fly between its section and the Tutorial button. */
export const FLIGHT_MS = 300;

const TIP_GAP = 8;
const TIP_EDGE = 8;

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * The CSS transform (with a top-left transform origin) that lays the `from` box over the `to` box. Used for
 * FLIP: the card shrinks onto the Tutorial button when it closes and grows out of it when it opens.
 */
export function flightTransform(from: Rect, to: Rect): string {
  const scaleX = from.width > 0 ? to.width / from.width : 1;
  const scaleY = from.height > 0 ? to.height / from.height : 1;
  return `translate(${round(to.left - from.left)}px, ${round(to.top - from.top)}px) scale(${round(scaleX)}, ${round(scaleY)})`;
}

export interface HelpTipPosition { top: number; left: number; side: "below" | "above" }

/** A "?" tooltip: below its button and right-aligned to it, above when there is no room, always inside the viewport. */
export function placeHelpTip(anchor: Rect, tip: Size, viewport: Size): HelpTipPosition {
  const below = anchor.top + anchor.height + TIP_GAP;
  const above = anchor.top - TIP_GAP - tip.height;
  const fitsBelow = below + tip.height <= viewport.height - TIP_EDGE;
  const side = fitsBelow || above < TIP_EDGE ? "below" : "above";
  const maxLeft = viewport.width - tip.width - TIP_EDGE;
  const left = Math.max(Math.min(anchor.left + anchor.width - tip.width, maxLeft), Math.min(TIP_EDGE, Math.max(0, maxLeft)));
  return { top: side === "below" ? below : above, left: Math.max(0, left), side };
}
