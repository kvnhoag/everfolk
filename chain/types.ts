import type { CareerGroup, Category, FigureId } from "./ids.ts";
import type { MatchedStageFigure, StageRecord } from "./stage-figures.ts";
import type { NpcSessionAttestation } from "./npc-proof.ts";
import type { EarnedCard } from "./earned-cards.ts";

/** JSON views returned by the Everfolk lives contract. Rust structs serialize to exactly these shapes. */
export interface FigurePick { figure_id: FigureId; token_id: string; action_id: string; rarity: number }
export interface Draw {
  step: number; category: Category; token_id: string | null; action_id: string | null; rarity: number | null; commands_hash: string;
}
export interface Checkpoint { step: number; commands_hash: string }
export interface LifeView {
  life_id: string; account_id: string; seed: string; world_version: string;
  status: "alive" | "minted" | "abandoned" | "minting";
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
  stage_records?: StageRecord[];
  stage_figures?: MatchedStageFigure[];
  /** Required only for the NPC world; signed with the rest of the finished-life evidence. */
  npc_session?: NpcSessionAttestation;
  /** The played character's recorded sex; picks a profession card's version (chain/card-art.ts). Older evidence omits it. */
  sex?: "male" | "female";
  /** The cards this life earned on historical figure paths (chain/earned-cards.ts); only these can be minted. */
  earned_cards?: EarnedCard[];
}

export interface StageMintCard extends EditionPreviewFields {
  stage_id: string; figure_id: FigureId | null; title: string; character_name: string;
  portrait_media: string; stage_record: StageRecord; fee: string; action_id: string;
  rarity?: number;
}
export interface StageMintQuote {
  total_fee: string;
  source_share_bps: number;
  cards: StageMintCard[];
  /** Commits the reviewed card identities, rarities and fees, excluding changing serial previews. */
  quote_hash?: string;
}
export interface StageMintResult { life_id: string; evidence_hash: string; total_fee: string; tokens: (MintResult & { stage_id: string })[] }

/** Immutable edition assigned by the mint transaction. Older tokens may omit all three fields. */
export interface EditionFields {
  edition_key?: string;
  edition_number?: number;
  /** Null is unlimited (currently Common and Uncommon), never an unknown cap. Minted records retain their original limit. */
  edition_limit?: number | null;
}

/** Current supply of one card design and rarity; an unreserved preview of its next serial. */
export interface EditionSupply {
  edition_key: string;
  rarity: number;
  minted: number;
  edition_limit: number | null;
  next_edition_number: number | null;
}

/** Live supply previews can change before the mint transaction assigns an immutable serial. */
export interface EditionPreviewFields {
  edition_key?: string;
  edition_limit?: number | null;
  minted?: number;
  next_edition_number?: number | null;
}

export interface MintResult extends EditionFields {
  token_id: string;
  kind: "figure" | "npc";
  figure_id: FigureId | null;
  rarity: number;
  affection: number;
  stage_id?: string;
  stage_title?: string;
  character_name?: string;
  portrait_media?: string;
}
export interface MintCard extends EditionPreviewFields {
  kind: "figure" | "npc";
  figure_id: FigureId | null;
  rarity: number;
  affection: number;
  action_id: string;
  stage_id?: string;
  stage_title?: string;
  character_name?: string;
  district?: string;
  field?: string | null;
  tier?: string | number;
  portrait_media?: string;
  stage_record?: StageRecord;
  /** The v14 collection card this slot shows (chain/card-art.ts); absent when the collection has none. */
  card_id?: string;
}
export interface MintPack { life_id: string; evidence_hash: string; cards: MintCard[]; total_fee: string; source_share_bps: number }
export interface MintTerms { mint_fee: string; source_share_bps: number; pack_version: number }
export interface SourceShare { token_id: string; bps: number }
export interface TokenExtra extends EditionFields {
  kind: "figure" | "npc"; figure_id: FigureId | null; rarity: number; affection: number; action_id: string;
  life_id: string; birth_year: number; death_year: number; career_group: CareerGroup; sources: SourceShare[]; evidence_hash: string;
  stage_id?: string;
  stage_title?: string;
  from_age?: number;
  to_age?: number;
  character_name?: string;
  district?: string;
  field?: string | null;
  tier?: string | number;
  portrait_media?: string;
  stage_record?: StageRecord;
  /** The v14 collection card this NFT shows; absent on tokens minted before card art and on stage portraits. */
  card_id?: string;
  sex?: "male" | "female";
  /** Marketplace traits: Card, Rarity, Edition, Career, Born, Died. */
  attributes?: { trait_type: string; value: string }[];
}
/** `earned` is yoctoNEAR as a decimal string. */
export interface TokenStats { lives_influenced: number; earned: string }
export interface Listing { token_id: string; seller_id: string; price: string }
export interface PoolEntry { token_id: string; affection: number; rarity: number; action_id: string }

/** Engine command added by the influence change (lane B). */
export interface InfluenceCommand {
  type: "influence"; source: { contractId: string; tokenId: string }; entry: string; power: number; mode: "activate" | "apply";
}
