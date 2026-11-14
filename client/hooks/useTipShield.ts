import { useEffect, useLayoutEffect, useState } from "react";
import { shieldClipPath } from "../models/guided-step.ts";
import type { Rect } from "../models/tutorial-placement.ts";
import { setTipLock } from "../lib/tip-lock.ts";

/** Room around the Tutorial switch's hole, so its focus ring is not cut. */
const SWITCH_PADDING = 4;

function switchRect(): Rect | null {
  const button = Array.from(document.querySelectorAll("[data-tutorial-button]")).find(element => element.getBoundingClientRect().width > 0);
  if (!button) return null;
  const box = button.getBoundingClientRect();
  return { top: box.top - SWITCH_PADDING, left: box.left - SWITCH_PADDING, width: box.width + 2 * SWITCH_PADDING, height: box.height + 2 * SWITCH_PADDING };
}

/**
 * While a guided step is locked: registers the lock for the click guard and returns the veil's clip-path, with holes
 * for the step's section (the spotlight) and the Tutorial switch, following both every frame. Null when unlocked.
 */
export function useTipShield(locked: boolean, targets: readonly string[], card: Element | null, spotlight: Rect | null): string | null {
  const [clip, setClip] = useState<string | null>(null);
  useEffect(() => {
    if (!locked) return;
    setTipLock({ targets, card });
    return () => setTipLock(null);
  }, [locked, targets.join("|"), card]); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (!locked) { setClip(null); return; }
    let frame = 0;
    const tick = () => {
      const viewport = { width: document.documentElement.clientWidth || window.innerWidth, height: document.documentElement.clientHeight || window.innerHeight };
      const holes = [spotlight, switchRect()].filter((rect): rect is Rect => rect !== null);
      const next = shieldClipPath(viewport, holes);
      setClip(previous => previous === next ? previous : next);
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [locked, spotlight?.top, spotlight?.left, spotlight?.width, spotlight?.height]); // eslint-disable-line react-hooks/exhaustive-deps
  return clip;
}
