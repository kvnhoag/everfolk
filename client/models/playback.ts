export type PlaybackSpeed = 1 | 2 | 4 | 8 | 12 | 16;

/** Real time for one in-game year at 1×. */
export const YEAR_DURATION_MS = 25_000;
/** A new life starts at 4× (about six seconds a year) so a whole life fits a short session. */
export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 4;

export function secondsPerYear(speed: PlaybackSpeed): number {
  return YEAR_DURATION_MS / speed / 1000;
}
