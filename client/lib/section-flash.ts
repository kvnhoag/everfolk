/**
 * Lights up a section's border and lets the glow fade, so the player's eye is drawn without a popup.
 * Used when tips are off (a new section glows instead of opening a card) and for the yearly reminder.
 */

export const SECTION_FLASH_CLASS = "section-flash";
/** How long a section glows before the effect has faded completely. */
export const SECTION_FLASH_MS = 10_000;
/** A section that renders a moment after its stage begins gets a few more tries to be found. */
const RETRY_MS = 150;
const RETRIES = 8;

const timers = new WeakMap<Element, number>();

function matches(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector)).filter(element => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
  } catch { return []; }
}

/** The first selector alternative that has anything on screen, as hints pick their targets. */
export function firstMatching(alternatives: readonly string[]): Element[] {
  for (const selector of alternatives) {
    const found = matches(selector);
    if (found.length) return found;
  }
  return [];
}

function light(element: Element, durationMs: number): void {
  const previous = timers.get(element);
  if (previous !== undefined) window.clearTimeout(previous);
  // Restart the animation when a section that is still glowing is lit again.
  element.classList.remove(SECTION_FLASH_CLASS);
  void (element as HTMLElement).offsetWidth;
  (element as HTMLElement).style?.setProperty("--section-flash-ms", `${durationMs}ms`);
  element.classList.add(SECTION_FLASH_CLASS);
  timers.set(element, window.setTimeout(() => {
    element.classList.remove(SECTION_FLASH_CLASS);
    timers.delete(element);
  }, durationMs));
}

/**
 * Lights every section given as selector alternatives (one list per section). Sections not drawn yet are looked
 * for again a few times, then skipped. Returns a function that cancels pending retries.
 */
export function flashSections(sections: readonly (readonly string[])[], durationMs = SECTION_FLASH_MS): () => void {
  if (typeof document === "undefined") return () => {};
  let pending = sections.filter(section => section.length > 0);
  let tries = 0;
  let timer = 0;
  const attempt = () => {
    pending = pending.filter(section => {
      const found = firstMatching(section);
      found.forEach(element => light(element, durationMs));
      return found.length === 0;
    });
    if (pending.length && tries++ < RETRIES) timer = window.setTimeout(attempt, RETRY_MS);
  };
  attempt();
  return () => window.clearTimeout(timer);
}
