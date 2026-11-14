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
