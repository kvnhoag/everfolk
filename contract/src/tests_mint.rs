use crate::test_utils::*;
use crate::types::*;
use crate::Contract;
use ed25519_dalek::{Signer, SigningKey};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde_json;
use near_sdk::NearToken;

const WORLD: &str = "alexandria-ranked-1";
const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn ready() -> Contract {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c.set_world_versions(vec![WORLD.into()]);
    c
}

fn set_drop(c: &mut Contract, bps: u16) {
    as_account(OWNER);
    let mut p = c.get_params();
    p.drop_rate_bps = bps;
    c.set_params(p);
}

fn start(c: &mut Contract, who: &str) -> u64 {
    as_account(who);
    c.start_life(WORLD.into()).life_id.0
}

fn mint(c: &mut Contract, who: &str, life: u64, evidence: &str, action: &str) -> MintResult {
    pay(who, 1);
    c.mint_life(U64(life), evidence.into(), sign(evidence), action.into())
}

fn src(list: &[(&str, u64)]) -> Vec<(String, u64)> {
    list.iter().map(|(t, i)| (t.to_string(), *i)).collect()
}

/// Two figure copies (euclid owned by CAROL, alexander transferred to BOB) picked into ALICE's life.
fn two_figure_sources(c: &mut Contract) -> (u64, String, String) {
    let euclid = seed_figure(c, "euclid", 50, 2);
    let alexander = seed_figure(c, "alexander", 50, 2);
    as_account(CAROL);
    c.nft.internal_transfer(&account(CAROL), &account(BOB), &alexander, None, None);
    (start(c, ALICE), euclid, alexander)
}

#[test]
fn mint_npc_happy_path() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    let before = near_sdk::env::storage_usage();
    let result = mint(&mut c, ALICE, life, &evidence, "letters.teach");
    let locked = (near_sdk::env::storage_usage() - before) as u128 * near_sdk::env::storage_byte_cost().as_yoctonear();
    assert_eq!(result.kind, TokenKind::Npc);
    assert_eq!(result.figure_id, None);
    assert!(result.rarity <= 4);
    assert!((1..=100).contains(&result.affection));
    assert_eq!(c.nft.owner_by_id.get(&result.token_id), Some(account(ALICE)));
    assert_eq!(c.get_life(U64(life)).unwrap().status, LifeStatus::Minted);
    assert_eq!(c.active_life_of(account(ALICE)), None);
    assert!(locked > 0);
    assert_eq!(c.balance_of(account(TREASURY)), U128(NEAR - locked), "with no sources the fee minus locked storage goes to treasury");
}

#[test]
fn minted_token_carries_extra_and_reference() {
    let mut c = ready();
    as_account(OWNER);
    let mut p = c.get_params();
    p.evidence_base_url = "https://everfolk.test/api/ranked/evidence/".into();
    c.set_params(p);
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    let result = mint(&mut c, ALICE, life, &evidence, "letters.lend-books");
    let meta = c.nft.token_metadata_by_id.as_ref().unwrap().get(&result.token_id).unwrap();
    let extra: TokenExtra = serde_json::from_str(meta.extra.as_deref().unwrap()).unwrap();
    let hash = hex::encode(near_sdk::env::sha256(evidence.as_bytes()));
    assert_eq!(extra.action_id, "letters.lend-books");
    assert_eq!(extra.life_id, life.to_string());
    assert_eq!(extra.career_group, "letters");
    assert_eq!((extra.birth_year, extra.death_year), (-350, -289));
    assert_eq!(extra.evidence_hash, hash);
    assert_eq!(meta.reference, Some(format!("https://everfolk.test/api/ranked/evidence/{hash}")));
}

#[test]
fn figure_drop_when_rate_10000() {
    let mut c = ready();
    set_drop(&mut c, 10_000);
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &["euclid"], "letters", 50);
    let result = mint(&mut c, ALICE, life, &evidence, "letters.teach");
    assert_eq!(result.kind, TokenKind::Figure);
    assert_eq!(result.figure_id.as_deref(), Some("euclid"));
    assert!(result.rarity >= 2, "figures are at least Rare");
    assert_eq!(c.record(&result.token_id).action_id, "euclid.school");
    assert_eq!(c.figure_supply("euclid".into()), (1, 5));
}

#[test]
fn no_figure_at_zero_drop_rate() {
    let mut c = ready();
    set_drop(&mut c, 0);
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &["euclid"], "letters", 50);
    assert_eq!(mint(&mut c, ALICE, life, &evidence, "letters.teach").kind, TokenKind::Npc);
}

