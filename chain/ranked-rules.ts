import type { Command, LifeEngine, LifeState, SaveFile } from "../src/types.ts";
import { keyDecisionCategory } from "./catalog/key-decisions.ts";
import type { Category } from "./ids.ts";
import type { LifeView } from "./types.ts";

export const CHECKPOINT_YEARS = 5;

/** What a ranked life owes the chain at a command index: a draw at each key decision, a checkpoint each five years. */
export type Obligation = { kind: "checkpoint"; step: number } | { kind: "draw"; step: number; category: Category };

/**
 * The single statement of where draws and checkpoints are owed, used by both the player's session and the verifier.
 * A key decision owes one draw when it first comes up; a filled draw's own `apply` command does not create another.
 */
export class ObligationTracker {
  private drawnDecision: string | null = null;

  /** `state` is the life at command index `step`, before `commands[step]` runs (or at the end of the log). */
  at(state: LifeState, step: number): Obligation[] {
    const category = state.phase === "choice" && state.pendingEventId ? keyDecisionCategory(state.pendingEventId) : null;
    if (!category) {
      this.drawnDecision = null;
      return [];
    }
    if (this.drawnDecision === state.pendingEventId) return [];
    this.drawnDecision = state.pendingEventId;
    return [{ kind: "draw", step, category }];
  }

  /** After `command` ran from `ageBefore`; `step` is the new command count. */
  after(command: Command, ageBefore: number, state: LifeState, step: number): Obligation[] {
    if (command.type === "choose") this.drawnDecision = null;
    return Math.floor(state.age / CHECKPOINT_YEARS) > Math.floor(ageBefore / CHECKPOINT_YEARS) ? [{ kind: "checkpoint", step }] : [];
  }
}

export function stepCommand(engine: LifeEngine, state: LifeState, command: Command): LifeState {
  switch (command.type) {
    case "advance": return engine.advance(state);
    case "choose": return engine.choose(state, command.choice);
    case "act": return engine.act(state, command.activity);
    case "avatar": return engine.chooseAvatar(state, command.variant);
    case "influence": return engine.influence(state, command);
    default: throw new Error("Unknown command.");
  }
}

/** Replays a ranked save one command at a time and lists every obligation it incurred, in order. */
export function rankedObligations(engine: LifeEngine, figureActivations: number, save: SaveFile): { state: LifeState; required: Obligation[]; tracker: ObligationTracker } {
  const tracker = new ObligationTracker();
  const required: Obligation[] = [];
  let state = engine.start(save.seed);
  for (let step = 0; ; step++) {
    if (step >= figureActivations) required.push(...tracker.at(state, step));
    if (step === save.commands.length) break;
    const command = save.commands[step];
    const ageBefore = state.age;
    state = stepCommand(engine, state, command);
    if (step >= figureActivations) required.push(...tracker.after(command, ageBefore, state, step + 1));
  }
  return { state, required, tracker };
}

export type ObligationCheck = { ok: true; state: LifeState } | { ok: false; reason: string };

/** Every key decision drawn in its category, no draw anywhere else, and every five-year checkpoint posted. */
export function checkRankedObligations(engine: LifeEngine, life: LifeView, save: SaveFile): ObligationCheck {
  let replay: { state: LifeState; required: Obligation[] };
  try {
    replay = rankedObligations(engine, life.figure_picks.length, save);
  } catch (error) {
    return { ok: false, reason: `This life could not be replayed: ${error instanceof Error ? error.message : "unknown error"}` };
  }
  const draws = replay.required.filter(o => o.kind === "draw");
  for (const owed of draws) {
    const draw = life.draws.find(d => d.step === owed.step);
    if (!draw) return { ok: false, reason: "A key decision in this life was not drawn on chain." };
    if (draw.category !== owed.category) return { ok: false, reason: "A key decision in this life was drawn in the wrong category." };
  }
  if (life.draws.some(d => !draws.some(owed => owed.step === d.step))) {
    return { ok: false, reason: "This life has a draw where no key decision was pending." };
  }
  const posted = new Set(life.checkpoints.map(c => c.step));
  if (replay.required.some(o => o.kind === "checkpoint" && !posted.has(o.step))) {
    return { ok: false, reason: "This life is missing a five-year checkpoint." };
  }
  return { ok: true, state: replay.state };
}
