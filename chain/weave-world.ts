import { validateWorld } from "../src/validate.ts";
import type { WorldPack } from "../src/types.ts";
import { LIVES_WORLD_VERSION } from "../src/vocations/ids.ts";
import { ensureDemoDeeds } from "./catalog/demo-deeds.ts";
import { WEAVE_WORLD_VERSION } from "./ids.ts";

/**
 * Weave mode's world (`alexandria-weave-1`): the current free-play world (LIVES_WORLD_VERSION, with its eleven
 * historical figure paths and 400–300 BCE births) plus the on-chain deeds and key-decision draws. A Weave life
 * earns exactly the cards a free life would (chain/earned-cards.ts); only those can be minted.
 */
export function buildWeaveWorld(base: WorldPack): WorldPack {
  if (base.version !== LIVES_WORLD_VERSION) throw new Error(`The Weave world builds on ${LIVES_WORLD_VERSION}, not ${base.version}.`);
  const world = ensureDemoDeeds({ ...structuredClone(base), id: "alexandria", version: WEAVE_WORLD_VERSION });
  validateWorld(world);
  return world;
}