#[test]
fn no_figure_when_supply_exhausted() {
    let mut c = ready();
    let mut catalog = sample_catalog();
    catalog.figures[0].supply_cap = 1;
    c.set_catalog(catalog);
    set_drop(&mut c, 10_000);
    seed_figure(&mut c, "euclid", 10, 2);
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &["euclid"], "letters", 50);
    assert_eq!(mint(&mut c, ALICE, life, &evidence, "letters.teach").kind, TokenKind::Npc);
}

fn affection_with_bonds(bonds: i64) -> u8 {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", bonds);
    mint(&mut c, ALICE, life, &evidence, "letters.teach").affection
}

#[test]
fn affection_is_capped_at_100_for_very_strong_bonds() {
    assert_eq!(affection_with_bonds(10_000), 100);
}

#[test]
fn affection_is_at_least_1_for_very_weak_bonds() {
    assert_eq!(affection_with_bonds(-10_000), 1);
}

#[test]
#[should_panic(expected = "This life is no longer in progress")]
fn double_mint_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
}

#[test]
#[should_panic(expected = "Only the life's owner can do this")]
fn mint_by_non_owner_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    mint(&mut c, BOB, life, &evidence, "letters.teach");
}

#[test]
#[should_panic(expected = "Evidence belongs to a different life or account")]
fn evidence_for_another_account_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, BOB, &[], &[], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
}

#[test]
#[should_panic(expected = "Evidence belongs to a different life or account")]
fn evidence_for_another_life_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life + 1, ALICE, &[], &[], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
}

#[test]
#[should_panic(expected = "The life evidence signature is not valid")]
fn bad_signature_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    let forged = hex::encode(SigningKey::from_bytes(&[99; 32]).sign(evidence.as_bytes()).to_bytes());
    pay(ALICE, 1);
    c.mint_life(U64(life), evidence, forged, "letters.teach".into());
}

#[test]
#[should_panic(expected = "The life evidence signature is not valid")]
fn tampered_evidence_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    let signature = sign(&evidence);
    pay(ALICE, 1);
    c.mint_life(U64(life), evidence.replace("\"bonds\":50", "\"bonds\":99"), signature, "letters.teach".into());
}

#[test]
#[should_panic(expected = "A source did not influence this life on chain")]
fn unknown_source_rejected() {
    let mut c = ready();
    let stranger = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &src(&[(&stranger, 3)]), &[], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
}

#[test]
#[should_panic(expected = "Attach at least the mint fee")]
fn insufficient_deposit_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    context(ALICE, START_MS, NearToken::from_millinear(999), [5; 32]);
    c.mint_life(U64(life), evidence.clone(), sign(&evidence), "letters.teach".into());
}

#[test]
#[should_panic(expected = "This action does not belong to the life's career")]
fn npc_action_from_another_career_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "military.mentor");
}

#[test]
#[should_panic(expected = "Unknown figure")]
fn unknown_matched_figure_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &["zeus"], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
}

#[test]
fn fee_split_credits_sources_by_impact() {
    let mut c = ready();
    let (life, euclid, alexander) = two_figure_sources(&mut c);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &src(&[(&euclid, 45_000), (&alexander, 15_000)]), &[], "letters", 50);
    let before = near_sdk::env::storage_usage();
    let minted = mint(&mut c, ALICE, life, &evidence, "letters.teach");
    let locked = (near_sdk::env::storage_usage() - before) as u128 * near_sdk::env::storage_byte_cost().as_yoctonear();
    assert_eq!(c.balance_of(account(CAROL)), U128(NEAR * 375 / 1000));
    assert_eq!(c.balance_of(account(BOB)), U128(NEAR * 125 / 1000));
    assert_eq!(c.balance_of(account(TREASURY)), U128(NEAR / 2 - locked), "storage is paid from the treasury's half");
    let shares = c.sources_of(minted.token_id.clone());
    assert_eq!(shares.iter().map(|s| (s.token_id.clone(), s.bps)).collect::<Vec<_>>(), vec![(euclid.clone(), 7500), (alexander, 2500)]);
    assert_eq!(c.children_of(euclid.clone(), 0, 10), vec![minted.token_id]);
    assert_eq!(c.token_stats(euclid), TokenStats { lives_influenced: 1, earned: U128(NEAR * 375 / 1000) });
}

