import type { CareerGroup, Category, FigureId } from "./ids.ts";

/** JSON views returned by the Everfolk lives contract. Rust structs serialize to exactly these shapes. */
export interface FigurePick { figure_id: FigureId; token_id: string; action_id: string; rarity: number }
export interface Draw {
  step: number; category: Category; token_id: string | null; action_id: string | null; rarity: number | null; commands_hash: string;
}
export interface Checkpoint { step: number; commands_hash: string }
export interface LifeView {
  life_id: string; account_id: string; seed: string; world_version: string;
  status: "alive" | "minted" | "abandoned";
  figure_picks: FigurePick[]; draws: Draw[]; checkpoints: Checkpoint[]; started_at_ms: number;
}

/** Integer impact: Σ base weight × rarity power bps over the influences that fired in a life. */
export interface SourceImpact { token_id: string; impact: number }

/** Signed by the verifier as the UTF-8 bytes of canonicalJson(evidence). */
export interface Evidence {
  /** `seed` is the hex seed from LifeView; the contract rejects evidence for any other seed. */
  v: 1; seed: string; life_id: string; account_id: string; world_version: string; world_fingerprint: string; save_hash: string;
  stats: Record<string, number>; skills: Record<string, number>; origin_id: string; peak_job_id: string | null;
  accomplishments: { id: string; age: number }[]; death_age: number; birth_year: number; death_year: number;
  career_group: CareerGroup; matched_figures: FigureId[]; sources: SourceImpact[];
}

export interface MintResult { token_id: string; kind: "figure" | "npc"; figure_id: FigureId | null; rarity: number; affection: number }
export interface SourceShare { token_id: string; bps: number }
export interface TokenExtra {
  kind: "figure" | "npc"; figure_id: FigureId | null; rarity: number; affection: number; action_id: string;
  life_id: string; birth_year: number; death_year: number; career_group: CareerGroup; sources: SourceShare[]; evidence_hash: string;
}
/** `earned` is yoctoNEAR as a decimal string. */
export interface TokenStats { lives_influenced: number; earned: string }
export interface Listing { token_id: string; seller_id: string; price: string }
export interface PoolEntry { token_id: string; affection: number; rarity: number; action_id: string }

/** Engine command added by the influence change (lane B). */
export interface InfluenceCommand {
  type: "influence"; source: { contractId: string; tokenId: string }; entry: string; power: number; mode: "activate" | "apply";
}
