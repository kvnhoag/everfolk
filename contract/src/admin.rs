use crate::types::{CatalogConfig, Params, MAX_BPS};
use crate::{Contract, ContractExt};
use near_sdk::{env, near, require};
use std::collections::HashSet;

const KEY_PREFIX: &str = "ed25519:";

pub(crate) fn parse_verifier_keys(keys: &[String]) -> Vec<[u8; 32]> {
    require!(!keys.is_empty(), "At least one verifier key is required");
    keys.iter().map(|key| parse_key(key)).collect()
}

fn parse_key(key: &str) -> [u8; 32] {
    key.strip_prefix(KEY_PREFIX)
        .and_then(|body| bs58::decode(body).into_vec().ok())
        .and_then(|bytes| bytes.try_into().ok())
        .unwrap_or_else(|| env::panic_str("Verifier keys must look like ed25519:<base58>"))
}

fn validate_params(p: &Params) {
    for bps in [p.drop_rate_bps, p.source_mint_share_bps, p.royalty_sources_bps, p.royalty_treasury_bps, p.nobody_weight_bps] {
        require!(bps <= MAX_BPS, "Basis points must not exceed 10000");
    }
    require!(p.nobody_weight_bps < MAX_BPS, "The nobody weight must be below 10000");
    require!(
        p.royalty_sources_bps as u32 + p.royalty_treasury_bps as u32 <= MAX_BPS as u32,
        "Royalties must not exceed 10000 basis points"
    );
}

fn validate_catalog(catalog: &CatalogConfig) {
    let mut figures = HashSet::new();
    let mut actions = HashSet::new();
    for figure in &catalog.figures {
        require!(!figure.figure_id.is_empty() && figures.insert(&figure.figure_id), "Duplicate figure id");
        require!(figure.supply_cap > 0, "A figure needs a supply cap above zero");
        require!(!figure.action_ids.is_empty(), "A figure needs at least one action");
        for action in &figure.action_ids {
            require!(!action.is_empty() && actions.insert(action), "Duplicate action id");
        }
    }
    for npc in &catalog.npc_actions {
        require!(!npc.action_id.is_empty() && actions.insert(&npc.action_id), "Duplicate action id");
        require!(!npc.career_group.is_empty() && !npc.category.is_empty(), "NPC actions need a career group and category");
    }
}

#[near]
impl Contract {
    pub fn set_verifier_keys(&mut self, keys: Vec<String>) {
        self.assert_owner();
        self.verifier_keys = parse_verifier_keys(&keys);
    }

    pub fn set_catalog(&mut self, catalog: CatalogConfig) {
        self.assert_owner();
        validate_catalog(&catalog);
        self.catalog = catalog;
    }

    pub fn set_params(&mut self, params: Params) {
        self.assert_owner();
        validate_params(&params);
        self.params = params;
    }

    pub fn set_world_versions(&mut self, versions: Vec<String>) {
        self.assert_owner();
        self.world_versions = versions;
    }

    pub fn get_params(&self) -> Params {
        self.params.clone()
    }

    pub fn get_catalog(&self) -> CatalogConfig {
        self.catalog.clone()
    }

    pub fn get_world_versions(&self) -> Vec<String> {
        self.world_versions.clone()
    }

    pub fn get_verifier_keys(&self) -> Vec<String> {
        self.verifier_keys.iter().map(|key| format!("{KEY_PREFIX}{}", bs58::encode(key).into_string())).collect()
    }
}

impl Contract {
    pub(crate) fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner_id, "Only the owner can do this");
    }
}
