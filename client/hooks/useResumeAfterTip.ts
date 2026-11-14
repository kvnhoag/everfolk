import { useEffect, useRef, useState } from "react";

/** How long the clock rests after the player closes a tip before the year carries on by itself. */
export const TIP_RESUME_DELAY_MS = 2000;

/** What has to be true for a closed tip to start the clock again. */
export interface TipResumeState {
  phase: "ready" | "choice" | "ended";
  hasBegun: boolean;
  /** The game screen is the one in view. */
  visible: boolean;
  /** Another window, menu, help popover or card-pack moment is open. */
  otherOverlayOpen: boolean;
  /** The year waits for this year's action choice. */
  yearEndPending: boolean;
}

/** A closed tip resumes the year only when nothing else is waiting: no decision, no year-end choice, no open window. */
export function canResumeAfterTip(state: TipResumeState): boolean {
  return state.phase === "ready" && state.hasBegun && state.visible && !state.otherOverlayOpen && !state.yearEndPending;
}

/**
 * When the player closes a tip ("Got it", × or using its section) and the clock is stopped, waits a short moment and
 * then carries the year on, so nobody has to hunt for Resume after reading. Another tip opening cancels the wait; the
 * last one to close starts it. Returns true while that short wait is running.
 */
export function useResumeAfterTip(tipShown: boolean, isPlaying: boolean, state: TipResumeState, resume: () => void,
  delayMs: number = TIP_RESUME_DELAY_MS): boolean {
  const wasShown = useRef(tipShown);
  const [waiting, setWaiting] = useState(false);
  const latest = useRef({ state, resume, isPlaying });
  latest.current = { state, resume, isPlaying };

  useEffect(() => {
    const closed = wasShown.current && !tipShown;
    wasShown.current = tipShown;
    if (!closed || latest.current.isPlaying) { setWaiting(false); return undefined; }
    setWaiting(true);
    const timer = window.setTimeout(() => {
      setWaiting(false);
      const now = latest.current;
      if (!now.isPlaying && canResumeAfterTip(now.state)) now.resume();
    }, delayMs);
    return () => { window.clearTimeout(timer); };
  }, [tipShown, delayMs]);

  return waiting && !isPlaying;
}
