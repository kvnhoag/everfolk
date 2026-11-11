import type { LifeState, SaveFile } from "../src/types.ts";
import { canonicalJson } from "../src/random.ts";
import { sha256Hex } from "./hash.ts";
import { computeImpacts } from "./impact.ts";
import { careerGroupOf, matchFigures, peakJobOf } from "./match.ts";
import type { Evidence, LifeView } from "./types.ts";

export interface EvidenceInput { life: LifeView; save: SaveFile; state: LifeState; worldFingerprint: string }

function assertSameLife({ life, save, state, worldFingerprint }: EvidenceInput): void {
  if (save.seed !== life.seed || state.seed !== life.seed) throw new Error("This save does not match the ranked life's seed.");
  if (save.worldFingerprint !== worldFingerprint || state.worldFingerprint !== worldFingerprint) {
    throw new Error("This save was played in a different world.");
  }
  if (canonicalJson(state.commands) !== canonicalJson(save.commands)) throw new Error("The replayed life does not match the save's commands.");
  if (state.phase !== "ended") throw new Error("This life has not ended yet.");
}

function birthYear(state: LifeState): number {
  const birth = state.journal.find(entry => entry.type === "birth");
  if (!birth) throw new Error("This life has no recorded birth.");
  return birth.year;
}

/** What the verifier signs for a finished ranked life. Every input must describe the same replayed life. */
export async function buildEvidence(input: EvidenceInput): Promise<Evidence> {
  assertSameLife(input);
  const { life, save, state, worldFingerprint } = input;
  return {
    v: 1,
    seed: life.seed,
    life_id: life.life_id,
    account_id: life.account_id,
    world_version: life.world_version,
    world_fingerprint: worldFingerprint,
    save_hash: await sha256Hex(canonicalJson(save)),
    stats: { ...state.stats },
    skills: { ...state.character?.skills },
    origin_id: state.originId,
    peak_job_id: peakJobOf(state),
    accomplishments: (state.accomplishments ?? []).map(record => ({ id: record.achievementId, age: record.age })),
    death_age: state.age,
    birth_year: birthYear(state),
    death_year: state.year,
    career_group: careerGroupOf(state),
    matched_figures: matchFigures(state),
    sources: computeImpacts(save.commands, state.journal),
  };
}

/** The exact bytes the verifier signs: `evidence_json`. */
export function serializeEvidence(evidence: Evidence): string {
  return canonicalJson(evidence);
}
