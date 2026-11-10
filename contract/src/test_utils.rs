//! Test-only fixtures shared by every module's unit tests.
use crate::types::*;
use crate::Contract;
use ed25519_dalek::SigningKey;
use near_sdk::test_utils::VMContextBuilder;
use ed25519_dalek::Signer;
use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_sdk::serde_json::json;
use near_sdk::{testing_env, AccountId, NearToken};

pub const OWNER: &str = "owner.testnet";
pub const TREASURY: &str = "treasury.testnet";
pub const ALICE: &str = "alice.testnet";
pub const BOB: &str = "bob.testnet";
pub const CAROL: &str = "carol.testnet";
pub const CONTRACT: &str = "lives.owner.testnet";
pub const START_MS: u64 = 1_800_000_000_000;

pub fn verifier() -> SigningKey {
    SigningKey::from_bytes(&[7; 32])
}

pub fn verifier_key_string() -> String {
    format!("ed25519:{}", bs58::encode(verifier().verifying_key().to_bytes()).into_string())
}

pub fn account(name: &str) -> AccountId {
    name.parse().unwrap()
}

/// Sets the caller, time, deposit and block randomness for the next contract call.
pub fn context(caller: &str, ms: u64, deposit: NearToken, seed: [u8; 32]) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(account(CONTRACT))
        .predecessor_account_id(account(caller))
        .signer_account_id(account(caller))
        .block_timestamp(ms * 1_000_000)
        .attached_deposit(deposit)
        .account_balance(NearToken::from_near(1_000))
        .random_seed(seed);
    testing_env!(b.build());
}

/// Like `context`, with an explicit prepaid gas budget in Tgas.
pub fn with_gas(caller: &str, deposit: NearToken, tgas: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(account(CONTRACT))
        .predecessor_account_id(account(caller))
        .signer_account_id(account(caller))
        .block_timestamp(START_MS * 1_000_000)
        .attached_deposit(deposit)
        .account_balance(NearToken::from_near(1_000))
        .prepaid_gas(near_sdk::Gas::from_tgas(tgas))
        .random_seed([5; 32]);
    testing_env!(b.build());
}

pub fn seed_of(c: &Contract, life_id: u64) -> String {
    c.get_life(near_sdk::json_types::U64(life_id)).expect("life").seed
}

pub fn as_account(caller: &str) {
    context(caller, START_MS, NearToken::from_yoctonear(0), [5; 32]);
}

pub fn fresh() -> Contract {
    as_account(OWNER);
    Contract::new(account(OWNER), account(TREASURY), vec![verifier_key_string()])
}

pub fn sample_catalog() -> CatalogConfig {
    CatalogConfig {
        figures: vec![
            FigureConfig {
                figure_id: "euclid".into(),
                title: "Euclid".into(),
                media: "https://example.test/euclid.png".into(),
                supply_cap: 5,
                action_ids: vec!["euclid.school".into(), "euclid.museum".into()],
            },
            FigureConfig {
                figure_id: "alexander".into(),
                title: "Alexander".into(),
                media: "https://example.test/alexander.png".into(),
                supply_cap: 5,
                action_ids: vec!["alexander.levy".into(), "alexander.found".into()],
            },
        ],
        npc_actions: vec![
            npc("letters.teach", "letters", "education"),
            npc("letters.lend-books", "letters", "education"),
            npc("military.mentor", "military", "war"),
            npc("military.warn-levy", "military", "war"),
        ],
    }
}

/// Registers an already-minted figure copy owned by CAROL and returns its token id.
pub fn seed_figure(c: &mut Contract, figure: &str, affection: u8, rarity: u8) -> String {
    let action = c.get_catalog().figures.iter().find(|f| f.figure_id == figure).unwrap().action_ids[0].clone();
    c.register_token(
        account(CAROL),
        TokenRecord { kind: TokenKind::Figure, figure_id: Some(figure.into()), category: None, rarity, affection, action_id: action },
        test_metadata(),
    )
}

/// Registers an already-minted NPC owned by CAROL and returns its token id.
pub fn seed_npc(c: &mut Contract, _group: &str, category: &str, action: &str, affection: u8, rarity: u8) -> String {
    c.register_token(
        account(CAROL),
        TokenRecord { kind: TokenKind::Npc, figure_id: None, category: Some(category.into()), rarity, affection, action_id: action.into() },
        test_metadata(),
    )
}

fn npc(action: &str, group: &str, category: &str) -> NpcActionConfig {
    NpcActionConfig { action_id: action.into(), career_group: group.into(), category: category.into() }
}

pub fn test_metadata() -> TokenMetadata {
    TokenMetadata { title: Some("Seeded".into()), ..Default::default() }
}

/// Evidence JSON as the verifier would produce it for `life_id`.
pub fn evidence_json(seed: &str, life_id: u64, account_id: &str, sources: &[(String, u64)], matched: &[&str], group: &str, bonds: i64) -> String {
    json!({
        "v": 1, "seed": seed, "life_id": life_id.to_string(), "account_id": account_id, "world_version": "alexandria-ranked-1",
        "world_fingerprint": "f".repeat(64), "save_hash": "a".repeat(64),
        "stats": { "health": 40, "knowledge": 70, "wealth": 20, "bonds": bonds },
        "skills": { "literacy": 80 }, "origin_id": "clerk-household", "peak_job_id": "copyist",
        "accomplishments": [{ "id": "first-copy", "age": 19 }], "death_age": 61, "birth_year": -350, "death_year": -289,
        "career_group": group, "matched_figures": matched,
        "sources": sources.iter().map(|(t, i)| json!({ "token_id": t, "impact": i })).collect::<Vec<_>>(),
    })
    .to_string()
}

pub fn sign(evidence: &str) -> String {
    hex::encode(verifier().sign(evidence.as_bytes()).to_bytes())
}

pub fn pay(caller: &str, near: u128) {
    context(caller, START_MS, NearToken::from_near(near), [5; 32]);
}
