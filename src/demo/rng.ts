import { nextRandom, seedToUint32 } from "../random.ts";
import type { DemoState } from "./types.ts";

/** The demo stream is seeded apart from the main life stream, so older draw orders never shift. */
export function demoSeed(seed: string): number {
  return seedToUint32(`${seed}:demo`);
}

/** Draws from the demo stream of a private draft. */
export function demoRandom(demo: DemoState): number {
  const draw = nextRandom(demo.rng);
  demo.rng = draw.state;
  return draw.value;
}

/** Inclusive integer in [min, max] from the demo stream. */
export function demoInt(demo: DemoState, min: number, max: number): number {
  return min + Math.floor(demoRandom(demo) * (max - min + 1));
}
