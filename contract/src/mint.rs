use crate::card_art::{card_design, card_for, edition_key, CardArt};
use crate::rarity_caps::RARITY_CAPS;
use crate::random::{block_seed, roll, weighted_pick};
use crate::shares::compute_shares;
use crate::types::*;
use crate::{Contract, ContractExt, StorageKey};
use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_sdk::json_types::{Base64VecU8, U64};
use near_sdk::store::LookupMap;
use near_sdk::{env, near, require, serde_json, AccountId, Gas, NearToken, Promise, PromiseOrValue};

const NPC_RARITY_WEIGHTS: [u64; 5] = [6000, 2500, 1000, 400, 100];
const FIGURE_RARITY_WEIGHTS: [u64; 5] = [0, 0, 7000, 2500, 500];
/// Request validation/persistence plus the separate resolver receipt's fixed budget.
const MIN_MINT_GAS: Gas = Gas::from_tgas(200);
const FINALIZE_MINT_GAS: Gas = Gas::from_tgas(150);
const MAX_NPC_SESSION_LIFETIME_MS: u64 = 120_000;
const MAX_NPC_PROVIDER_CLOCK_SKEW_MS: u64 = 5_000;
const MAX_NPC_SESSION_ID_BYTES: usize = 128;

/// Validate only when committing a fee/outcome, never during recovery of an accepted mint.
fn assert_npc_session(evidence: &Evidence) {
    if evidence.world_version != NPC_WORLD_VERSION {
        return;
    }
    let proof = evidence.npc_session.as_ref().unwrap_or_else(|| env::panic_str("NPC world evidence requires a session attestation"));
    require!(
        !proof.session_id.is_empty()
            && proof.session_id.len() <= MAX_NPC_SESSION_ID_BYTES
            && proof.session_id.bytes().all(|b| b.is_ascii_graphic()),
        "NPC session id must be 1 to 128 printable ASCII characters without spaces"
    );
    require!(
        proof.transcript_hash == evidence.save_hash
            && proof.transcript_hash.len() == 64
            && proof.transcript_hash.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "NPC transcript hash must match the save hash as 64 lowercase hex characters"
    );
    let now = env::block_timestamp_ms();
    require!(proof.expires_at > now, "NPC session attestation has expired");
    require!(
        proof.provider_checked_at <= now.saturating_add(MAX_NPC_PROVIDER_CLOCK_SKEW_MS),
        "NPC provider check is too far in the future"
    );
    require!(
        proof.expires_at.checked_sub(proof.provider_checked_at)
            .is_some_and(|lifetime| lifetime > 0 && lifetime <= MAX_NPC_SESSION_LIFETIME_MS),
        "NPC session attestation lifetime must be 1 to 120000 milliseconds"
    );
}

/// Kept in its own appended storage prefix, preserving the existing Contract layout.
#[near(serializers = [borsh])]
#[derive(Clone)]
pub(crate) struct PendingMint {
    pub(crate) evidence_json: String,
    pub(crate) npc_action_id: String,
    pub(crate) seed: [u8; 32],
    pub(crate) fee: u128,
    /// Optional recovery deposit pays storage only, never another mint fee or royalties.
    pub(crate) extra_storage_deposit: u128,
    pub(crate) storage_bytes: u64,
    pub(crate) params: Params,
    pub(crate) catalog: CatalogConfig,
}

#[near(serializers = [borsh])]
#[derive(Clone)]
pub(crate) enum MintRecord {
    Pending(PendingMint),
    Complete(MintResult),
}

pub(crate) fn mint_records() -> LookupMap<u64, MintRecord> {
    LookupMap::new(StorageKey::MintRecords)
}

fn parse_signature(signature: &str) -> [u8; 64] {
    hex::decode(signature)
        .ok()
        .and_then(|bytes| bytes.try_into().ok())
        .unwrap_or_else(|| env::panic_str("Signature must be 128 hex characters"))
}

/// Affection starts from a roll and leans with the life's bonds (−10…+10 around 50), always 1–100.
fn affection(seed: &[u8; 32], evidence: &Evidence) -> u8 {
    let bonds = evidence.stats.get("bonds").copied().unwrap_or(50.0).clamp(-1e6, 1e6) as i64;
    let base = 1 + (roll(seed, b"aff") % 100) as i64;
    (base + (bonds - 50) / 5).clamp(1, 100) as u8
}

