use crate::mint::mint_records;
use crate::stage_mint::GENERIC_FEE;
use crate::test_utils::*;
use crate::types::*;
use crate::Contract;
use near_sdk::json_types::U64;
use near_sdk::serde_json::{self, json, Value};
use near_sdk::test_utils::{get_created_receipts, VMContextBuilder};
use near_sdk::{env, testing_env, Gas, NearToken, PromiseOrValue};
use std::panic::{catch_unwind, AssertUnwindSafe};

const LEGACY_WORLD: &str = "alexandria-ranked-1";
const SESSION: &str = "447286cf-8c52-4468-888c-7e3fe9377777";

fn ready() -> Contract {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c.set_world_versions(vec![LEGACY_WORLD.into(), NPC_WORLD_VERSION.into()]);
    c
}

fn start(c: &mut Contract, world: &str) -> u64 {
    as_account(ALICE);
    let id = c.start_life(world.into()).life_id.0;
    c.flush_mint_storage();
    id
}

fn evidence(c: &Contract, id: u64) -> Value {
    let life = c.get_life(U64(id)).unwrap();
    let mut e: Value = serde_json::from_str(&evidence_json(&life.seed, id, ALICE, &[], &[], "letters", 50)).unwrap();
    e["world_version"] = life.world_version.into();
    if e["world_version"] == NPC_WORLD_VERSION {
        e["npc_session"] = json!({
            "session_id": SESSION,
            "transcript_hash": e["save_hash"],
            "provider_checked_at": START_MS,
            "expires_at": START_MS + 60_000,
        });
    }
    e
}

fn infant_stages(e: &mut Value) {
    e["death_age"] = 0.into();
    e["death_year"] = (-350).into();
    let record = json!({"stageId":"infancy","title":"A child of Rhakotis","fromAge":0,"toAge":0,
        "district":"rhakotis","field":null,"tier":"learner","jobId":null,"topSkills":{},
        "nodes":[],"reputation":0,"accomplishments":[],"mentors":["Damon"]});
    e["stage_records"] = json!([record]);
    e["stage_figures"] = json!([{"stageId":"infancy","kind":"generic","figureId":null,
        "title":"A child of Rhakotis","name":"Kallias","characterName":"Kallias",
        "media":"/assets/pixel/portraits/adult-0.svg","genericMedia":"/assets/pixel/portraits/adult-0.svg",
        "stageRecord":record}]);
}

fn receipt(caller: &str, now: u64, deposit: u128) {
    let usage = env::storage_usage();
    let mut b = VMContextBuilder::new();
    b.current_account_id(account(CONTRACT))
        .predecessor_account_id(account(caller))
        .signer_account_id(account(caller))
        .block_timestamp(now * 1_000_000)
        .storage_usage(usage)
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(1_000))
        .prepaid_gas(Gas::from_tgas(300))
        .random_seed([7; 32]);
    testing_env!(b.build());
}

fn rejects(f: impl FnOnce(), expected: &str) {
    let failure = catch_unwind(AssertUnwindSafe(f)).expect_err("invalid evidence must be rejected");
    let message = failure.downcast_ref::<String>().map(String::as_str)
        .or_else(|| failure.downcast_ref::<&str>().copied()).unwrap_or("non-string panic");
    assert!(message.contains(expected), "expected {expected:?}, got {message:?}");
}

fn assert_uncommitted(c: &Contract, id: u64, token_count: u64, storage: u64) {
    assert_eq!(c.get_life(U64(id)).unwrap().status, LifeStatus::Alive);
    assert!(mint_records().get(&id).is_none());
    assert!(c.get_mint_pack(U64(id)).is_none());
    assert!(c.stage_mint_status(U64(id)).is_none());
    assert_eq!(c.next_token_id, token_count);
    assert_eq!(c.balance_of(account(CAROL)).0, 0);
    assert_eq!(c.balance_of(account(TREASURY)).0, 0);
    assert_eq!(env::storage_usage(), storage, "rejection must precede persistent writes");
    assert!(get_created_receipts().is_empty(), "rejection must not schedule a mint or transfer");
}

