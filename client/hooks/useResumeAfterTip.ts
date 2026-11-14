import { useEffect, useRef, useState } from "react";

/** How long the clock rests after the player closes a tooltip or guide before the year carries on by itself. */
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
 * Closing the last tooltip or guide resumes a stopped clock after a short rest. Opening more help, leaving the
 * dashboard, or resuming manually cancels the wait. Returns true while that short wait is running.
 */
export function useResumeAfterTip(readingHelpShown: boolean, isPlaying: boolean, state: TipResumeState, resume: () => void,
  delayMs: number = TIP_RESUME_DELAY_MS): boolean {
  const wasShown = useRef(readingHelpShown);
  const [waiting, setWaiting] = useState(false);
  const latest = useRef({ state, resume, isPlaying });
  latest.current = { state, resume, isPlaying };
  const resumable = canResumeAfterTip(state);

  useEffect(() => {
    const closed = wasShown.current && !readingHelpShown;
    wasShown.current = readingHelpShown;
    if (!closed || isPlaying || !resumable || document.hidden) { setWaiting(false); return undefined; }
    setWaiting(true);
    const timer = window.setTimeout(() => {
      setWaiting(false);
      const now = latest.current;
      if (!document.hidden && !now.isPlaying && canResumeAfterTip(now.state)) now.resume();
    }, delayMs);
    const cancelOnHide = () => {
      if (!document.hidden) return;
      window.clearTimeout(timer);
      setWaiting(false);
    };
    document.addEventListener("visibilitychange", cancelOnHide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", cancelOnHide);
    };
  }, [readingHelpShown, isPlaying, resumable, delayMs]);

  return waiting && !isPlaying;
}
