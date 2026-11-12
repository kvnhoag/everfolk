import type { LifeState } from "../types.ts";
/** Older immutable worlds retain their soldier-only service behavior. */
export function hasServiceRole(life: LifeState): boolean {
  const job=life.character?.jobId;
  return job === "soldier" || Boolean(life.capabilities && life.character?.skills.strength !== undefined && (job === "officer" || job === "general"));
}
