/** Shared demo fixtures: the assembled world, its engine, and helpers to reach typical situations. */
import { readFileSync } from "node:fs";
import { createEngine } from "../../../src/engine.ts";
import { buildDemoWorld } from "../../../src/demo/world.ts";
import type { LifeEngine, LifeState, WorldPack } from "../../../src/types.ts";
import type { DemoState } from "../../../src/demo/types.ts";

const ranked = JSON.parse(readFileSync(new URL("../../../worlds/ranked/alexandria-ranked-1.json", import.meta.url), "utf8")) as WorldPack;

export function demoWorld(): WorldPack { return buildDemoWorld(ranked); }

let cached: LifeEngine | undefined;
export function demoEngine(): LifeEngine { return cached ??= createEngine(demoWorld()); }

/** Advances (always taking the first available choice) until `until` holds or the life ends. */
export function liveUntil(engine: LifeEngine, seed: string, until: (life: LifeState) => boolean, maxSteps = 2_000): LifeState {
  let life = engine.start(seed);
  for (let step = 0; step < maxSteps && !until(life) && life.phase !== "ended"; step++) {
    life = life.phase === "choice" ? engine.choose(life, engine.getChoices(life)[0].id) : engine.advance(life);
  }
  return life;
}

/** A draft copy of a life with demo state overridden, for module-level tests (never passed to the engine). */
export function withDemo(life: LifeState, patch: (demo: DemoState) => void): LifeState & { demo: DemoState } {
  const copy = structuredClone(life) as LifeState & { demo: DemoState };
  patch(copy.demo);
  return copy;
}
