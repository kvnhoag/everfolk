/**
 * Dims the whole page except the sections being highlighted, so the eye goes straight to them. A fixed SVG layer
 * with a mask cut out around each section follows them every frame, holds for a few seconds, then fades. Clicks
 * pass through, and any click or key press clears it at once.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const DIM = "#0d1f24";
const DIM_OPACITY = 0.62;
/** How long the dim holds at full strength before fading. */
const HOLD_MS = 3000;
const PAD = 6;
const RADIUS = 6;
const CLEAR_MS = 250;

interface Spot { start: number; end: number }

const spots = new Map<Element, Spot>();
let layer: SVGSVGElement | null = null;
let cutouts: SVGGElement | null = null;
let frame = 0;
let listening = false;

function clearSoon(): void {
  const now = performance.now();
  for (const spot of spots.values()) spot.end = Math.min(spot.end, now + CLEAR_MS);
}

function build(): void {
  layer = document.createElementNS(SVG_NS, "svg");
  layer.setAttribute("class", "section-spotlight");
  layer.setAttribute("aria-hidden", "true");
  const defs = document.createElementNS(SVG_NS, "defs");
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.setAttribute("id", "section-spotlight-mask");
  const all = document.createElementNS(SVG_NS, "rect");
  all.setAttribute("width", "100%");
  all.setAttribute("height", "100%");
  all.setAttribute("fill", "white");
  cutouts = document.createElementNS(SVG_NS, "g");
  mask.appendChild(all);
  mask.appendChild(cutouts);
  defs.appendChild(mask);
  const shade = document.createElementNS(SVG_NS, "rect");
  shade.setAttribute("width", "100%");
  shade.setAttribute("height", "100%");
  shade.setAttribute("fill", DIM);
  shade.setAttribute("mask", "url(#section-spotlight-mask)");
  layer.appendChild(defs);
  layer.appendChild(shade);
  document.body.appendChild(layer);
  if (!listening) {
    window.addEventListener("pointerdown", clearSoon, { capture: true, passive: true });
    window.addEventListener("keydown", clearSoon, { capture: true });
    listening = true;
  }
}

function teardown(): void {
  layer?.remove();
  layer = null;
  cutouts = null;
  window.cancelAnimationFrame(frame);
  frame = 0;
  if (listening) {
    window.removeEventListener("pointerdown", clearSoon, { capture: true });
    window.removeEventListener("keydown", clearSoon, { capture: true });
    listening = false;
  }
}

/** Full strength while holding, then a straight fade to nothing at the end. */
export function spotlightStrength(spot: Spot, now: number): number {
  const length = spot.end - spot.start;
  if (now >= spot.end || length <= 0) return 0;
  const hold = Math.min(HOLD_MS, length / 2);
  const elapsed = now - spot.start;
  return elapsed <= hold ? 1 : Math.max(0, (spot.end - now) / (length - hold));
}

function tick(): void {
  const now = performance.now();
  for (const [element, spot] of spots) if (now >= spot.end || !element.isConnected) spots.delete(element);
  if (spots.size === 0 || !layer || !cutouts) { teardown(); return; }
  let strength = 0;
  const holes: SVGRectElement[] = [];
  for (const [element, spot] of spots) {
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    strength = Math.max(strength, spotlightStrength(spot, now));
    const hole = document.createElementNS(SVG_NS, "rect");
    hole.setAttribute("x", String(Math.round(box.left - PAD)));
    hole.setAttribute("y", String(Math.round(box.top - PAD)));
    hole.setAttribute("width", String(Math.round(box.width + PAD * 2)));
    hole.setAttribute("height", String(Math.round(box.height + PAD * 2)));
    hole.setAttribute("rx", String(RADIUS));
    hole.setAttribute("fill", "black");
    holes.push(hole);
  }
  cutouts.replaceChildren(...holes);
  layer.style.opacity = String((DIM_OPACITY * strength).toFixed(3));
  frame = window.requestAnimationFrame(tick);
}

/** Keeps `element` bright while the rest of the page dims, for `durationMs`. */
export function spotlightSection(element: Element, durationMs: number): void {
  if (typeof document === "undefined") return;
  const now = performance.now();
  spots.set(element, { start: now, end: now + durationMs });
  if (!layer) build();
  if (!frame) frame = window.requestAnimationFrame(tick);
}
