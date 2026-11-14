import type { TutorialHintId } from "./tutorial-hints.ts";

/**
 * Which button to point at when the player has done nothing for a few seconds while the game waits for them.
 * One hint per wait, and only while the game is actually waiting: a running year needs nothing.
 */

/** Seconds of no input before the hint appears (match-3 games use about 5 s; attention fades by about 10 s). */
export const IDLE_NUDGE_MS = 5000;

export interface IdleFacts {
  /** The life has begun and the game screen is in view, with no popup over it. */
  onGame: boolean;
  phase: "ready" | "choice" | "ended";
  playing: boolean;
  /** A decision popup is open. */
  decisionOpen: boolean;
  /** A tip card is open; the hint never stacks on top of it. */
  tipOpen: boolean;
  /** Time has moved at least once in this life; Resume is pointed at only before that, so it never nags. */
  timeStarted?: boolean;
}

export interface IdleNudge {
  key: string;
  /** Selector alternatives for the button or area to light up. */
  target: readonly string[];
  title: string;
  text: string;
  /** The tip the bubble's "What is this?" opens. */
  hint: TutorialHintId;
}

export function idleNudge(facts: IdleFacts): IdleNudge | null {
  if (facts.tipOpen || facts.phase === "ended") return null;
  if (facts.decisionOpen) return { key: "decision-options", target: [".life-decision-dialog[open] .life-decision-options"], hint: "decision",
    title: "Choose one option", text: "The clock waits until you pick. Every option shows what it may change." };
  if (!facts.onGame) return null;
  if (facts.phase === "choice") return { key: "open-decision", target: [".turning-point-button"], hint: "decision",
    title: "A decision is waiting", text: "Press Open decision to choose, or turn on Auto mode to let it choose for you." };
  if (!facts.playing && !facts.timeStarted) return { key: "resume", target: [".session-play"], hint: "time-bar",
    title: "Press Resume", text: "The game is paused. Resume to let the next year of your life begin." };
  return null;
}

export interface ScreenBox { top: number; left: number; width: number; height: number }

const NUDGE_GAP = 10;
const NUDGE_MARGIN = 8;

/**
 * Places the idle hint bubble near its target while keeping an enclosing popup's options and bottom edge clear.
 */
export function placeIdleBubble(
  target: ScreenBox,
  viewport: { width: number; height: number },
  bubble: { width: number; height: number } = { width: 280, height: 110 },
  dialog?: ScreenBox | null,
): { top: number; left: number } {
  const clampLeft = (left: number) => Math.max(NUDGE_MARGIN, Math.min(left, viewport.width - bubble.width - NUDGE_MARGIN));
  const clampTop = (top: number) => Math.max(NUDGE_MARGIN, Math.min(top, viewport.height - bubble.height - NUDGE_MARGIN));
  const belowTarget = target.top + target.height + NUDGE_GAP;
  const aboveTarget = target.top - NUDGE_GAP - bubble.height;

  if (!dialog) {
    const top = belowTarget + bubble.height <= viewport.height - NUDGE_MARGIN ? belowTarget : Math.max(NUDGE_MARGIN, aboveTarget);
    return { top, left: clampLeft(target.left) };
  }

  // Keep the bubble completely outside the popup whenever the viewport leaves room around any side.
  const leftOfDialog = dialog.left - NUDGE_GAP - bubble.width;
  if (leftOfDialog >= NUDGE_MARGIN) return { top: clampTop(target.top), left: leftOfDialog };
  const rightOfDialog = dialog.left + dialog.width + NUDGE_GAP;
  if (rightOfDialog + bubble.width <= viewport.width - NUDGE_MARGIN) return { top: clampTop(target.top), left: rightOfDialog };
  const belowDialog = dialog.top + dialog.height + NUDGE_GAP;
  if (belowDialog + bubble.height <= viewport.height - NUDGE_MARGIN) return { top: belowDialog, left: clampLeft(target.left) };
  const aboveDialog = dialog.top - NUDGE_GAP - bubble.height;
  if (aboveDialog >= NUDGE_MARGIN) return { top: aboveDialog, left: clampLeft(target.left) };

  // When a dialog fills the viewport (e.g. mobile screens), stay above the options or clear of the bottom edge.
  if (aboveTarget >= NUDGE_MARGIN) return { top: aboveTarget, left: clampLeft(target.left) };
  const dialogBottomSafe = Math.min(viewport.height - NUDGE_MARGIN, dialog.top + dialog.height - NUDGE_GAP);
  if (belowTarget + bubble.height <= dialogBottomSafe) return { top: belowTarget, left: clampLeft(target.left) };
  return { top: NUDGE_MARGIN, left: clampLeft(target.left) };
}
