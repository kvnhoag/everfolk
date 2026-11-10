/**
 * Free play's App remounts when a ranked life closes. If it still carried `fresh: true` from an earlier
 * "Begin another life", it would roll a new life over the saved one, so a ranked start clears it.
 */
export function keepFreePlayOnRankedStart<T extends { fresh: boolean; previousLife?: unknown }>(active: T | null): T | null {
  if (!active || (!active.fresh && active.previousLife === undefined)) return active;
  const { previousLife: _dropped, ...rest } = active;
  return { ...rest, fresh: false } as T;
}
