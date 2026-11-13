//! Post-life stage albums. Separate JSON keys preserve the deployed Contract/Life/MintRecord layouts.
use crate::mint::Outcome;
use crate::random::{block_seed, roll};
use crate::shares::compute_shares;
use crate::types::*;
use crate::{Contract, ContractExt};
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, require, serde_json, Gas, Promise, PromiseOrValue};
use std::collections::HashMap;

pub const GENERIC_FEE: u128 = 2_000_000_000_000_000_000_000; // 0.002 testnet NEAR
pub const HISTORICAL_FEE: u128 = 10_000_000_000_000_000_000_000; // 0.01 testnet NEAR
const STAGES: [(&str, u32); 7] = [
    ("infancy", 0),
    ("early-childhood", 3),
    ("childhood", 6),
    ("adolescence", 12),
    ("youth", 14),
    ("adulthood", 16),
    ("later-life", 60),
];

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct StageRecord {
    pub stage_id: String,
    pub title: String,
    pub from_age: u32,
    pub to_age: u32,
    pub district: String,
    pub field: Option<String>,
    pub tier: serde_json::Value,
    pub job_id: Option<String>,
    pub top_skills: HashMap<String, f64>,
    pub nodes: Vec<String>,
    pub reputation: f64,
    pub accomplishments: Vec<String>,
    pub mentors: Vec<String>,
}
#[near(serializers = [json])]
#[derive(Clone)]
#[serde(rename_all = "camelCase")]
struct StageFigure {
    stage_id: String,
    kind: String,
    figure_id: Option<String>,
    title: String,
    name: String,
    media: String,
    generic_media: String,
    character_name: String,
    stage_record: StageRecord,
}
#[near(serializers = [json])]
struct StageEvidence {
    stage_records: Vec<StageRecord>,
    stage_figures: Vec<StageFigure>,
}
#[near(serializers = [json])]
#[derive(Clone)]
pub struct StageCard {
    pub stage_id: String,
    pub figure_id: Option<String>,
    pub title: String,
    pub character_name: String,
    pub portrait_media: String,
    pub stage_record: StageRecord,
    pub fee: U128,
    pub action_id: String,
}
#[near(serializers = [json])]
#[derive(Clone)]
pub struct StageQuote {
    pub total_fee: U128,
    pub source_share_bps: u16,
    pub cards: Vec<StageCard>,
}
#[near(serializers = [json])]
#[derive(Clone)]
pub struct StageMintToken {
    #[serde(flatten)]
    pub result: MintResult,
    pub stage_id: String,
    pub stage_title: String,
    pub character_name: String,
    pub portrait_media: String,
}
#[near(serializers = [json])]
#[derive(Clone)]
pub struct StageMintResult {
    pub life_id: U64,
    pub evidence_hash: String,
    pub total_fee: U128,
    pub tokens: Vec<StageMintToken>,
}
#[near(serializers = [json])]
struct PendingAlbum {
    evidence_json: String,
    seed: [u8; 32],
    quote: StageQuote,
    params: Params,
    catalog: CatalogConfig,
}
#[near(serializers = [json])]
#[serde(tag = "state")]
enum Album {
    Pending(PendingAlbum),
    Complete(StageMintResult),
}
fn key(id: u64) -> Vec<u8> {
    format!("everfolk:stage-mint:{id}").into_bytes()
}
fn read(id: u64) -> Option<Album> {
    env::storage_read(&key(id))
        .map(|bytes| serde_json::from_slice(&bytes).expect("stored stage mint"))
}
fn write(id: u64, album: &Album) {
    env::storage_write(
        &key(id),
        &serde_json::to_vec(album).expect("stage mint json"),
    );
}
fn gas_floor() {
    require!(
        env::prepaid_gas() >= Gas::from_tgas(300),
        "Attach at least 300 Tgas for a stage album"
    );
}
fn schedule(id: U64) -> Promise {
    Contract::ext(env::current_account_id())
        .with_static_gas(Gas::from_tgas(240))
        .with_unused_gas_weight(0)
        .finalize_stage_mint(id)
}
fn asset_path(path: &str) -> bool {
    path.starts_with("/assets/")
        && !path.contains("..")
        && path
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"/._-".contains(&b))
}

