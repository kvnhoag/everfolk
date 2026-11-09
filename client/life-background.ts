/** Presentation-only variation, independent of every gameplay random draw. */
export function portraitVariant(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  return (hash >>> 0) % 3;
}