pub(crate) struct Outcome {
    pub(crate) figure: Option<String>,
    pub(crate) rarity: u8,
    pub(crate) affection: u8,
}

#[near]
impl Contract {
    /// Commits a verified life's fee and random seed, then mints in a separate receipt.
    /// A subsequent failing action in the caller's batch cannot observe or undo the mint outcome.
    #[payable]
    pub fn mint_life(&mut self, life_id: U64, evidence_json: String, signature: String, npc_action_id: String) -> Promise {
        require!(self.get_mint_pack(life_id).is_none(), "Choose a card from the open mint pack");
        require!(env::prepaid_gas() >= MIN_MINT_GAS, "Attach at least 200 Tgas to mint a life");
        let fee = self.params.mint_fee.0;
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= fee, "Attach at least the mint fee");
        self.assert_signed(&evidence_json, &signature);
        let evidence: Evidence =
            serde_json::from_str(&evidence_json).unwrap_or_else(|_| env::panic_str("The life evidence is not in the expected format"));
        let mut life = self.owned_alive_life(life_id.0);
        self.assert_evidence(life_id.0, &life, &evidence, &npc_action_id);

        // Do not charge this request for writes left cached by earlier setup/calls in a batch.
        self.flush_mint_storage();
        let storage_before = env::storage_usage();
        let evidence_hash = env::sha256_array(evidence_json.as_bytes());
        let owner = life.account_id.clone();
        let mut request = PendingMint {
            evidence_json,
            npc_action_id,
            seed: block_seed(life_id.0, &evidence_hash),
            fee,
            extra_storage_deposit: 0,
            storage_bytes: 0,
            params: self.params.clone(),
            catalog: self.catalog.clone(),
        };
        life.status = LifeStatus::Minting;
        self.lives.insert(life_id.0, life);
        self.lives.flush();
        let mut records = mint_records();
        records.insert(life_id.0, MintRecord::Pending(request.clone()));
        records.flush();
        request.storage_bytes = env::storage_usage().saturating_sub(storage_before);
        records.insert(life_id.0, MintRecord::Pending(request));
        records.flush(); // Updating the fixed-width byte count adds no storage.
        if deposit > fee {
            Promise::new(owner).transfer(NearToken::from_yoctonear(deposit - fee)).detach();
        }
        Self::schedule_mint(life_id)
    }

    /// Retries an interrupted resolver without drawing again or charging another mint fee.
    /// An optional deposit funds extra storage only; unused recovery funds are refunded.
    #[payable]
    pub fn retry_mint(&mut self, life_id: U64) -> PromiseOrValue<MintResult> {
        require!(env::prepaid_gas() >= MIN_MINT_GAS, "Attach at least 200 Tgas to retry a mint");
        let life = self.lives.get(&life_id.0).unwrap_or_else(|| env::panic_str("Life not found"));
        require!(env::predecessor_account_id() == life.account_id, "Only the life's owner can do this");
        let mut records = mint_records();
        let record = records.get(&life_id.0).cloned().unwrap_or_else(|| env::panic_str("This life has no committed mint"));
        let deposit = env::attached_deposit().as_yoctonear();
        match record {
            MintRecord::Complete(result) => {
                if deposit > 0 {
                    Promise::new(life.account_id.clone()).transfer(NearToken::from_yoctonear(deposit)).detach();
                }
                PromiseOrValue::Value(result)
            }
            MintRecord::Pending(mut request) => {
                require!(life.status == LifeStatus::Minting, "This life is not awaiting its mint");
                request.extra_storage_deposit = request.extra_storage_deposit.checked_add(deposit).unwrap_or_else(|| env::panic_str("Storage deposit overflow"));
                records.insert(life_id.0, MintRecord::Pending(request));
                records.flush();
                PromiseOrValue::Promise(Self::schedule_mint(life_id))
            }
        }
    }

    /// Returns a landed mint directly, including when the original wallet response was lost.
    pub fn mint_result(&self, life_id: U64) -> Option<MintResult> {
        match mint_records().get(&life_id.0) {
            Some(MintRecord::Complete(result)) => Some(result.clone()),
            _ => self.stage_mint_result(life_id).and_then(|album| album.tokens.first().map(|t| t.result.clone())),
        }
    }

    #[private]
    pub fn finalize_mint(&mut self, life_id: U64) -> MintResult {
        require!(env::predecessor_account_id() == env::current_account_id(), "Only the contract can finalize a mint");
        let mut records = mint_records();
        let request = match records.get(&life_id.0).cloned().unwrap_or_else(|| env::panic_str("This life has no committed mint")) {
            MintRecord::Complete(result) => return result,
            MintRecord::Pending(request) => request,
        };
        let mut life = self.lives.get(&life_id.0).cloned().unwrap_or_else(|| env::panic_str("Life not found"));
        require!(life.status == LifeStatus::Minting, "This life is not awaiting its mint");
        let evidence: Evidence = serde_json::from_str(&request.evidence_json).expect("validated evidence");
        self.flush_mint_storage();
        let outcome = self.roll_outcome(&request.seed, &evidence, &request.params, &request.catalog, &request.npc_action_id, &self.card_art());
        let shares = compute_shares(&evidence.sources.iter().map(|s| (s.token_id.clone(), s.impact)).collect::<Vec<_>>());
        let evidence_hash = env::sha256_array(request.evidence_json.as_bytes());
        let token_id = self.mint_token(&life.account_id, life_id.0, &evidence, &outcome, &request.npc_action_id, &shares, &evidence_hash, &request.params, &request.catalog);
        let paid_to_sources = self.pay_sources(&token_id, request.fee, &shares, request.params.source_mint_share_bps);
        let result = MintResult { token_id, kind: self.record_kind(&outcome), figure_id: outcome.figure, rarity: outcome.rarity, affection: outcome.affection };
        life.status = LifeStatus::Minted;
        let owner = life.account_id.clone();
        self.lives.insert(life_id.0, life);
        self.active_life.remove(&owner);
        records.insert(life_id.0, MintRecord::Complete(result.clone()));
        let treasury = self.treasury_id.clone();
        // Reserve the new balance row before measuring; its final u128 value is fixed-width.
        if self.balances.get(&treasury).is_none() {
            self.balances.insert(treasury.clone(), 0);
        }
        self.flush_mint_storage();
        records.flush();
        let available = request.fee.checked_add(request.extra_storage_deposit).unwrap_or_else(|| env::panic_str("Storage deposit overflow"));
        require!(available >= paid_to_sources, "The mint fee does not cover its source shares");
        let ordinary_budget = request.fee - paid_to_sources;
        self.credit(&treasury, ordinary_budget);
        self.balances.flush();
        let extra_refund = request.extra_storage_deposit;
        if extra_refund > 0 {
            Promise::new(owner).transfer(NearToken::from_yoctonear(extra_refund)).detach();
        }
        result
    }
}

