import type { WorldPack } from "../src/types.ts";
import { ensureDemoDeeds } from "./catalog/demo-deeds.ts";
import { DEMO_WORLD_VERSION, LEGACY_DEMO_WORLD_VERSION, NPC_WORLD_VERSION, RANKED_WORLD_VERSION, WEAVE_WORLD_VERSION } from "./ids.ts";

/** The version string the contract records. A pack version that already includes the id is used as-is. */
export function contractWorldVersion(world: { id: string; version: string }): string {
  if (world.version === DEMO_WORLD_VERSION || world.version === NPC_WORLD_VERSION || world.version === WEAVE_WORLD_VERSION || world.version.startsWith(`${world.id}-`)) return world.version;
  return `${world.id}-${world.version}`;
}

export function worldForVersion(
  version: string,
  ranked: WorldPack,
  demo: WorldPack,
  legacyDemo?: WorldPack,
  npc?: WorldPack,
  weave?: WorldPack,
): WorldPack | null {
  if (version === WEAVE_WORLD_VERSION && weave) return ensureDemoDeeds(weave);
  if (version === RANKED_WORLD_VERSION) return ranked;
  if (version === DEMO_WORLD_VERSION) return ensureDemoDeeds(demo);
  if (version === LEGACY_DEMO_WORLD_VERSION && legacyDemo) return ensureDemoDeeds(legacyDemo);
  if (version === NPC_WORLD_VERSION && npc) return ensureDemoDeeds(npc);
  return null;
}
