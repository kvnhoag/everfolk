import type { WorldPack } from "../types.ts";
import { buildFigurePathWorld } from "../figures/world.ts";
import { tagTaughtFields } from "../paths/content/refits.ts";
import { auditEvents } from "../paths/audit.ts";
import { LIVES_RULES_WORLD_VERSION, LIVES_WORLD_VERSION } from "./ids.ts";

/**
 * Current free-play births (LIVES_WORLD_VERSION): the life-stage rules pack built by
 * buildLifeStageWorld (LIVES_RULES_WORLD_VERSION) with the historical figure paths added.
 * Figure stories that teach a field's skill are tagged with that field, as life-path events are.
 */
export function buildLivesWorld(rules: WorldPack): WorldPack {
  if (rules.version !== LIVES_RULES_WORLD_VERSION) throw new Error(`Figure paths for new births build on ${LIVES_RULES_WORLD_VERSION}, not ${rules.version}.`);
  const world = tagTaughtFields(buildFigurePathWorld(rules, LIVES_WORLD_VERSION));
  if (world.demo?.market.depth) world.demo.market.depth.monotoneOrder = true;
  // The build fails rather than ship an event that breaks the life-paths rules.
  const broken = auditEvents(world);
  if (broken.length) throw new Error(`Event rules broken: ${broken.map(item => `rule ${item.rule} ${item.eventId} (${item.message})`).join("; ")}`);
  return world;
}
