use crate::test_utils::*;
use near_sdk::json_types::U128;
use near_sdk::NearToken;

#[test]
fn new_sets_defaults() {
    let c = fresh();
    let p = c.get_params();
    assert_eq!(p.mint_fee, U128(NearToken::from_near(1).as_yoctonear()));
    assert_eq!(p.drop_rate_bps, 500);
    assert_eq!(p.source_mint_share_bps, 5000);
    assert_eq!((p.royalty_sources_bps, p.royalty_treasury_bps), (500, 500));
    assert_eq!(p.nobody_weight_bps, 5000);
    assert_eq!(p.abandon_cooldown_ms, 600_000);
    assert_eq!(p.evidence_base_url, "");
    assert_eq!(c.get_verifier_keys(), vec![verifier_key_string()]);
    assert!(c.get_catalog().figures.is_empty());
    assert!(c.get_world_versions().is_empty());
}

#[test]
fn owner_can_configure_catalog_params_and_versions() {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c.set_world_versions(vec!["alexandria-ranked-1".into()]);
    let mut p = c.get_params();
    p.drop_rate_bps = 10_000;
    c.set_params(p);
    assert_eq!(c.get_catalog().figures.len(), 2);
    assert_eq!(c.get_world_versions(), vec!["alexandria-ranked-1".to_string()]);
    assert_eq!(c.get_params().drop_rate_bps, 10_000);
}

#[test]
#[should_panic(expected = "Only the owner")]
fn set_catalog_rejects_non_owner() {
    let mut c = fresh();
    as_account(ALICE);
    c.set_catalog(sample_catalog());
}

#[test]
#[should_panic(expected = "Only the owner")]
fn set_params_rejects_non_owner() {
    let mut c = fresh();
    let p = c.get_params();
    as_account(ALICE);
    c.set_params(p);
}

#[test]
#[should_panic(expected = "Only the owner")]
fn set_verifier_keys_rejects_non_owner() {
    let mut c = fresh();
    as_account(ALICE);
    c.set_verifier_keys(vec![verifier_key_string()]);
}

#[test]
#[should_panic(expected = "Only the owner")]
fn set_world_versions_rejects_non_owner() {
    let mut c = fresh();
    as_account(ALICE);
    c.set_world_versions(vec!["x".into()]);
}

#[test]
#[should_panic(expected = "Verifier keys must look like ed25519:<base58>")]
fn malformed_verifier_key_rejected() {
    let mut c = fresh();
    c.set_verifier_keys(vec!["ed25519:not-base58!".into()]);
}

#[test]
#[should_panic(expected = "Basis points must not exceed 10000")]
fn params_out_of_range_rejected() {
    let mut c = fresh();
    let mut p = c.get_params();
    p.drop_rate_bps = 10_001;
    c.set_params(p);
}

#[test]
#[should_panic(expected = "The nobody weight must be below 10000")]
fn nobody_weight_must_leave_room_for_tokens() {
    let mut c = fresh();
    let mut p = c.get_params();
    p.nobody_weight_bps = 10_000;
    c.set_params(p);
}

#[test]
#[should_panic(expected = "Duplicate action id")]
fn catalog_with_duplicate_action_rejected() {
    let mut c = fresh();
    let mut catalog = sample_catalog();
    catalog.npc_actions[1].action_id = catalog.npc_actions[0].action_id.clone();
    c.set_catalog(catalog);
}
