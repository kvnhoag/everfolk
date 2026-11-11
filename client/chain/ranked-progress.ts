import { createEngine } from "../../src/index.ts";
import type { LifeView } from "../../chain/types.ts";
import type { WorldPack } from "../../src/types.ts";
import { rankedSaveKey, type SessionStorage } from "./ranked-session.ts";
import { loadLifeWorld } from "./life-world.ts";

export type RankedProgress = { status: "new" | "playing" | "ended" | "unavailable"; age?: number; name?: string; pack?: boolean };

/** Replays this device's save; an on-chain active life can already be finished locally and waiting to mint. */
export async function rankedProgress(life: LifeView, storage?: Pick<SessionStorage, "getItem">, world?: WorldPack): Promise<RankedProgress> {
  try {
    const saved = (storage ?? localStorage).getItem(rankedSaveKey(life.life_id));
    if (!saved) return { status: life.draws.length || life.checkpoints.length ? "unavailable" : "new" };
    const pack = world ?? await loadLifeWorld(life.world_version);
    const state = createEngine(pack).load(saved);
    if (state.seed !== life.seed) return { status: "unavailable" };
    return { status: state.phase === "ended" ? "ended" : "playing", age: state.age, name: state.character?.name };
  } catch { return { status: "unavailable" }; }
}
