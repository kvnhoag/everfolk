import type { DemoDefinition } from "./types.ts";

/** Scale authored bulk-crop quantities while retaining a whole unit for positive inputs.
 * Absent configuration preserves every retained world's original quantities. */
export function scaleCropQuantity(def: Pick<DemoDefinition, "resourceScaleDivisor"> | undefined, quantity: number): number {
  if (quantity === 0) return 0;
  const sign = Math.sign(quantity);
  return sign * Math.max(1, Math.floor(Math.abs(quantity) / (def?.resourceScaleDivisor ?? 1)));
}
