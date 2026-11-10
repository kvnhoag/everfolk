import type { LifeState } from "../src/types.ts";

export interface PauseState {
  screenOpen: boolean;
  playing: boolean;
}

export interface PauseContext {
  hasBegun: boolean;
  phase: LifeState["phase"];
}

export type PauseEvent =
  | { type: "show" | "continue" | "fresh" | "ended" }
  | { type: "playback"; playing: boolean };

/** Restoring a living character never resumes simulation before the player agrees. */
export function initialPauseState(context: PauseContext): PauseState {
  return { screenOpen: context.hasBegun && context.phase !== "ended", playing: false };
}

/** This changes presentation only; no life snapshot or accepted command is touched. */
export function updatePauseState(state: PauseState, event: PauseEvent, context: PauseContext): PauseState {
  if (event.type === "fresh" || event.type === "ended" || context.phase === "ended") return { screenOpen: false, playing: false };
  if (event.type === "show") return initialPauseState(context);
  if (event.type === "continue") return context.hasBegun ? { screenOpen: false, playing: true } : state;
  if (event.type === "playback") return { screenOpen: state.screenOpen, playing: context.hasBegun && !state.screenOpen && event.playing };
  return state;
}

export function canUseLifeCommands(state: PauseState, context: PauseContext): boolean {
  return context.hasBegun && !state.screenOpen && context.phase !== "ended";
}

export function canRunLifeClock(state: PauseState, context: PauseContext, visible: boolean, overlayOpen: boolean): boolean {
  return canUseLifeCommands(state, context) && state.playing && visible && !overlayOpen && context.phase === "ready";
}

export function canRunAutomaticDecision(state: PauseState, context: PauseContext, visible: boolean, overlayOpen: boolean, enabled: boolean): boolean {
  return canUseLifeCommands(state, context) && state.playing && visible && !overlayOpen && enabled && context.phase === "choice";
}
