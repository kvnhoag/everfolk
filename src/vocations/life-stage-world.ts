import type { WorldPack } from "../types.ts";
import { buildCapabilityWorld } from "./capability-world.ts";
import { applyLifeStageContent } from "./life-stage-content.ts";
import { LIVES_WORLD_VERSION } from "./ids.ts";
import { ALEXANDRIA_PATHS, NEW_ORIGINS, NEW_ORIGIN_RESOURCES } from "../paths/content/config.ts";
import { FIELD_IDS } from "../paths/types.ts";

/** New births: the skill atlas plus life stages. Older revisions keep their exact rules for replay. */
export function buildLifeStageWorld(base: WorldPack): WorldPack {
  const world = applyLifeStageContent(buildCapabilityWorld(base));
  world.version = LIVES_WORLD_VERSION;
  world.description = `${world.description} Childhood unfolds by stage: floods, levies and illness reach a child through the household's decisions.`;
  addPaths(world);
  return world;
}

/** Fields, districts, the city and royal birthplaces, and the flags for renowned meetings. */
function addPaths(world: WorldPack): void {
  world.origins = [...world.origins, ...structuredClone(NEW_ORIGINS)];
  const resources = world.demo!.startingResources!;
  resources.origins = { ...resources.origins, ...structuredClone(NEW_ORIGIN_RESOURCES) } as typeof resources.origins;
  world.paths = structuredClone(ALEXANDRIA_PATHS);
  for (const field of FIELD_IDS) {
    world.flags[`met-renowned-${field}`] = { label: `Met a renowned ${world.paths.fields[field].practitioner}`, initial: false };
  }
}