#[test]
fn legacy_evidence_omits_the_optional_field_and_still_mints() {
    let mut c = ready();
    let id = start(&mut c, LEGACY_WORLD);
    let original = evidence(&c, id);
    let parsed: Evidence = serde_json::from_value(original.clone()).unwrap();
    assert!(parsed.npc_session.is_none());
    let round_trip: Evidence = serde_json::from_value(serde_json::to_value(&parsed).unwrap()).unwrap();
    assert_eq!(round_trip, parsed);
    let raw = original.to_string();
    receipt(ALICE, START_MS, c.get_params().mint_fee.0);
    c.mint_life(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach();
    receipt(CONTRACT, START_MS + 500_000, 0);
    let token = c.finalize_mint(U64(id));
    assert_eq!(c.mint_result(U64(id)), Some(token));
}

#[test]
fn legacy_world_does_not_require_session_freshness() {
    let mut c = ready();
    let id = start(&mut c, LEGACY_WORLD);
    let mut e = evidence(&c, id);
    e["npc_session"] = json!({"session_id":"legacy","transcript_hash":"old","provider_checked_at":0,"expires_at":1});
    let raw = e.to_string();
    receipt(ALICE, START_MS, c.get_params().mint_fee.0);
    c.mint_life(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach();
    assert_eq!(c.get_life(U64(id)).unwrap().status, LifeStatus::Minting);
}

#[test]
fn npc_world_keeps_figure_draw_checkpoint_and_source_provenance() {
    let mut c = ready();
    let figure = seed_figure(&mut c, "euclid", 50, 2);
    let teacher = seed_npc(&mut c, "letters", "education", "letters.teach", 50, 1);
    let mut params = c.get_params();
    params.nobody_weight_bps = 0;
    c.set_params(params);
    let before_birth = c.next_token_id;
    let id = start(&mut c, NPC_WORLD_VERSION);
    let born = c.get_life(U64(id)).unwrap();
    assert_eq!(born.figure_picks[0].token_id, figure);
    assert_eq!(c.next_token_id, before_birth, "core NPC world does not create NFTs at birth");
    c.checkpoint(U64(id), 0, "b".repeat(64));
    let drawn = c.draw_npc(U64(id), 0, "education".into(), "b".repeat(64));
    assert_eq!(drawn.token_id.as_deref(), Some(teacher.as_str()));
    let mut e = evidence(&c, id);
    e["sources"] = json!([{"token_id":figure,"impact":3},{"token_id":teacher,"impact":1}]);
    let raw = e.to_string();
    receipt(ALICE, START_MS, c.get_params().mint_fee.0);
    c.mint_life(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach();
    receipt(CONTRACT, START_MS + 61_000, 0);
    let result = c.finalize_mint(U64(id));
    assert_eq!(c.sources_of(result.token_id.clone()).len(), 2);
    assert_eq!(c.children_of(figure.clone(), 0, 10), vec![result.token_id.clone()]);
    assert_eq!(c.children_of(teacher.clone(), 0, 10), vec![result.token_id]);
    let ended = c.get_life(U64(id)).unwrap();
    assert_eq!(ended.figure_picks, born.figure_picks);
    assert_eq!(ended.draws, vec![drawn]);
    assert_eq!(ended.checkpoints[0].commands_hash, "b".repeat(64));
    assert!(c.balance_of(account(CAROL)).0 > 0);
}

#[test]
fn invalid_npc_proofs_are_rejected_before_single_mint_commit() {
    let mut c = ready();
    let id = start(&mut c, NPC_WORLD_VERSION);
    let valid = evidence(&c, id);
    let cases = [
        ("npc_session", Value::Null, "requires a session attestation"),
        ("session_id", json!(""), "NPC session id"),
        ("session_id", json!(" "), "NPC session id"),
        ("session_id", json!("line\nbreak"), "NPC session id"),
        ("session_id", json!("session-λ"), "NPC session id"),
        ("session_id", json!("x".repeat(129)), "NPC session id"),
        ("transcript_hash", json!("b".repeat(64)), "NPC transcript hash"),
        ("expires_at", json!(START_MS), "has expired"),
        ("expires_at", json!(START_MS - 1), "has expired"),
        ("expires_at", json!(START_MS / 1_000 + 60), "has expired"),
        ("provider_checked_at", json!(START_MS + 5_001), "too far in the future"),
        ("expires_at", json!(START_MS + 120_001), "lifetime must"),
        ("provider_checked_at", json!(START_MS - 60_001), "lifetime must"),
        ("provider_checked_at", json!(-1), "not in the expected format"),
        ("provider_checked_at", json!(1.5), "not in the expected format"),
        ("expires_at", json!("1800000060000"), "not in the expected format"),
    ];
    for (field, value, expected) in cases {
        let mut e = valid.clone();
        if field == "npc_session" { e[field] = value; } else { e["npc_session"][field] = value; }
        let raw = e.to_string();
        receipt(ALICE, START_MS, c.get_params().mint_fee.0);
        let storage = env::storage_usage();
        let tokens = c.next_token_id;
        rejects(|| { c.mint_life(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach(); }, expected);
        assert_uncommitted(&c, id, tokens, storage);
    }
    let mut missing = valid;
    missing.as_object_mut().unwrap().remove("npc_session");
    let raw = missing.to_string();
    receipt(ALICE, START_MS, c.get_params().mint_fee.0);
    let storage = env::storage_usage();
    let tokens = c.next_token_id;
    rejects(|| { c.mint_life(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach(); }, "requires a session attestation");
    assert_uncommitted(&c, id, tokens, storage);
}

#[test]
fn npc_proof_boundaries_accept_uuid_ids_and_two_minute_lifetime() {
    let mut c = ready();
    let id = start(&mut c, NPC_WORLD_VERSION);
    let mut e = evidence(&c, id);
    e["npc_session"]["provider_checked_at"] = (START_MS + 5_000).into();
    e["npc_session"]["expires_at"] = (START_MS + 125_000).into();
    let raw = e.to_string();
    receipt(ALICE, START_MS, c.get_params().mint_fee.0);
    c.mint_life(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach();
    receipt(ALICE, START_MS + 126_000, 0);
    match c.retry_mint(U64(id)) { PromiseOrValue::Promise(p) => p.detach(), _ => panic!("pending mint") }
    receipt(CONTRACT, START_MS + 126_000, 0);
    c.finalize_mint(U64(id));
    assert_eq!(c.get_life(U64(id)).unwrap().status, LifeStatus::Minted);
}

#[test]
fn npc_proof_requires_well_formed_matching_hash_and_positive_lifetime() {
    let mut c = ready();
    let id = start(&mut c, NPC_WORLD_VERSION);
    for hash in ["bad".into(), "A".repeat(64), "g".repeat(64)] {
        let mut e = evidence(&c, id);
        e["save_hash"] = hash.clone().into();
        e["npc_session"]["transcript_hash"] = hash.into();
        let parsed: Evidence = serde_json::from_value(e).unwrap();
        let life = c.lives.get(&id).unwrap();
        rejects(|| c.assert_evidence(id, life, &parsed, "letters.teach"), "NPC transcript hash");
    }
    for expiry in [START_MS + 999, START_MS + 1_000] {
        let mut e = evidence(&c, id);
        e["npc_session"]["provider_checked_at"] = (START_MS + 1_000).into();
        e["npc_session"]["expires_at"] = expiry.into();
        let parsed: Evidence = serde_json::from_value(e).unwrap();
        let life = c.lives.get(&id).unwrap();
        rejects(|| c.assert_evidence(id, life, &parsed, "letters.teach"), "lifetime must");
    }
}

#[test]
fn fresh_npc_proof_cannot_add_a_source_without_an_onchain_influence() {
    let mut c = ready();
    let id = start(&mut c, NPC_WORLD_VERSION);
    let mut e = evidence(&c, id);
    e["sources"] = json!([{"token_id":"core-npc-damon","impact":100}]);
    let raw = e.to_string();
    receipt(ALICE, START_MS, c.get_params().mint_fee.0);
    let storage = env::storage_usage();
    let tokens = c.next_token_id;
    rejects(|| { c.mint_life(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach(); }, "A source did not influence this life on chain");
    assert_uncommitted(&c, id, tokens, storage);
}

#[test]
fn npc_session_is_covered_by_the_verifiers_signature() {
    let mut c = ready();
    let id = start(&mut c, NPC_WORLD_VERSION);
    let mut e = evidence(&c, id);
    let signature = sign(&e.to_string());
    e["npc_session"]["session_id"] = "substituted-session".into();
    receipt(ALICE, START_MS, c.get_params().mint_fee.0);
    let storage = env::storage_usage();
    let tokens = c.next_token_id;
    rejects(|| { c.mint_life(U64(id), e.to_string(), signature, "letters.teach".into()).detach(); }, "signature is not valid");
    assert_uncommitted(&c, id, tokens, storage);
}

#[test]
fn expired_npc_proof_cannot_open_a_mint_pack_or_reserve_a_figure() {
    let mut c = ready();
    let id = start(&mut c, NPC_WORLD_VERSION);
    let mut e = evidence(&c, id);
    e["matched_figures"] = json!(["euclid"]);
    let raw = e.to_string();
    receipt(ALICE, START_MS + 60_000, 0);
    let storage = env::storage_usage();
    let tokens = c.next_token_id;
    rejects(|| { c.open_mint_pack(U64(id), raw.clone(), sign(&raw), "letters.teach".into()); }, "has expired");
    assert_uncommitted(&c, id, tokens, storage);
    assert_eq!(c.pack_reserved("euclid"), 0);
}

#[test]
fn stage_mint_rechecks_proof_after_quote_before_charging_or_reserving() {
    let mut c = ready();
    let source = seed_figure(&mut c, "euclid", 50, 2);
    let id = start(&mut c, NPC_WORLD_VERSION);
    let mut e = evidence(&c, id);
    infant_stages(&mut e);
    e["sources"] = json!([{"token_id":source,"impact":10}]);
    let raw = e.to_string();
    let quote = c.stage_mint_quote(U64(id), raw.clone(), "letters.teach".into());
    assert_eq!(quote.total_fee.0, GENERIC_FEE);
    receipt(ALICE, START_MS + 60_000, quote.total_fee.0);
    let storage = env::storage_usage();
    let tokens = c.next_token_id;
    rejects(|| { c.mint_stage_figures(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach(); }, "has expired");
    assert_uncommitted(&c, id, tokens, storage);
    assert_eq!(c.pack_reserved("euclid"), 0);
    rejects(|| { c.stage_mint_quote(U64(id), raw, "letters.teach".into()); }, "has expired");
}

#[test]
fn stage_quote_and_commit_require_the_npc_proof() {
    let mut c = ready();
    let id = start(&mut c, NPC_WORLD_VERSION);
    let mut e = evidence(&c, id);
    infant_stages(&mut e);
    e.as_object_mut().unwrap().remove("npc_session");
    let raw = e.to_string();
    rejects(|| { c.stage_mint_quote(U64(id), raw.clone(), "letters.teach".into()); }, "requires a session attestation");
    receipt(ALICE, START_MS, GENERIC_FEE);
    let storage = env::storage_usage();
    let tokens = c.next_token_id;
    rejects(|| { c.mint_stage_figures(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach(); }, "requires a session attestation");
    assert_uncommitted(&c, id, tokens, storage);
}

#[test]
fn npc_stage_mint_preserves_sources_and_recovers_after_attestation_expiry() {
    let mut c = ready();
    let source = seed_figure(&mut c, "euclid", 50, 2);
    let id = start(&mut c, NPC_WORLD_VERSION);
    let mut e = evidence(&c, id);
    infant_stages(&mut e);
    e["sources"] = json!([{"token_id":source,"impact":10}]);
    let raw = e.to_string();
    receipt(ALICE, START_MS, GENERIC_FEE);
    c.mint_stage_figures(U64(id), raw.clone(), sign(&raw), "letters.teach".into()).detach();
    receipt(ALICE, START_MS + 500_000, 0);
    match c.retry_stage_mint(U64(id)) { PromiseOrValue::Promise(p) => p.detach(), _ => panic!("pending album") }
    receipt(CONTRACT, START_MS + 500_000, 0);
    let result = c.finalize_stage_mint(U64(id));
    assert_eq!(result.tokens.len(), 1);
    assert_eq!(result.tokens[0].stage_id, "infancy");
    assert_eq!(c.sources_of(result.tokens[0].result.token_id.clone()).len(), 1);
    assert_eq!(c.children_of(source, 0, 10), vec![result.tokens[0].result.token_id.clone()]);
    assert_eq!(c.balance_of(account(CAROL)).0, GENERIC_FEE / 2);
    assert_eq!(c.balance_of(account(TREASURY)).0, GENERIC_FEE / 2);
    assert_eq!(c.get_life(U64(id)).unwrap().status, LifeStatus::Minted);
}