#[near]
impl Contract {
    /// Quotes all lived stages. Historical supply is reserved only by the paid request.
    pub fn stage_mint_quote(
        &self,
        life_id: U64,
        evidence_json: String,
        npc_action_id: String,
    ) -> StageQuote {
        require!(
            evidence_json.len() <= 100_000,
            "Stage evidence is too large"
        );
        let evidence: Evidence = serde_json::from_str(&evidence_json).expect("life evidence json");
        // Life-stage NFTs are off for figure-path worlds: only earned cards are minted, through the pack.
        require!(evidence.earned_cards.is_none(), "Life-stage NFTs are turned off; mint an earned card from this life's pack");
        let life = self.lives.get(&life_id.0).expect("Life not found");
        self.assert_evidence(life_id.0, life, &evidence, &npc_action_id);
        let stages: StageEvidence = serde_json::from_str(&evidence_json)
            .expect("Stage records and signed portraits are required");
        let expected: Vec<_> = STAGES
            .iter()
            .filter(|(_, start)| *start <= evidence.death_age)
            .collect();
        require!(
            stages.stage_records.len() == expected.len()
                && stages.stage_figures.len() == expected.len(),
            "Include every lived stage exactly once"
        );
        let mut cards = Vec::new();
        let mut allocated: HashMap<String, u32> = HashMap::new();
        for (i, (stage, fig)) in stages
            .stage_records
            .iter()
            .zip(stages.stage_figures.iter())
            .enumerate()
        {
            let (id, start) = *expected[i];
            let end = STAGES
                .get(i + 1)
                .map(|(_, a)| a - 1)
                .unwrap_or(evidence.death_age)
                .min(evidence.death_age);
            require!(
                stage.stage_id == id && stage.from_age == start && stage.to_age == end,
                "Invalid lived stage window or order"
            );
            require!(
                fig.stage_id == id && fig.stage_record == *stage,
                "Stage portrait does not match its record"
            );
            require!(
                fig.kind == "generic" || fig.kind == "historical",
                "Unknown stage figure kind"
            );
            require!(
                (fig.kind == "historical") == fig.figure_id.is_some(),
                "Historical name is required only for historical stages"
            );
            require!(
                asset_path(&fig.media) && asset_path(&fig.generic_media),
                "Portrait must use a public asset path"
            );
            let candidate = fig.figure_id.as_ref().map(|id| {
                self.catalog
                    .figures
                    .iter()
                    .find(|f| &f.figure_id == id)
                    .expect("Unknown stage historical figure")
            });
            let figure = candidate.filter(|f| {
                let used = self
                    .figure_copies
                    .get(&f.figure_id)
                    .map(|v| v.len() as u32)
                    .unwrap_or(0);
                used + self.pack_reserved(&f.figure_id)
                    + allocated.get(&f.figure_id).copied().unwrap_or(0)
                    < f.supply_cap
            });
            if let Some(f) = figure {
                *allocated.entry(f.figure_id.clone()).or_default() += 1;
            }
            cards.push(StageCard {
                stage_id: id.into(),
                figure_id: figure.map(|f| f.figure_id.clone()),
                title: if figure.is_some() {
                    fig.title.clone()
                } else {
                    stage.title.clone()
                },
                character_name: if figure.is_some() {
                    fig.name.clone()
                } else {
                    fig.character_name.clone()
                },
                portrait_media: if figure.is_some() {
                    fig.media.clone()
                } else {
                    fig.generic_media.clone()
                },
                stage_record: stage.clone(),
                fee: U128(if figure.is_some() {
                    HISTORICAL_FEE
                } else {
                    GENERIC_FEE
                }),
                action_id: figure
                    .map(|f| f.action_ids[0].clone())
                    .unwrap_or_else(|| npc_action_id.clone()),
            });
        }
        StageQuote {
            total_fee: U128(cards.iter().map(|c| c.fee.0).sum()),
            source_share_bps: self.params.source_mint_share_bps,
            cards,
        }
    }

    /// Locks one fee, signed evidence, portraits, economics and name reservations before the resolver runs.
    #[payable]
    pub fn mint_stage_figures(
        &mut self,
        life_id: U64,
        evidence_json: String,
        signature: String,
        npc_action_id: String,
    ) -> Promise {
        gas_floor();
        require!(
            self.get_mint_pack(life_id).is_none(),
            "Choose a card from the open mint pack"
        );
        self.owned_alive_life(life_id.0);
        require!(
            read(life_id.0).is_none(),
            "This life already has a committed stage mint"
        );
        require!(
            evidence_json.len() <= 100_000,
            "Stage evidence is too large"
        );
        self.assert_signed(&evidence_json, &signature);
        let quote = self.stage_mint_quote(life_id, evidence_json.clone(), npc_action_id);
        require!(
            env::attached_deposit().as_yoctonear() == quote.total_fee.0,
            "Attach exactly the quoted stage fee; refresh the quote if supply changed"
        );
        for card in &quote.cards {
            if let Some(id) = &card.figure_id {
                self.reserve_figure(id);
            }
        }
        let seed = block_seed(life_id.0, &env::sha256_array(evidence_json.as_bytes()));
        write(
            life_id.0,
            &Album::Pending(PendingAlbum {
                evidence_json,
                seed,
                quote,
                params: self.params.clone(),
                catalog: self.catalog.clone(),
            }),
        );
        self.lives.get_mut(&life_id.0).unwrap().status = LifeStatus::Minting;
        self.lives.flush();
        schedule(life_id)
    }

