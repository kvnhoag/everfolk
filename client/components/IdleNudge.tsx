import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIdle } from "../hooks/useIdle.ts";
import { useTutorialHost } from "../hooks/useTutorialHost.ts";
import { firstMatching } from "../lib/section-flash.ts";
import { IDLE_NUDGE_MS, placeIdleBubble, type IdleNudge as Nudge, type ScreenBox } from "../models/idle-nudge.ts";
import { tutorialStore } from "../state/tutorial-store.ts";
import PixelIcon from "./PixelIcon.tsx";
import "../styles/onboarding.css";

interface TargetGeometry { target: ScreenBox; dialog: ScreenBox | null }

const DEFAULT_BUBBLE = { width: 280, height: 110 };

function roundRect(rect: DOMRect | undefined | null): ScreenBox | null {
  return rect ? { top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height) } : null;
}

/** Follows the target and any enclosing popup every frame while shown, keeping the ring and hint clear. */
function useTargetGeometry(target: readonly string[] | null): TargetGeometry | null {
  const [geometry, setGeometry] = useState<TargetGeometry | null>(null);
  useLayoutEffect(() => {
    if (!target) { setGeometry(null); return; }
    let frame = 0;
    let last = "";
    const tick = () => {
      // Never on top of a tip card that is actually showing; a tip still waiting for its section does not count.
      const tipShown = document.querySelector(".everfolk-tutorial-layer.is-ready:not(.is-closing)") !== null;
      const element = tipShown ? undefined : firstMatching(target)[0];
      const box = roundRect(element?.getBoundingClientRect());
      const dialog = box ? roundRect(element?.closest("dialog[open]")?.getBoundingClientRect()) : null;
      const next = box ? { target: box, dialog } : null;
      const key = JSON.stringify(next);
      if (key !== last) { last = key; setGeometry(next); }
      frame = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(frame);
  }, [target?.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return geometry;
}

/**
 * After a few seconds without input while the game waits, a ring pulses on the button to press with a short
 * bubble saying why. Any click or key clears it. It joins an open popup so it is never hidden behind one.
 */
export default function IdleNudge({ nudge }: { nudge: Nudge | null }) {
  const idle = useIdle(IDLE_NUDGE_MS, nudge !== null, nudge?.key ?? "");
  const shown = idle ? nudge : null;
  const geometry = useTargetGeometry(shown?.target ?? null);
  const host = useTutorialHost();
  const layer = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubbleSize, setBubbleSize] = useState(DEFAULT_BUBBLE);
  useLayoutEffect(() => {
    const element = layer.current;
    if (!element || typeof element.showPopover !== "function") return;
    try { if (!element.matches(":popover-open")) element.showPopover(); } catch { /* Shown in place without the top layer. */ }
  }, [shown?.key, geometry !== null, host]);
  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!shown || !geometry || !bubble) return;
    const rect = bubble.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const next = { width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
    setBubbleSize(prev => (prev.width === next.width && prev.height === next.height ? prev : next));
  }, [shown?.key, geometry !== null]);
  if (!shown || !geometry || typeof document === "undefined") return null;
  const { target: box, dialog } = geometry;
  const viewport = {
    width: document.documentElement.clientWidth || window.innerWidth,
    height: document.documentElement.clientHeight || window.innerHeight,
  };
  const spot = placeIdleBubble(box, viewport, bubbleSize, dialog);
  return createPortal(<div ref={layer} className="idle-nudge" popover="manual" role="status" aria-live="polite">
    <span className="idle-nudge-ring" aria-hidden="true" style={{ top: box.top - 5, left: box.left - 5, width: box.width + 10, height: box.height + 10 }} />
    <div ref={bubbleRef} className="idle-nudge-bubble" style={spot}>
      <strong><span className="idle-nudge-hand" aria-hidden="true"><PixelIcon name="arrow" size={13} /></span>{shown.title}</strong>
      {shown.text}
      <div><button type="button" data-idle-ignore="" onClick={() => tutorialStore.openHint(shown.hint)}>What is this?</button></div>
    </div>
  </div>, host ?? document.body);
}
