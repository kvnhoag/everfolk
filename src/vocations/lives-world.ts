import type { WorldPack } from "../types.ts";
import { buildFigurePathWorld } from "../figures/world.ts";
import { tagTaughtFields } from "../paths/content/refits.ts";
import { auditEvents } from "../paths/audit.ts";
import { LIVES_FIGURES_WORLD_VERSION, LIVES_RULES_WORLD_VERSION, LIVES_WORLD_VERSION } from "./ids.ts";
import { BIRTH_YEAR_RANGE, withHistoryBirthYears } from "./birth-years.ts";

/**
 * The figure-path revision (LIVES_FIGURES_WORLD_VERSION): the life-stage rules pack built by
 * buildLifeStageWorld (LIVES_RULES_WORLD_VERSION) with the historical figure paths added.
 * Figure stories that teach a field's skill are tagged with that field, as life-path events are.
 */
export function buildLivesWorld(rules: WorldPack): WorldPack {
  if (rules.version !== LIVES_RULES_WORLD_VERSION) throw new Error(`Figure paths for new births build on ${LIVES_RULES_WORLD_VERSION}, not ${rules.version}.`);
  const world = tagTaughtFields(buildFigurePathWorld(rules, LIVES_FIGURES_WORLD_VERSION));
  if (world.demo?.market.depth) world.demo.market.depth.monotoneOrder = true;
  // The build fails rather than ship an event that breaks the life-paths rules.
  const broken = auditEvents(world);
  if (broken.length) throw new Error(`Event rules broken: ${broken.map(item => `rule ${item.rule} ${item.eventId} (${item.message})`).join("; ")}`);
  return world;
}

/** Current free-play births (LIVES_WORLD_VERSION): the figure-path world, born from 400 to 300 BCE and likelier where history happens. */
export function buildBornAcrossHistoryWorld(figures: WorldPack): WorldPack {
  if (figures.version !== LIVES_FIGURES_WORLD_VERSION) throw new Error(`Births across history build on ${LIVES_FIGURES_WORLD_VERSION}, not ${figures.version}.`);
  const world = withHistoryBirthYears(figures, BIRTH_YEAR_RANGE);
  world.version = LIVES_WORLD_VERSION;
  world.description = `${figures.description} Lives are born between 400 and 300 BCE, most often in the years that live through Alexander, the founding of Alexandria and the first Ptolemies.`;
  const broken = auditEvents(world);
  if (broken.length) throw new Error(`Event rules broken: ${broken.map(item => `rule ${item.rule} ${item.eventId} (${item.message})`).join("; ")}`);
  return world;
}
