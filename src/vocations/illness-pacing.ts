/**
 * Milder severe illness for the new free-play world (play-tested: healthy adults went from Health
 * 80 to 20 in one year and died whatever care they chose). Retained worlds keep their exact rules.
 * Tuned with the 500-life measurement in docs/agent-tasks/8-playtest-fixes.md (Track A).
 */
import type { WorldPack } from "../types.ts";

/** Share of the reference adult episode rate that still strikes: fewer severe onsets. */
export const ADULT_ONSET_SHARE = 0.8;
/** The onset takes a healthy adult down by this much, not to the floor. */
export const ONSET_LOSS = 25;
/** Years a severe illness runs, unable to kill, before its fatality is drawn. */
export const LINGER_YEARS = 2;
/** A lingering illness passes on its own only rarely; care and the final-year draw carry most of the weight. */
export const LINGER_RECOVERY = 0.1;
/** Health lost in each lingering year, before care and support reduce it. */
export const LINGER_LOSS = 8;

export function applyIllnessPacing(world: WorldPack): void {
  const calibration = world.health?.mortalityCalibration;
  if (!calibration || !world.mortality) return;
  Object.assign(calibration, { onsetLoss: ONSET_LOSS, lingerYears: LINGER_YEARS, lingerLoss: LINGER_LOSS, lingerRecovery: LINGER_RECOVERY });
  world.mortality.bands = world.mortality.bands.map(band => band.minAge >= calibration.minAge
    ? { ...band, annualProbability: band.annualProbability * ADULT_ONSET_SHARE } : band);
  world.health!.description = `${world.health!.description} Here a severe illness runs for years: Health falls part of the way at first, the illness can pass or drag on, and it cannot be fatal until two years after it begins. Care and household support lower the final risk, and a healer helps most. Adult episodes strike about ${Math.round(ADULT_ONSET_SHARE * 100)}% as often as the reference baseline.`;
}
