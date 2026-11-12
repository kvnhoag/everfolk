import type { WorldPack } from "../types.ts";
import { buildVocationWorld } from "./world.ts";
import { configureCapabilitiesWorld } from "../capabilities/world.ts";
import { LIVES_WORLD_VERSION } from "./ids.ts";

/** Opt in only new births; retained packs keep their exact work and replay rules. */
export function buildCapabilityWorld(base: WorldPack): WorldPack {
  const world = buildVocationWorld(base);
  world.version = LIVES_WORLD_VERSION;
  world.title = "Alexandria — Paths of a life";
  world.description = "Learn through practice and demonstrated work. Follow farming, handmade craft, inquiry, public life or trade across a connected skill tree.";
  configureCapabilitiesWorld(world);
  return world;
}
