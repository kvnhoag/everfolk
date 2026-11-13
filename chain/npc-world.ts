import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import { ensureDemoDeeds } from "./catalog/demo-deeds.ts";
import { NPC_WORLD_VERSION } from "./ids.ts";

/**
 * Builds the ranked live-NPC world revision (`alexandria-npc-1`) from the current
 * Alexandria household + vocations + capability base pack while preserving every
 * ranked deed, key decision trigger, figure path, and NPC agent turn invariant.
 */
export function buildNpcWorld(base: WorldPack): WorldPack {
  const cloned = structuredClone(base);
  const candidate: WorldPack = ensureDemoDeeds({
    ...cloned,
    id: "alexandria",
    version: NPC_WORLD_VERSION,
    npcAgents: { version: 1 },
  });
  validateWorld(candidate);
  return candidate;
}
