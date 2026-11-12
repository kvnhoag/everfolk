import type { LifeState } from "../src/types.ts";

export interface PauseState {
  playing: boolean;
}

export interface PauseContext {
  hasBegun: boolean;
  phase: LifeState["phase"];
}

export type PauseEvent =
  | { type: "pause" | "continue" | "fresh" | "ended" }
  | { type: "playback"; playing: boolean };

/** Restoring a living character never resumes simulation before the player agrees. */
export function initialPauseState(): PauseState {
  return { playing: false };
}

/** This changes presentation only; no life snapshot or accepted command is touched. */
export function updatePauseState(state: PauseState, event: PauseEvent, context: PauseContext): PauseState {
  if (event.type === "fresh" || event.type === "ended" || event.type === "pause" || !context.hasBegun || context.phase === "ended") return initialPauseState();
  if (event.type === "continue") return { playing: true };
  if (event.type === "playback") return { playing: event.playing };
  return state;
}

/** Pausing stops automatic time, while explicit player actions remain available. */
export function canUseLifeCommands(context: PauseContext): boolean {
  return context.hasBegun && context.phase !== "ended";
}

export function canRunLifeClock(state: PauseState, context: PauseContext, visible: boolean, overlayOpen: boolean): boolean {
  return canUseLifeCommands(context) && state.playing && visible && !overlayOpen && context.phase === "ready";
}

export function canRunAutomaticDecision(state: PauseState, context: PauseContext, visible: boolean, overlayOpen: boolean, enabled: boolean): boolean {
  return canUseLifeCommands(context) && state.playing && visible && !overlayOpen && enabled && context.phase === "choice";
}