impl Contract {
    fn schedule_mint(life_id: U64) -> Promise {
        Self::ext(env::current_account_id()).with_static_gas(FINALIZE_MINT_GAS).with_unused_gas_weight(0).finalize_mint(life_id)
    }

    /// Every collection a mint mutates must reach storage before its reserve is measured.
    pub(crate) fn flush_mint_storage(&mut self) {
        self.lives.flush();
        self.active_life.flush();
        self.records.flush();
        self.npc_pools.flush();
        self.figure_copies.flush();
        self.balances.flush();
        self.sources.flush();
        self.children.flush();
        self.stats.flush();
    }
    pub(crate) fn assert_signed(&self, evidence_json: &str, signature: &str) {
        let signature = parse_signature(signature);
        let valid = self.verifier_keys.iter().any(|key| env::ed25519_verify(&signature, evidence_json.as_bytes(), key));
        require!(valid, "The life evidence signature is not valid");
    }

    pub(crate) fn assert_evidence(&self, life_id: u64, life: &Life, evidence: &Evidence, npc_action_id: &str) {
        require!(evidence.v == 1, "Unsupported evidence version");
        require!(
            evidence.life_id == life_id.to_string() && evidence.account_id == life.account_id,
            "Evidence belongs to a different life or account"
        );
        require!(evidence.seed == hex::encode(life.seed), "Evidence was made for a different life seed");
        require!(evidence.world_version == life.world_version, "Evidence is for a different world version");
        assert_npc_session(evidence);
        let influenced = |token: &str| {
            life.figure_picks.iter().any(|p| p.token_id == token) || life.draws.iter().any(|d| d.token_id.as_deref() == Some(token))
        };
        require!(evidence.sources.iter().all(|s| influenced(&s.token_id)), "A source did not influence this life on chain");
        for figure in &evidence.matched_figures {
            require!(self.catalog.figures.iter().any(|f| &f.figure_id == figure), "Unknown figure");
        }
        require!(
            self.catalog.npc_actions.iter().any(|a| a.action_id == npc_action_id && a.career_group == evidence.career_group),
            "This action does not belong to the life's career"
        );
    }

