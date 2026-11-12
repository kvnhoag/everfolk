import type { WorldPack } from "../types.ts";
import { buildCrossoverWorld, requireMilitaryQualification } from "./crossover-world.ts";
import { applyLifeStageContent } from "./life-stage-content.ts";
import { LIVES_WORLD_VERSION } from "./ids.ts";
import { ALEXANDRIA_PATHS, NEW_ORIGINS, NEW_ORIGIN_RESOURCES } from "../paths/content/config.ts";
import { FIELD_IDS } from "../paths/types.ts";
import { inspirationEvents } from "../paths/content/inspiration.ts";
import { holdingsEvents } from "../paths/content/holdings.ts";
import { needsEvents } from "../paths/content/needs.ts";
import { moveEvents } from "../paths/content/moves.ts";
import { milestoneEvents, milestoneFlags } from "../paths/content/milestones.ts";
import { applyPacing } from "./pacing.ts";
import { refitEvents } from "../paths/content/refits.ts";
import { auditEvents } from "../paths/audit.ts";

/** New births: the attribute atlas and military lane, plus life stages and life paths. Older revisions keep their exact rules for replay. */
export function buildLifeStageWorld(base: WorldPack): WorldPack {
  const world = applyLifeStageContent(buildCrossoverWorld(base));
  world.version = LIVES_WORLD_VERSION;
  world.description = `${world.description} Childhood unfolds by stage: floods, levies and illness reach a child through the household's decisions.`;
  applyPacing(world);
  addPaths(world);
  // New births: a household keeps seed when the store runs short, and leases what it cannot work.
  Object.assign(world.demo!.household, { buySeedWhenShort: true, leaseUnworkedBps: 5000 });
  // The flax-seed price depends on the district (the village farm edge), so its label names no fixed price.
  for (const activity of world.character!.activities) {
    if (activity.outcomes.some(outcome => outcome.effects.some(effect => effect.type === "vocation" && effect.action === "buy-flax-seed"))) activity.text = activity.text.replace(/ \(\d+ dr\)$/, "");
  }
  const refitted = refitEvents(world);
  // Life-paths offers (war recruiting) follow the atlas rule: a rank needs its proved qualification.
  requireMilitaryQualification(refitted);
  // The build fails rather than ship a household decision a child could make, or an adult decision without a cause.
  const blocking = auditEvents(refitted).filter(item => item.rule === 2 || item.rule === 4);
  if (blocking.length) throw new Error(`Event rules broken: ${blocking.map(item => `rule ${item.rule} ${item.eventId} (${item.message})`).join("; ")}`);
  return refitted;
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
  Object.assign(world.flags, milestoneFlags());
  world.events = [...world.events, ...inspirationEvents(), ...holdingsEvents(), ...needsEvents(), ...moveEvents(), ...milestoneEvents()];
}
