use crate::shares::Share;
use crate::test_utils::*;
use crate::Contract;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::NonFungibleTokenMetadataProvider;
use near_sdk::json_types::U128;
use near_sdk::{AccountId, NearToken};

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn one_yocto(caller: &str) {
    context(caller, START_MS, NearToken::from_yoctonear(1), [5; 32]);
}

fn give(c: &mut Contract, token: &str, to: &str) {
    one_yocto(CAROL);
    c.nft_transfer(account(to), token.to_string(), None, None);
}

/// A child token owned by CAROL whose sources are owned by the given accounts, with the given bps.
fn child_with_sources(c: &mut Contract, owners_and_bps: &[(&str, u16)]) -> String {
    let mut shares = Vec::new();
    for (owner, bps) in owners_and_bps {
        let source = seed_npc(c, "letters", "education", "letters.teach", 10, 0);
        if *owner != CAROL {
            give(c, &source, owner);
        }
        shares.push(Share { token_id: source, bps: *bps });
    }
    let child = seed_npc(c, "letters", "education", "letters.teach", 10, 0);
    c.sources.insert(child.clone(), shares);
    child
}

fn amount(payout: &std::collections::HashMap<AccountId, U128>, who: &str) -> u128 {
    payout.get(&account(who)).map(|v| v.0).unwrap_or(0)
}

#[test]
fn payout_sums_to_balance() {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    let child = child_with_sources(&mut c, &[(BOB, 7500), (ALICE, 2500)]);
    let payout = c.nft_payout(child, U128(100 * NEAR), Some(10)).payout;
    assert_eq!(amount(&payout, BOB), NEAR * 375 / 100);
    assert_eq!(amount(&payout, ALICE), NEAR * 125 / 100);
    assert_eq!(amount(&payout, TREASURY), 5 * NEAR);
    assert_eq!(amount(&payout, CAROL), 90 * NEAR);
    assert_eq!(payout.values().map(|v| v.0).sum::<u128>(), 100 * NEAR);
}

#[test]
fn payout_without_sources_sends_source_part_to_treasury() {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    let child = child_with_sources(&mut c, &[]);
    let payout = c.nft_payout(child, U128(100 * NEAR), None).payout;
    assert_eq!(amount(&payout, TREASURY), 10 * NEAR);
    assert_eq!(amount(&payout, CAROL), 90 * NEAR);
}

#[test]
fn payout_respects_max_len() {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    let owners = ["s1.testnet", "s2.testnet", "s3.testnet", "s4.testnet", "s5.testnet"];
    let child = child_with_sources(&mut c, &owners.iter().map(|o| (*o, 2000u16)).collect::<Vec<_>>());
    let payout = c.nft_payout(child, U128(100 * NEAR), Some(4)).payout;
    assert_eq!(payout.len(), 4);
    assert_eq!(amount(&payout, "s1.testnet"), NEAR);
    assert_eq!(amount(&payout, "s3.testnet"), 0);
    assert_eq!(amount(&payout, TREASURY), 8 * NEAR, "the untaken source share joins treasury");
    assert_eq!(payout.values().map(|v| v.0).sum::<u128>(), 100 * NEAR);
}

#[test]
fn payout_merges_same_owner() {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    let child = child_with_sources(&mut c, &[(BOB, 5000), (BOB, 5000)]);
    let payout = c.nft_payout(child, U128(100 * NEAR), Some(3)).payout;
    assert_eq!(amount(&payout, BOB), 5 * NEAR);
    assert_eq!(payout.len(), 3);
}

#[test]
#[should_panic(expected = "max_len_payout must allow at least the seller and treasury")]
fn payout_with_too_small_max_len_rejected() {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    let child = child_with_sources(&mut c, &[]);
    c.nft_payout(child, U128(NEAR), Some(1));
}

#[test]
fn transfer_payout_moves_token_and_reports_seller() {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    let child = child_with_sources(&mut c, &[(BOB, 10_000)]);
    one_yocto(CAROL);
    let payout = c.nft_transfer_payout(account("dave.testnet"), child.clone(), None, None, U128(10 * NEAR), Some(10)).payout;
    assert_eq!(c.nft_token(child).unwrap().owner_id, account("dave.testnet"));
    assert_eq!(amount(&payout, CAROL), 9 * NEAR);
    assert_eq!(amount(&payout, BOB), NEAR / 2);
}

#[test]
fn standard_transfer_and_enumeration_work() {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    give(&mut c, &token, ALICE);
    assert_eq!(c.nft_token(token.clone()).unwrap().owner_id, account(ALICE));
    assert_eq!(c.nft_supply_for_owner(account(ALICE)), U128(1));
    assert_eq!(c.nft_tokens_for_owner(account(ALICE), None, None)[0].token_id, token);
    assert_eq!(c.nft_total_supply(), U128(1));
}

#[test]
fn contract_metadata_follows_nep_177() {
    let c = fresh();
    let meta = c.nft_metadata();
    assert_eq!(meta.spec, near_contract_standards::non_fungible_token::metadata::NFT_METADATA_SPEC);
    assert_eq!(meta.name, "Everfolk Lives");
    assert_eq!(meta.symbol, "EVERFOLK");
}
