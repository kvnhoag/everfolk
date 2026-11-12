import type { ContentDatabase } from "../db/types.ts";

interface EvidenceRow { evidence_json: string; save_json: string }

/** Content-addressed: re-verifying the same life writes the same row, so duplicates are ignored. */
export async function storeEvidence(db: ContentDatabase, hash: string, evidenceJson: string, saveJson: string, now: Date): Promise<void> {
  await db.prepare("INSERT OR IGNORE INTO ranked_evidence (hash, evidence_json, save_json, created_at) VALUES (?, ?, ?, ?)")
    .bind(hash, evidenceJson, saveJson, now.toISOString()).run();
}

/** Keep the signed bytes intact: NFT reference_hash commits to evidence_json, not a JSON wrapper. */
export async function readEvidence(db: ContentDatabase, hash: string): Promise<{ evidenceJson: string; saveJson: string } | null> {
  const row = await db.prepare("SELECT evidence_json, save_json FROM ranked_evidence WHERE hash = ?").bind(hash).first<EvidenceRow>();
  return row ? { evidenceJson: row.evidence_json, saveJson: row.save_json } : null;
}