    pub fn stage_mint_result(&self, life_id: U64) -> Option<StageMintResult> {
        match read(life_id.0) {
            Some(Album::Complete(result)) => Some(result),
            _ => None,
        }
    }
    pub fn stage_mint_status(&self, life_id: U64) -> Option<String> {
        read(life_id.0).map(|a| match a {
            Album::Pending(_) => "pending".into(),
            Album::Complete(_) => "complete".into(),
        })
    }
    /// Gas only: never accepts a second mint fee. The committed outcomes and name reservations cannot change.
    pub fn retry_stage_mint(&mut self, life_id: U64) -> PromiseOrValue<StageMintResult> {
        gas_floor();
        let life = self.lives.get(&life_id.0).expect("Life not found");
        require!(
            env::predecessor_account_id() == life.account_id,
            "Only the life's owner can do this"
        );
        match read(life_id.0).expect("This life has no committed stage mint") {
            Album::Complete(result) => PromiseOrValue::Value(result),
            Album::Pending(_) => {
                require!(
                    life.status == LifeStatus::Minting,
                    "This life is not awaiting its mint"
                );
                PromiseOrValue::Promise(schedule(life_id))
            }
        }
    }
    #[private]
    pub fn finalize_stage_mint(&mut self, life_id: U64) -> StageMintResult {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Only the contract can finalize a mint"
        );
        let request = match read(life_id.0).expect("This life has no committed stage mint") {
            Album::Complete(result) => return result,
            Album::Pending(p) => p,
        };
        let mut life = self.lives.get(&life_id.0).cloned().expect("Life not found");
        require!(
            life.status == LifeStatus::Minting,
            "This life is not awaiting its mint"
        );
        let evidence: Evidence = serde_json::from_str(&request.evidence_json).unwrap();
        let hash = env::sha256_array(request.evidence_json.as_bytes());
        let shares = compute_shares(
            &evidence
                .sources
                .iter()
                .map(|s| (s.token_id.clone(), s.impact))
                .collect::<Vec<_>>(),
        );
        let mut tokens = Vec::new();
        let mut paid = 0;
        for card in &request.quote.cards {
            let rarity = if card.figure_id.is_some() { 2 } else { 1 };
            let affection = (1 + roll(&request.seed, card.stage_id.as_bytes()) % 100) as u8;
            let outcome = Outcome {
                figure: card.figure_id.clone(),
                rarity,
                affection,
                card: None,
            };
            let id = self.mint_token(
                &life.account_id,
                life_id.0,
                &evidence,
                &outcome,
                &card.action_id,
                &shares,
                &hash,
                &request.params,
                &request.catalog,
            );
            let by_id = self.nft.token_metadata_by_id.as_mut().unwrap();
            let mut meta = by_id.get(&id).unwrap();
            let mut extra: serde_json::Value =
                serde_json::from_str(meta.extra.as_deref().unwrap()).unwrap();
            let record = &card.stage_record;
            for (name, value) in serde_json::json!({
                "stage_id": card.stage_id, "stage_title": card.title, "character_name": card.character_name,
                "from_age": record.from_age, "to_age": record.to_age, "district": record.district,
                "field": record.field, "tier": record.tier, "portrait_media": card.portrait_media, "stage_record": record
            }).as_object().unwrap() { extra[name] = value.clone(); }
            meta.extra = Some(extra.to_string());
            meta.title = Some(format!("{} · {}", card.character_name, card.title));
            meta.description = Some(format!(
                "{}: ages {}–{} in {}.",
                card.stage_id, record.from_age, record.to_age, record.district
            ));
            meta.media = Some(card.portrait_media.clone());
            by_id.insert(&id, &meta);
            paid += self.pay_sources(&id, card.fee.0, &shares, request.quote.source_share_bps);
            if let Some(figure) = &card.figure_id {
                self.release_figure(figure);
            }
            tokens.push(StageMintToken {
                result: MintResult {
                    token_id: id,
                    kind: if card.figure_id.is_some() {
                        TokenKind::Figure
                    } else {
                        TokenKind::Npc
                    },
                    figure_id: card.figure_id.clone(),
                    rarity,
                    affection,
                },
                stage_id: card.stage_id.clone(),
                stage_title: card.title.clone(),
                character_name: card.character_name.clone(),
                portrait_media: card.portrait_media.clone(),
            });
        }
        self.credit(&self.treasury_id.clone(), request.quote.total_fee.0 - paid);
        life.status = LifeStatus::Minted;
        self.active_life.remove(&life.account_id);
        self.lives.insert(life_id.0, life);
        let result = StageMintResult {
            life_id,
            evidence_hash: hex::encode(hash),
            total_fee: request.quote.total_fee,
            tokens,
        };
        write(life_id.0, &Album::Complete(result.clone()));
        self.flush_mint_storage();
        env::log_str(&format!(
            "EVENT_JSON:{}",
            serde_json::json!({"standard":"everfolk", "version":"1.0.0", "event":"stage_album_minted", "data":[result]})
        ));
        result
    }
}

#[cfg(test)]
#[path = "tests_stage_mint.rs"]
mod tests;
