import type { Command, LifeState } from "../../src/types.ts";

/** Authoritative online play uses the normal game screen without overwriting the offline save. */
export interface OnlinePlay {
  initial: LifeState;
  current(): LifeState;
  dispatch(command: Command): Promise<LifeState>;
  onSynced?(state: LifeState): void;
}
