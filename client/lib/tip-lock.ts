/**
 * The controls a guided step leaves usable: its own section, the tip card, the Tutorial switch (the way out) and any
 * open popup such as a waiting decision. Everything else on the page ignores clicks until the step is done.
 */

interface Closest { closest(selector: string): unknown }
interface Container { contains(node: unknown): boolean }

export interface TipLock {
  /** The step's section, as selector alternatives. */
  targets: readonly string[];
  card: Container | null;
}

const ALWAYS_USABLE = ["[data-tutorial-button]", "dialog[open]"];

let lock: TipLock | null = null;

export function setTipLock(next: TipLock | null): void {
  lock = next;
}

/** A guided step is showing and holding the page. */
export function tipLockActive(): boolean {
  return lock !== null;
}

function inside(element: Closest, selector: string): boolean {
  try { return element.closest(selector) !== null; }
  catch { return false; }
}

function isElement(target: unknown): target is Closest {
  return typeof target === "object" && target !== null && typeof (target as Closest).closest === "function";
}

/** True when a guided step is showing and this click would land on a control it locks. */
export function blockedByTipLock(target: unknown): boolean {
  if (!lock || !isElement(target)) return false;
  if (lock.card?.contains(target)) return false;
  return ![...ALWAYS_USABLE, ...lock.targets].some(selector => inside(target, selector));
}
