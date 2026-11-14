/**
 * Free-play world revisions. Each published pack stays byte-identical so recorded lives replay.
 *
 * - alexandria-lives-5: the official life-stage/path rules (retained).
 * - alexandria-lives-6: figure paths on lives-5 (built by scripts/figures/build-world.mjs; retained).
 * - alexandria-lives-7: lives-5 rules plus proof from work and market trading from age 10 (retained).
 * - alexandria-lives-8: figure paths on the lives-7 rules (retained).
 * - alexandria-lives-9: lives-8 with births spread from 400 to 300 BCE, likelier where history happens (retained).
 * - alexandria-lives-10: household resources on the contribution worlds, born 350–300 BCE (retained).
 * - alexandria-lives-11: lives-10 born across 400–300 BCE, likelier where history happens — current new births.
 */
/** The rules-only life-stage revision that buildLifeStageWorld produces (proof from work, trade from age 10). */
export const LIVES_RULES_WORLD_VERSION = "alexandria-lives-7";
/** Figure paths built on LIVES_RULES_WORLD_VERSION (retained so its lives replay; the NPC sessions use it). */
export const LIVES_FIGURES_WORLD_VERSION = "alexandria-lives-8";
/** Retained published figure-path births spread across 400–300 BCE. */
export const LIVES_BORN_HISTORY_WORLD_VERSION = "alexandria-lives-9";
/** Household-resource successor (modest working starts, larger merchant and aristocratic reserves); retained so its saves replay. */
export const LIVES_HOUSEHOLD_WORLD_VERSION = "alexandria-lives-10";
/** Current new births: LIVES_HOUSEHOLD_WORLD_VERSION born across 400–300 BCE, likelier where history happens. */
export const LIVES_WORLD_VERSION = "alexandria-lives-11";
/** New free-play births (alexandria-lives-7 and later) may trade at the grain market from this age; older packs keep 12. */
export const LIVES_MIN_TRADE_AGE = 10;
