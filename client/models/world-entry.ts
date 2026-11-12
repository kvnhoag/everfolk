export interface ActiveWorldSummary {
  id: string;
  pack: { demo?: unknown; version?: string };
}

/**
 * Determines whether entering a world should load the default bundled demo lives.
 * Direct selection of the default world or restarting an active demo loads demo lives;
 * selecting explicit classic (e.g. alexandria-sample) or custom worlds does not.
 */
export function entryUsesDefaultLives(
  targetId: string,
  fresh: boolean,
  activeWorld?: ActiveWorldSummary | null
): boolean {
  if (targetId === "alexandria" || targetId === "alexandria-demo") {
    return true;
  }
  if (Boolean(activeWorld?.pack?.demo) && fresh && targetId === activeWorld?.id) {
    return true;
  }
  return false;
}

/**
 * Determines whether an unbegun life in an older demo world pack should be refreshed
 * to the latest default demo world revision at startup.
 */
export function startupRefreshesToDefault(
  pack: { demo?: unknown; version?: string } | undefined,
  hasBegunLife: boolean,
  defaultVersion: string
): boolean {
  if (hasBegunLife) return false;
  if (!pack || !pack.demo) return false;
  return pack.version !== defaultVersion;
}
