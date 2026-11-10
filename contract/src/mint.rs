use crate::random::{block_seed, roll, weighted_pick};
use crate::shares::compute_shares;
use crate::types::*;
use crate::{Contract, ContractExt};
use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_sdk::json_types::{Base64VecU8, U64};
use near_sdk::{env, near, require, serde_json, AccountId, Gas, NearToken, Promise};

const NPC_RARITY_WEIGHTS: [u64; 5] = [6000, 2500, 1000, 400, 100];
const FIGURE_RARITY_WEIGHTS: [u64; 5] = [0, 0, 7000, 2500, 500];
/// Gas floor above the most expensive outcome branch, so an outcome can't be retried by starving it of gas.
const MIN_MINT_GAS: Gas = Gas::from_tgas(150);

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

struct Outcome {
    figure: Option<String>,
    rarity: u8,
    affection: u8,
}

#[near]
impl Contract {
    /// Mints a verified, finished ranked life. Randomness decides whether it becomes a figure or stays an NPC.
    #[payable]
    pub fn mint_life(&mut self, life_id: U64, evidence_json: String, signature: String, npc_action_id: String) -> MintResult {
        require!(env::prepaid_gas() >= MIN_MINT_GAS, "Attach at least 150 Tgas to mint a life");
        let fee = self.params.mint_fee.0;
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= fee, "Attach at least the mint fee");
        self.assert_signed(&evidence_json, &signature);
        let evidence: Evidence =
            serde_json::from_str(&evidence_json).unwrap_or_else(|_| env::panic_str("The life evidence is not in the expected format"));
        let mut life = self.owned_alive_life(life_id.0);
        self.assert_evidence(life_id.0, &life, &evidence, &npc_action_id);

        let storage_before = env::storage_usage();
        let evidence_hash = env::sha256_array(evidence_json.as_bytes());
        let outcome = self.roll_outcome(&block_seed(life_id.0, &evidence_hash), &evidence);
        let shares = compute_shares(&evidence.sources.iter().map(|s| (s.token_id.clone(), s.impact)).collect::<Vec<_>>());
        let owner = life.account_id.clone();
        let token_id = self.mint_token(&owner, life_id.0, &evidence, &outcome, &npc_action_id, &shares, &evidence_hash);
        let paid_to_sources = self.pay_sources(&token_id, fee, &shares);

        life.status = LifeStatus::Minted;
        self.lives.insert(life_id.0, life);
        self.active_life.remove(&owner);
        self.lives.flush();
        self.active_life.flush();
        let locked = env::storage_usage().saturating_sub(storage_before) as u128 * env::storage_byte_cost().as_yoctonear();
        require!(fee >= paid_to_sources + locked, "The mint fee does not cover this token's storage");
        let treasury = self.treasury_id.clone();
        self.credit(&treasury, fee - paid_to_sources - locked);
        if deposit > fee {
            Promise::new(owner).transfer(NearToken::from_yoctonear(deposit - fee)).detach();
        }
        MintResult { token_id, kind: self.record_kind(&outcome), figure_id: outcome.figure, rarity: outcome.rarity, affection: outcome.affection }
    }
}

impl Contract {
    fn assert_signed(&self, evidence_json: &str, signature: &str) {
        let signature = parse_signature(signature);
        let valid = self.verifier_keys.iter().any(|key| env::ed25519_verify(&signature, evidence_json.as_bytes(), key));
        require!(valid, "The life evidence signature is not valid");
    }

    fn assert_evidence(&self, life_id: u64, life: &Life, evidence: &Evidence, npc_action_id: &str) {
        require!(evidence.v == 1, "Unsupported evidence version");
        require!(
            evidence.life_id == life_id.to_string() && evidence.account_id == life.account_id,
            "Evidence belongs to a different life or account"
        );
        require!(evidence.seed == hex::encode(life.seed), "Evidence was made for a different life seed");
        require!(evidence.world_version == life.world_version, "Evidence is for a different world version");
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

    fn roll_outcome(&self, seed: &[u8; 32], evidence: &Evidence) -> Outcome {
        let figure = evidence
            .matched_figures
            .iter()
            .find(|figure| {
                let (minted, cap) = self.supply(figure);
                minted < cap && roll(seed, format!("drop:{figure}").as_bytes()) % (MAX_BPS as u64) < self.params.drop_rate_bps as u64
            })
            .cloned();
        let weights = if figure.is_some() { FIGURE_RARITY_WEIGHTS } else { NPC_RARITY_WEIGHTS };
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
    fn mint_token(
        &mut self,
        owner: &AccountId,
        life_id: u64,
        evidence: &Evidence,
        outcome: &Outcome,
        npc_action_id: &str,
        shares: &[crate::shares::Share],
        evidence_hash: &[u8; 32],
    ) -> String {
        let figure = outcome.figure.as_ref().and_then(|id| self.catalog.figures.iter().find(|f| &f.figure_id == id)).cloned();
        let action_id = figure.as_ref().map(|f| f.action_ids[0].clone()).unwrap_or_else(|| npc_action_id.to_string());
        let category = self.catalog.npc_actions.iter().find(|a| a.action_id == npc_action_id).map(|a| a.category.clone());
        let kind = self.record_kind(outcome);
        let record = TokenRecord {
            kind,
            figure_id: outcome.figure.clone(),
            category: if figure.is_some() { None } else { category },
            rarity: outcome.rarity,
            affection: outcome.affection,
            action_id: action_id.clone(),
        };
        let hash_hex = hex::encode(evidence_hash);
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
        };
        let base_url = &self.params.evidence_base_url;
        let metadata = TokenMetadata {
            title: Some(figure.as_ref().map(|f| f.title.clone()).unwrap_or_else(|| format!("A life of Alexandria #{life_id}"))),
            description: Some(format!("An Everfolk life lived to age {} ({} BCE – {} BCE).", evidence.death_age, -evidence.birth_year, -evidence.death_year)),
            media: figure.as_ref().map(|f| f.media.clone()).filter(|m| !m.is_empty()),
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
