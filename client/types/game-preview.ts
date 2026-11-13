import type { LifeEngine, LifeState } from "../../src/types.ts";

/** A seeded, in-memory life rendered by the normal game interface. */
export interface GamePreviewSession {
  engine: LifeEngine;
  life: LifeState;
  /** Exercise the normal birth reveal before entering an isolated test life. */
  atBirth?: boolean;
}
