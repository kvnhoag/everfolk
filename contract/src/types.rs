use near_sdk::json_types::{U128, U64};
use crate::shares::Share;
use near_sdk::{near, AccountId};
use std::collections::HashMap;

pub const MAX_BPS: u16 = 10_000;

/// Admin-tunable economics. Every `*_bps` value is in basis points.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Params {
    pub mint_fee: U128,
    pub drop_rate_bps: u16,
    pub source_mint_share_bps: u16,
    pub royalty_sources_bps: u16,
    pub royalty_treasury_bps: u16,
    pub nobody_weight_bps: u16,
    pub abandon_cooldown_ms: u64,
    pub evidence_base_url: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct FigureConfig {
    pub figure_id: String,
    pub title: String,
    pub media: String,
    pub supply_cap: u32,
    pub action_ids: Vec<String>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct NpcActionConfig {
    pub action_id: String,
    pub career_group: String,
    pub category: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct CatalogConfig {
    pub figures: Vec<FigureConfig>,
    pub npc_actions: Vec<NpcActionConfig>,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LifeStatus {
    Alive,
    Minted,
    Abandoned,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TokenKind {
    Figure,
    Npc,
}

/// Game-facing facts about a minted token; ownership lives in the NFT standard state.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenRecord {
    pub kind: TokenKind,
    pub figure_id: Option<String>,
    pub category: Option<String>,
    pub rarity: u8,
    pub affection: u8,
    pub action_id: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct FigurePick {
    pub figure_id: String,
    pub token_id: String,
    pub action_id: String,
    pub rarity: u8,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Draw {
    pub step: u32,
    pub category: String,
    pub token_id: Option<String>,
    pub action_id: Option<String>,
    pub rarity: Option<u8>,
    pub commands_hash: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Checkpoint {
    pub step: u32,
    pub commands_hash: String,
}

#[near(serializers = [borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Life {
    pub account_id: AccountId,
    pub seed: [u8; 32],
    pub world_version: String,
    pub status: LifeStatus,
    pub figure_picks: Vec<FigurePick>,
    pub draws: Vec<Draw>,
    pub checkpoints: Vec<Checkpoint>,
    pub started_at_ms: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct LifeView {
    pub life_id: U64,
    pub account_id: AccountId,
    pub seed: String,
    pub world_version: String,
    pub status: LifeStatus,
    pub figure_picks: Vec<FigurePick>,
    pub draws: Vec<Draw>,
    pub checkpoints: Vec<Checkpoint>,
    pub started_at_ms: u64,
}

impl LifeView {
    pub fn from_life(life_id: u64, life: &Life) -> Self {
        Self {
            life_id: U64(life_id),
            account_id: life.account_id.clone(),
            seed: hex::encode(life.seed),
            world_version: life.world_version.clone(),
            status: life.status,
            figure_picks: life.figure_picks.clone(),
            draws: life.draws.clone(),
            checkpoints: life.checkpoints.clone(),
            started_at_ms: life.started_at_ms,
        }
    }
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct SourceImpact {
    pub token_id: String,
    pub impact: u64,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Accomplishment {
    pub id: String,
    pub age: u32,
}

/// What the verifier attests after replaying a ranked life. Signed as the exact JSON string received.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Evidence {
    pub v: u8,
    /// Hex seed the contract assigned at birth; ties evidence to one life on one deployment.
    pub seed: String,
    pub life_id: String,
    pub account_id: AccountId,
    pub world_version: String,
    pub world_fingerprint: String,
    pub save_hash: String,
    pub stats: HashMap<String, f64>,
    pub skills: HashMap<String, f64>,
    pub origin_id: String,
    pub peak_job_id: Option<String>,
    pub accomplishments: Vec<Accomplishment>,
    pub death_age: u32,
    pub birth_year: i32,
    pub death_year: i32,
    pub career_group: String,
    pub matched_figures: Vec<String>,
    pub sources: Vec<SourceImpact>,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct MintResult {
    pub token_id: String,
    pub kind: TokenKind,
    pub figure_id: Option<String>,
    pub rarity: u8,
    pub affection: u8,
}

/// Stored as JSON in NEP-177 `extra`; mirrors `TokenExtra` in chain/types.ts.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenExtra {
    pub kind: TokenKind,
    pub figure_id: Option<String>,
    pub rarity: u8,
    pub affection: u8,
    pub action_id: String,
    pub life_id: String,
    pub birth_year: i32,
    pub death_year: i32,
    pub career_group: String,
    pub sources: Vec<Share>,
    pub evidence_hash: String,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, Default, PartialEq)]
pub struct TokenStats {
    pub lives_influenced: u32,
    pub earned: U128,
}
