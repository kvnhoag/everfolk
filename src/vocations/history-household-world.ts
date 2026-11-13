import type { WorldPack } from "../types.ts";
import { auditEvents } from "../paths/audit.ts";
import { BIRTH_YEAR_RANGE, withHistoryBirthYears } from "./birth-years.ts";
import { LIVES_HOUSEHOLD_WORLD_VERSION, LIVES_WORLD_VERSION } from "./ids.ts";

/**
 * Current new births (LIVES_WORLD_VERSION): the household-resource world (LIVES_HOUSEHOLD_WORLD_VERSION),
 * born from 400 to 300 BCE and likelier in the years whose lives see the most history.
 * Only the birth years and the events anchored to the world's start move; household reserves are untouched.
 */
export function buildHistoryHouseholdWorld(household: WorldPack): WorldPack {
  if (household.version !== LIVES_HOUSEHOLD_WORLD_VERSION) throw new Error(`Births across history build on ${LIVES_HOUSEHOLD_WORLD_VERSION}, not ${household.version}.`);
  const world = withHistoryBirthYears(household, BIRTH_YEAR_RANGE);
  world.version = LIVES_WORLD_VERSION;
  world.description = `${household.description} Lives are born between 400 and 300 BCE, most often in the years that live through Alexander, the founding of Alexandria and the first Ptolemies.`;
  // lives-10 is retained as published; only rules the birth-year move would newly break stop the build.
  const known = new Set(auditEvents(household).map(item => `${item.rule}:${item.eventId}:${item.message}`));
  const broken = auditEvents(world).filter(item => !known.has(`${item.rule}:${item.eventId}:${item.message}`));
  if (broken.length) throw new Error(`Event rules broken: ${broken.map(item => `rule ${item.rule} ${item.eventId} (${item.message})`).join("; ")}`);
  return world;
}
