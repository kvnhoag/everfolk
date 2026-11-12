import type { Effect, WorldPack } from "../../../src/types.ts";
import { validateWorld } from "../../../src/validate.ts";

/** Validate the actual authoring location, including outcome-only effects. */
export function validateEditedEffects(world: WorldPack, previous: readonly Effect[], next: readonly Effect[]): void {
  let replacements = 0;
  const copy = (value: unknown): unknown => {
    if (value === previous) { replacements++; return structuredClone(next); }
    if (Array.isArray(value)) return value.map(copy);
    if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item)]));
    return value;
  };
  const candidate = copy(world);
  if (replacements !== 1) throw new Error("This effect list no longer matches the current world. Reopen its editor before applying changes.");
  validateWorld(candidate);
}
