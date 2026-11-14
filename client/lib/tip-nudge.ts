import { blockedNoteStore } from "../state/blocked-note.ts";

/** How long the shown tip shakes when the player tries to skip past it. */
const NUDGE_MS = 600;
const NUDGE_CLASS = "is-nudged";

/**
 * Draws the eye back to the tip on screen (Next decision waits for it while tips are on): the card takes focus and
 * shakes once. Does nothing when no tip is shown.
 */
export function nudgeShownTip(): void {
  if (typeof document === "undefined") return;
  const card = document.querySelector<HTMLElement>(".everfolk-tutorial-layer.tutorial-card.is-ready:not(.is-closing)");
  if (!card) return;
  card.focus({ preventScroll: true });
  card.classList.remove(NUDGE_CLASS);
  void card.offsetWidth; // Restart the animation when nudged twice in a row.
  card.classList.add(NUDGE_CLASS);
  window.setTimeout(() => card.classList.remove(NUDGE_CLASS), NUDGE_MS);
}

/** Where a click happened; a keyboard "click" (no pointer) uses the middle of the control it landed on. */
function clickPoint(event: MouseEvent): { x: number; y: number } {
  if (event.detail > 0 || event.clientX !== 0 || event.clientY !== 0) return { x: event.clientX, y: event.clientY };
  const box = event.target instanceof Element ? event.target.getBoundingClientRect() : null;
  return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: 0, y: 0 };
}

/**
 * A click the guided step held back: the tip card shakes and takes focus, and "Finish this tip first: press Got it"
 * shows at the click point for a moment, so the player knows why nothing happened and what to do.
 */
export function reportBlockedClick(event: MouseEvent): void {
  if (typeof document === "undefined") return;
  const viewport = { width: document.documentElement.clientWidth || window.innerWidth, height: document.documentElement.clientHeight || window.innerHeight };
  blockedNoteStore.show(clickPoint(event), viewport);
  nudgeShownTip();
}