#[test]
fn credits_current_owner_after_transfer() {
    let mut c = ready();
    let (life, euclid, _) = two_figure_sources(&mut c);
    as_account(CAROL);
    c.nft.internal_transfer(&account(CAROL), &account(BOB), &euclid, None, None);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &src(&[(&euclid, 1)]), &[], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
    assert_eq!(c.balance_of(account(BOB)), U128(NEAR / 2));
    assert_eq!(c.balance_of(account(CAROL)), U128(0));
}

#[test]
fn withdraw_zeroes_balance() {
    let mut c = ready();
    let (life, euclid, _) = two_figure_sources(&mut c);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &src(&[(&euclid, 1)]), &[], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
    as_account(CAROL);
    c.withdraw().detach();
    assert_eq!(c.balance_of(account(CAROL)), U128(0));
}

#[test]
#[should_panic(expected = "Nothing to withdraw")]
fn withdraw_with_empty_balance_rejected() {
    let mut c = ready();
    as_account(ALICE);
    c.withdraw().detach();
}

#[test]
fn set_action_updates_record_and_metadata() {
    let mut c = ready();
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    as_account(CAROL);
    c.set_action(token.clone(), "letters.lend-books".into());
    assert_eq!(c.record(&token).action_id, "letters.lend-books");
}

#[test]
fn set_action_on_figure_uses_the_figure_menu() {
    let mut c = ready();
    let token = seed_figure(&mut c, "euclid", 10, 2);
    as_account(CAROL);
    c.set_action(token.clone(), "euclid.museum".into());
    assert_eq!(c.record(&token).action_id, "euclid.museum");
}

#[test]
#[should_panic(expected = "Only the token's owner can do this")]
fn set_action_by_non_owner_rejected() {
    let mut c = ready();
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    as_account(BOB);
    c.set_action(token, "letters.lend-books".into());
}

#[test]
#[should_panic(expected = "This action is not on this token's menu")]
fn set_action_outside_menu_rejected() {
    let mut c = ready();
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    as_account(CAROL);
    c.set_action(token, "military.mentor".into());
}

#[test]
fn set_action_moves_npc_between_pools() {
    let mut c = ready();
    let mut catalog = sample_catalog();
    catalog.npc_actions.push(NpcActionConfig { action_id: "letters.horoscope".into(), career_group: "letters".into(), category: "fate".into() });
    c.set_catalog(catalog);
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    as_account(CAROL);
    c.set_action(token.clone(), "letters.horoscope".into());
    assert!(!c.npc_pools.get("education").cloned().unwrap_or_default().contains(&token));
    assert!(c.npc_pools.get("fate").cloned().unwrap_or_default().contains(&token));
}

#[test]
#[should_panic(expected = "Evidence was made for a different life seed")]
fn evidence_with_another_seed_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&"0".repeat(64), life, ALICE, &[], &[], "letters", 50);
    mint(&mut c, ALICE, life, &evidence, "letters.teach");
}

#[test]
#[should_panic(expected = "Attach at least 150 Tgas")]
fn mint_with_too_little_gas_rejected() {
    let mut c = ready();
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    with_gas(ALICE, NearToken::from_near(1), 149);
    c.mint_life(U64(life), evidence.clone(), sign(&evidence), "letters.teach".into());
}

#[test]
#[should_panic(expected = "The mint fee does not cover this token's storage")]
fn fee_too_small_for_storage_rejected() {
    let mut c = ready();
    as_account(OWNER);
    let mut p = c.get_params();
    p.mint_fee = U128(1_000);
    c.set_params(p);
    let life = start(&mut c, ALICE);
    let evidence = evidence_json(&seed_of(&c, life), life, ALICE, &[], &[], "letters", 50);
    pay(ALICE, 1);
    c.mint_life(U64(life), evidence.clone(), sign(&evidence), "letters.teach".into());
}

#[test]
fn npc_pool_is_capped() {
    let mut c = ready();
    for i in 0..crate::lives::MAX_POOL {
        if i % 50 == 0 {
            as_account(OWNER); // fresh mocked receipt: the mock caps logs (mint events) at 100 per call
        }
        seed_npc(&mut c, "letters", "education", "letters.teach", 1, 0);
    }
    let overflow = seed_npc(&mut c, "letters", "education", "letters.teach", 1, 0);
    let pool = c.npc_pools.get("education").cloned().unwrap();
    assert_eq!(pool.len(), crate::lives::MAX_POOL);
    assert!(!pool.contains(&overflow), "tokens past the cap are minted but not drawable");
}
