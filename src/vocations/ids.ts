/**
 * Free-play world revisions. Each published pack stays byte-identical so recorded lives replay.
 *
 * - alexandria-lives-5: the official life-stage/path rules (retained).
 * - alexandria-lives-6: figure paths on lives-5 (built by scripts/figures/build-world.mjs; retained).
 * - alexandria-lives-7: lives-5 rules plus proof from work and market trading from age 10 (retained).
 * - alexandria-lives-8: figure paths on the lives-7 rules — current new births.
 */
/** The rules-only life-stage revision that buildLifeStageWorld produces (proof from work, trade from age 10). */
export const LIVES_RULES_WORLD_VERSION = "alexandria-lives-7";
/** New free-play births only: figure paths built on LIVES_RULES_WORLD_VERSION. Deployed ranked versions remain unchanged. */
export const LIVES_WORLD_VERSION = "alexandria-lives-8";
/** New free-play births (alexandria-lives-7 and later) may trade at the grain market from this age; older packs keep 12. */
export const LIVES_MIN_TRADE_AGE = 10;