    /// Rolls a card. Sold-out rarities of the card design each rarity would produce (crate::card_art,
    /// crate::rarity_caps) are skipped; the others keep their relative odds.
    pub(crate) fn roll_outcome(&self, seed: &[u8; 32], evidence: &Evidence, params: &Params, catalog: &CatalogConfig, npc_action_id: &str, cards: &[CardArt]) -> Outcome {
        let career = evidence.career_group.as_str();
        let sex = evidence.sex.as_deref();
        let figure = evidence
            .matched_figures
            .iter()
            .find(|figure| {
                let minted = self.figure_copies.get(*figure).map(|copies| copies.len() as u32).unwrap_or(0);
                let cap = catalog.figures.iter().find(|item| &item.figure_id == *figure).map(|item| item.supply_cap).unwrap_or(0);
                let has_rarity = self.open_weights_for(cards, Some(figure.as_str()), career, sex, npc_action_id, FIGURE_RARITY_WEIGHTS).iter().any(|w| *w > 0);
                minted + self.pack_reserved(figure) < cap && has_rarity && roll(seed, format!("drop:{figure}").as_bytes()) % (MAX_BPS as u64) < params.drop_rate_bps as u64
            })
            .cloned();
        let base = if figure.is_some() { FIGURE_RARITY_WEIGHTS } else { NPC_RARITY_WEIGHTS };
        let weights = self.open_weights_for(cards, figure.as_deref(), career, sex, npc_action_id, base);
        let rarity = weighted_pick(&weights, roll(seed, b"rarity")).expect("rarity weights") as u8;
        Outcome { figure, rarity, affection: affection(seed, evidence) }
    }

