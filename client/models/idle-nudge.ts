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
  if (!facts.playing) return { key: "resume", target: [".session-play"], hint: "time-bar",
    title: "Press Resume", text: "The game is paused. Resume to let the next year of your life begin." };
  return null;
}
