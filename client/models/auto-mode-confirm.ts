/**
 * Confirmation before turning Auto mode on. Turning it off never asks; checking
 * "Don't ask again in this life" skips future prompts for the current life only. Pure.
 */

export const AUTO_MODE_CONFIRM_COPY = {
  title: "Let Auto mode choose?",
  body: "Auto mode picks your turning points and yearly actions for you. Your life may not turn out the way you intended.",
  confirm: "Turn on Auto mode",
  cancel: "Keep choosing myself",
  remember: "Don't ask again in this life",
} as const;

export type AutoModeToggleAction = "off" | "on" | "confirm";

const MAX_REMEMBERED_LIVES = 20;

/** Turning Auto mode off never asks; turning it on confirms unless this life opted out. */
export function autoModeToggleAction(
  currentAuto: boolean,
  targetAuto: boolean,
  lifeKey: string,
  skippedLives: ReadonlySet<string>,
): AutoModeToggleAction {
  if (!targetAuto) return "off";
  if (currentAuto) return "on";
  return skippedLives.has(lifeKey) ? "on" : "confirm";
}

export function recordSkippedAutoConfirm(
  skippedLives: ReadonlySet<string>,
  lifeKey: string,
  remember: boolean,
): ReadonlySet<string> {
  if (!remember || skippedLives.has(lifeKey)) return skippedLives;
  const next = new Set(skippedLives);
  next.add(lifeKey);
  return next;
}

export function clearSkippedAutoConfirm(
  skippedLives: ReadonlySet<string>,
  lifeKey: string,
): ReadonlySet<string> {
  if (!skippedLives.has(lifeKey)) return skippedLives;
  const next = new Set(skippedLives);
  next.delete(lifeKey);
  return next;
}

export function parseSkippedAutoConfirmLives(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function serializeSkippedAutoConfirmLives(lives: ReadonlySet<string>): string {
  return JSON.stringify([...lives].slice(-MAX_REMEMBERED_LIVES));
}
