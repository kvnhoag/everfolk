use crate::shares::Share;
use crate::test_utils::*;
use crate::types::TokenStats;
use crate::Contract;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_sdk::json_types::U128;
use near_sdk::NearToken;

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn market() -> Contract {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c
}

/// CAROL owns `child`; its sources are owned by BOB (7500) and ALICE (2500).
fn listed_child(c: &mut Contract, price: u128) -> (String, String, String) {
    let bob_src = seed_npc(c, "letters", "education", "letters.teach", 10, 0);
    let alice_src = seed_npc(c, "letters", "education", "letters.teach", 10, 0);
    for (token, to) in [(&bob_src, BOB), (&alice_src, ALICE)] {
        context(CAROL, START_MS, NearToken::from_yoctonear(1), [5; 32]);
        c.nft_transfer(account(to), token.clone(), None, None);
    }
    let child = seed_npc(c, "letters", "education", "letters.teach", 10, 0);
    c.sources.insert(child.clone(), vec![Share { token_id: bob_src.clone(), bps: 7500 }, Share { token_id: alice_src.clone(), bps: 2500 }]);
    context(CAROL, START_MS, NearToken::from_yoctonear(1), [5; 32]);
    c.list(child.clone(), U128(price));
    (child, bob_src, alice_src)
}

#[test]
fn buy_pays_all_sources_seller_and_treasury() {
    let mut c = market();
    let (child, bob_src, _) = listed_child(&mut c, 10 * NEAR);
    pay("dave.testnet", 10);
    let proceeds = c.buy(child.clone());
    assert_eq!(proceeds, U128(9 * NEAR));
    assert_eq!(c.balance_of(account(BOB)), U128(NEAR * 375 / 1000));
    assert_eq!(c.balance_of(account(ALICE)), U128(NEAR * 125 / 1000));
    assert_eq!(c.balance_of(account(TREASURY)), U128(NEAR / 2));
    assert_eq!(c.nft_token(child.clone()).unwrap().owner_id, account("dave.testnet"));
    assert_eq!(c.listing(child), None);
    assert_eq!(c.token_stats(bob_src), TokenStats { lives_influenced: 0, earned: U128(NEAR * 375 / 1000) });
}

#[test]
fn listing_is_visible_and_paginated() {
    let mut c = market();
    let (child, _, _) = listed_child(&mut c, 3 * NEAR);
    let listing = c.listing(child.clone()).unwrap();
    assert_eq!((listing.token_id, listing.seller_id, listing.price), (child, account(CAROL), U128(3 * NEAR)));
    assert_eq!(c.listings(0, 10).len(), 1);
    assert!(c.listings(1, 10).is_empty());
}

#[test]
#[should_panic(expected = "You already own this token")]
fn buy_own_token_rejected() {
    let mut c = market();
    let (child, _, _) = listed_child(&mut c, NEAR);
    pay(CAROL, 1);
    c.buy(child);
}

#[test]
#[should_panic(expected = "This token is not for sale")]
fn buy_unlisted_rejected() {
    let mut c = market();
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    pay(BOB, 1);
    c.buy(token);
}

#[test]
#[should_panic(expected = "Attach at least the listing price")]
fn buy_with_too_little_deposit_rejected() {
    let mut c = market();
    let (child, _, _) = listed_child(&mut c, 2 * NEAR);
    pay(BOB, 1);
    c.buy(child);
}

#[test]
fn transfer_clears_listing() {
    let mut c = market();
    let (child, _, _) = listed_child(&mut c, NEAR);
    context(CAROL, START_MS, NearToken::from_yoctonear(1), [5; 32]);
    c.nft_transfer(account(BOB), child.clone(), None, None);
    assert_eq!(c.listing(child), None);
}

#[test]
#[should_panic(expected = "Only the token's owner can do this")]
fn list_by_non_owner_rejected() {
    let mut c = market();
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    context(BOB, START_MS, NearToken::from_yoctonear(1), [5; 32]);
    c.list(token, U128(NEAR));
}

#[test]
#[should_panic(expected = "Price must be above zero")]
fn zero_price_rejected() {
    let mut c = market();
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    context(CAROL, START_MS, NearToken::from_yoctonear(1), [5; 32]);
    c.list(token, U128(0));
}

#[test]
#[should_panic(expected = "Only the token's owner can do this")]
fn unlist_only_owner() {
    let mut c = market();
    let (child, _, _) = listed_child(&mut c, NEAR);
    as_account(BOB);
    c.unlist(child);
}

#[test]
fn owner_can_unlist() {
    let mut c = market();
    let (child, _, _) = listed_child(&mut c, NEAR);
    as_account(CAROL);
    c.unlist(child.clone());
    assert_eq!(c.listing(child), None);
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn list_requires_one_yocto() {
    let mut c = market();
    let token = seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    as_account(CAROL);
    c.list(token, U128(NEAR));
}
