import type { ContentDatabase } from "../store.ts";

interface EvidenceRow { evidence_json: string; save_json: string }

/** Content-addressed: re-verifying the same life writes the same row, so duplicates are ignored. */
export async function storeEvidence(db: ContentDatabase, hash: string, evidenceJson: string, saveJson: string, now: Date): Promise<void> {
  await db.prepare("INSERT OR IGNORE INTO ranked_evidence (hash, evidence_json, save_json, created_at) VALUES (?, ?, ?, ?)")
    .bind(hash, evidenceJson, saveJson, now.toISOString()).run();
}

export async function readEvidence(db: ContentDatabase, hash: string): Promise<{ evidence: unknown; save: unknown } | null> {
  const row = await db.prepare("SELECT evidence_json, save_json FROM ranked_evidence WHERE hash = ?").bind(hash).first<EvidenceRow>();
  return row ? { evidence: JSON.parse(row.evidence_json), save: JSON.parse(row.save_json) } : null;
}
