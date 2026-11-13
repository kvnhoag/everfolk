export type PlaybackSpeed = 1 | 2 | 4 | 8 | 12 | 16;

/** Real time for one in-game year at 1×. */
export const YEAR_DURATION_MS = 25_000;
/** A new life starts at 2× (about twelve seconds a year): enough time to read a year before it passes. */
export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 2;

export function secondsPerYear(speed: PlaybackSpeed): number {
  return YEAR_DURATION_MS / speed / 1000;
}
