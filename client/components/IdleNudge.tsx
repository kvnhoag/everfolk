import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIdle } from "../hooks/useIdle.ts";
import { useTutorialHost } from "../hooks/useTutorialHost.ts";
import { firstMatching } from "../lib/section-flash.ts";
import { IDLE_NUDGE_MS, type IdleNudge as Nudge } from "../models/idle-nudge.ts";
import { tutorialStore } from "../state/tutorial-store.ts";
import PixelIcon from "./PixelIcon.tsx";
import "../styles/onboarding.css";

interface Box { top: number; left: number; width: number; height: number }

const GAP = 10;
const BUBBLE = { width: 280, height: 110 };

function bubbleSpot(box: Box): { top: number; left: number } {
  const viewport = { width: document.documentElement.clientWidth || window.innerWidth, height: document.documentElement.clientHeight || window.innerHeight };
  const below = box.top + box.height + GAP;
  const top = below + BUBBLE.height <= viewport.height ? below : Math.max(8, box.top - GAP - BUBBLE.height);
  const left = Math.max(8, Math.min(box.left, viewport.width - BUBBLE.width - 8));
  return { top, left };
}

/** Follows the target every frame while shown, so scrolling and layout changes keep the ring on the button. */
function useTargetBox(target: readonly string[] | null): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    if (!target) { setBox(null); return; }
    let frame = 0;
    let last = "";
    const tick = () => {
      // Never on top of a tip card that is actually showing; a tip still waiting for its section does not count.
      const tipShown = document.querySelector(".everfolk-tutorial-layer.is-ready:not(.is-closing)") !== null;
      const element = tipShown ? undefined : firstMatching(target)[0];
      const rect = element?.getBoundingClientRect();
      const next = rect ? { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) } : null;
      const key = JSON.stringify(next);
      if (key !== last) { last = key; setBox(next); }
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [target?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return box;
}

/**
 * After a few seconds without input while the game waits, a ring pulses on the button to press with a short
 * bubble saying why. Any click or key clears it. It joins an open popup so it is never hidden behind one.
 */
export default function IdleNudge({ nudge }: { nudge: Nudge | null }) {
  const idle = useIdle(IDLE_NUDGE_MS, nudge !== null, nudge?.key ?? "");
  const shown = idle ? nudge : null;
  const box = useTargetBox(shown?.target ?? null);
  const host = useTutorialHost();
  const layer = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = layer.current;
    if (!element || typeof element.showPopover !== "function") return;
    try { if (!element.matches(":popover-open")) element.showPopover(); } catch { /* Shown in place without the top layer. */ }
  }, [shown?.key, box !== null, host]);
  if (!shown || !box || typeof document === "undefined") return null;
  const spot = bubbleSpot(box);
  return createPortal(<div ref={layer} className="idle-nudge" popover="manual" role="status" aria-live="polite">
    <span className="idle-nudge-ring" aria-hidden="true" style={{ top: box.top - 5, left: box.left - 5, width: box.width + 10, height: box.height + 10 }} />
    <div className="idle-nudge-bubble" style={spot}>
      <strong><span className="idle-nudge-hand" aria-hidden="true"><PixelIcon name="arrow" size={13} /></span>{shown.title}</strong>
      {shown.text}
      <div><button type="button" data-idle-ignore="" onClick={() => tutorialStore.openHint(shown.hint)}>What is this?</button></div>
    </div>
  </div>, host ?? document.body);
}