    fn record_kind(&self, outcome: &Outcome) -> TokenKind {
        if outcome.figure.is_some() {
            TokenKind::Figure
        } else {
            TokenKind::Npc
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub(crate) fn mint_token(
        &mut self,
        owner: &AccountId,
        life_id: u64,
        evidence: &Evidence,
        outcome: &Outcome,
        npc_action_id: &str,
        shares: &[crate::shares::Share],
        evidence_hash: &[u8; 32],
        params: &Params,
        catalog: &CatalogConfig,
    ) -> String {
        let figure = outcome.figure.as_ref().and_then(|id| catalog.figures.iter().find(|f| &f.figure_id == id)).cloned();
        let action_id = figure.as_ref().map(|f| f.action_ids[0].clone()).unwrap_or_else(|| npc_action_id.to_string());
        let category = catalog.npc_actions.iter().find(|a| a.action_id == npc_action_id).map(|a| a.category.clone());
        let kind = self.record_kind(outcome);
        let cards = self.card_art();
        let card = card_for(&cards, outcome.figure.as_deref(), outcome.rarity, &evidence.career_group, evidence.sex.as_deref()).cloned();
        let design = card_design(&cards, outcome.figure.as_deref(), outcome.rarity, &evidence.career_group, evidence.sex.as_deref(), npc_action_id);
        let serial = self.count_minted_rarity(&design, outcome.rarity);
        let record = TokenRecord {
            kind,
            figure_id: outcome.figure.clone(),
            category: if figure.is_some() { None } else { category },
            rarity: outcome.rarity,
            affection: outcome.affection,
            action_id: action_id.clone(),
        };
        let hash_hex = hex::encode(evidence_hash);
        let edition = TokenEdition { edition_key: edition_key(&design, outcome.rarity), edition_number: serial, edition_limit: RARITY_CAPS[outcome.rarity as usize] };
        let lived = format!("An Everfolk life lived to age {} ({} BCE – {} BCE).", evidence.death_age, -evidence.birth_year, -evidence.death_year);
        let attributes = card.as_ref().map(|card| card_attributes(card, &edition, evidence)).unwrap_or_default();
        let extra = TokenExtra {
            kind,
            figure_id: outcome.figure.clone(),
            rarity: outcome.rarity,
            affection: outcome.affection,
            action_id,
            life_id: life_id.to_string(),
            birth_year: evidence.birth_year,
            death_year: evidence.death_year,
            career_group: evidence.career_group.clone(),
            sources: shares.to_vec(),
            evidence_hash: hash_hex.clone(),
            card_id: card.as_ref().map(|card| card.card_id.clone()),
            sex: card.as_ref().and(evidence.sex.clone()),
            attributes,
            edition: Some(edition.clone()),
        };
        let base_url = &params.evidence_base_url;
        let (title, media, description) = match &card {
            Some(card) => (
                card.title.clone(),
                Some(card.media.clone()),
                format!("{} · {} · {}. {lived}", card.title, RARITY_NAMES[outcome.rarity as usize], edition_text(&edition)),
            ),
            None => (
                figure.as_ref().map(|f| f.title.clone()).unwrap_or_else(|| format!("A life of Alexandria #{life_id}")),
                figure.as_ref().map(|f| f.media.clone()).filter(|m| !m.is_empty()),
                lived,
            ),
        };
        let metadata = TokenMetadata {
            title: Some(title),
            description: Some(description),
            media,
            issued_at: Some(env::block_timestamp_ms().to_string()),
            extra: Some(serde_json::to_string(&extra).expect("extra json")),
            reference: (!base_url.is_empty()).then(|| format!("{base_url}{hash_hex}")),
            reference_hash: (!base_url.is_empty()).then(|| Base64VecU8(evidence_hash.to_vec())),
            ..Default::default()
        };
        self.register_token(owner.clone(), record, metadata)
    }

    pub(crate) fn supply(&self, figure_id: &str) -> (u32, u32) {
        let cap = self
            .catalog
            .figures
            .iter()
            .find(|f| f.figure_id == figure_id)
            .map(|f| f.supply_cap)
            .unwrap_or_else(|| env::panic_str("Unknown figure"));
        (self.figure_copies.get(figure_id).map(|c| c.len() as u32).unwrap_or(0), cap)
    }
}

pub(crate) const RARITY_NAMES: [&str; 5] = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

/// "007/025", or "007/∞" for an unlimited rarity, as the card footer prints it.
fn edition_text(edition: &TokenEdition) -> String {
    match edition.edition_limit {
        Some(limit) => format!("{:03}/{:03}", edition.edition_number, limit),
        None => format!("{:03}/∞", edition.edition_number),
    }
}

fn year_text(year: i32) -> String {
    if year < 0 { format!("{} BCE", -year) } else { format!("{year} CE") }
}

fn title_case(word: &str) -> String {
    let mut chars = word.chars();
    chars.next().map(|first| first.to_uppercase().chain(chars).collect()).unwrap_or_default()
}

/// Marketplace traits for a card NFT.
fn card_attributes(card: &CardArt, edition: &TokenEdition, evidence: &Evidence) -> Vec<TokenAttribute> {
    let pair = |trait_type: &str, value: String| TokenAttribute { trait_type: trait_type.into(), value };
    vec![
        pair("Card", card.title.clone()),
        pair("Rarity", RARITY_NAMES[card.rarity as usize].into()),
        pair("Edition", edition_text(edition)),
        pair("Career", title_case(&evidence.career_group)),
        pair("Born", year_text(evidence.birth_year)),
        pair("Died", year_text(evidence.death_year)),
    ]
}
