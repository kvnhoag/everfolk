import type { WorldPack } from "../types.ts";
import { buildCapabilityWorld } from "./capability-world.ts";
import { applyLifeStageContent } from "./life-stage-content.ts";
import { LIVES_WORLD_VERSION } from "./ids.ts";

/** New births: the skill atlas plus life stages. Older revisions keep their exact rules for replay. */
export function buildLifeStageWorld(base: WorldPack): WorldPack {
  const world = applyLifeStageContent(buildCapabilityWorld(base));
  world.version = LIVES_WORLD_VERSION;
  world.description = `${world.description} Childhood unfolds by stage: floods, levies and illness reach a child through the household's decisions.`;
  return world;
}
