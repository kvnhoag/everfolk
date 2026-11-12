/** A new world keeps all existing ranked save revisions unchanged. */
export const NPC_WORLD_VERSION = "alexandria-npc-1";

export interface NpcSessionAttestation {
  session_id: string;
  transcript_hash: string;
  provider_checked_at: number;
  expires_at: number;
}

/** A domain-separated server challenge is signed by the player's existing NEAR play key. */
export interface AccountProof {
  accountId: string;
  publicKey: string;
  signature: string;
}
