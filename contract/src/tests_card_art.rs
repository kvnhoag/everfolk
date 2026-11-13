//! Only the cards a life earned (signed in its evidence) can be opened and minted; each shows its v14 card.
use crate::card_art::{card_by_id, CardArt};
use crate::rarity_caps::RARITY_CAPS;
use crate::test_utils::*;
use crate::types::*;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_sdk::json_types::U64;
use near_sdk::{serde_json, NearToken};

fn card(card_id: &str, title: &str, rarity: u8) -> CardArt {
    CardArt {
        card_id: card_id.into(),
        title: title.into(),
        media: format!("https://everfolk.life/assets/cards/collection-v14/{card_id}-footerless.webp"),
        rarity,
        edition_limit: RARITY_CAPS[rarity as usize],
    }
}

/// A slice of the table scripts/ranked/card-art-table.ts builds from the v14 manifest.
fn table() -> Vec<CardArt> {
    vec![
        card("euclid-parent", "Euclid", 4),
        card("euclid-epic-female", "Geometer of the Circle", 3),
        card("euclid-rare-female", "Proof Checker", 2),
        card("lysippos-parent", "Lysippos", 4),
        card("lysippos-rare-male", "Portrait Modeller", 2),
        card("cleomenes-common-male", "Granary Porter", 0),
    ]
}

fn earned(cards: &[(&str, &str, &str, u8)]) -> serde_json::Value {
    serde_json::Value::Array(cards.iter().map(|(id, figure, kind, rarity)| serde_json::json!({
        "card_id": id, "figure_id": figure, "kind": kind, "rarity": rarity
    })).collect())
}

fn ready(cards: serde_json::Value) -> (crate::Contract, u64, String) {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c.set_world_versions(vec!["alexandria-ranked-1".into()]);
    c.set_card_art(table());
    as_account(ALICE);
    let id = c.start_life("alexandria-ranked-1".into()).life_id.0;
    let mut evidence: serde_json::Value = serde_json::from_str(&evidence_json(&seed_of(&c, id), id, ALICE, &[], &[], "letters", 75)).unwrap();
    evidence["sex"] = "female".into();
    evidence["earned_cards"] = cards;
    (c, id, evidence.to_string())
}

fn open(c: &mut crate::Contract, id: u64, evidence: &str) -> crate::mint_pack::MintPack {
    context(ALICE, START_MS, NearToken::from_yoctonear(0), [8; 32]);
    c.open_mint_pack(U64(id), evidence.into(), sign(evidence), "letters.teach".into())
}

fn mint(c: &mut crate::Contract, id: u64, pack: &crate::mint_pack::MintPack, slot: usize) -> (MintResult, near_contract_standards::non_fungible_token::Token) {
    context(ALICE, START_MS, NearToken::from_yoctonear(pack.total_fee.0), [10; 32]);
    let result = c.choose_mint_slot(U64(id), slot as u8);
    let token = c.nft_token(result.token_id.clone()).unwrap();
    (result, token)
}

fn extra_of(token: &near_contract_standards::non_fungible_token::Token) -> serde_json::Value {
    serde_json::from_str(token.metadata.as_ref().unwrap().extra.as_deref().unwrap()).unwrap()
}

fn panics<F: FnOnce()>(f: F) -> bool {
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).is_err()
}

#[test]
fn only_the_owner_sets_the_card_table_with_absolute_images_and_the_contracts_caps() {
    let mut c = fresh();
    c.set_card_art(table());
    assert_eq!(c.get_card_art().len(), table().len());
    assert_eq!(card_by_id(&table(), "euclid-parent").unwrap().title, "Euclid");
    let mut relative = table();
    relative[0].media = "/assets/cards/collection-v14/euclid-parent-footerless.webp".into();
    assert!(panics(|| c.set_card_art(relative)), "a relative image cannot be loaded by wallets");
    let mut wrong_cap = table();
    wrong_cap[0].edition_limit = Some(99);
    assert!(panics(|| c.set_card_art(wrong_cap)), "a card's limit is its rarity's cap");
    as_account(ALICE);
    assert!(panics(|| c.set_card_art(table())), "only the owner sets the card table");
}

#[test]
fn a_pack_holds_exactly_the_earned_cards_in_order_with_a_serial_preview() {
    let (mut c, id, e) = ready(earned(&[("euclid-parent", "euclid", "principal", 4), ("euclid-epic-female", "euclid", "contribution", 3)]));
    let pack = open(&mut c, id, &e);
    let ids: Vec<_> = pack.cards.iter().map(|card| card.card_id.clone().unwrap()).collect();
    assert_eq!(ids, ["euclid-parent", "euclid-epic-female"]);
    assert_eq!(pack.cards[0].kind, TokenKind::Figure, "a catalogued figure's own card mints as that figure");
    assert_eq!(pack.cards[0].figure_id.as_deref(), Some("euclid"));
    assert_eq!(pack.cards[0].rarity, 4);
    assert_eq!(pack.cards[1].kind, TokenKind::Npc, "a contributor card is a person, not the figure");
    assert_eq!(pack.cards[1].figure_id, None);
    assert_eq!(pack.cards[1].action_id, "letters.teach", "a person's NFT carries the deed the player chose");
    for card in &pack.cards {
        assert_eq!(card.edition_key, Some(format!("card:{}:rarity:{}", card.card_id.as_deref().unwrap(), card.rarity)));
        assert_eq!((card.minted, card.next_edition_number), (Some(0), Some(1)));
        assert_eq!(c.rarity_supply(format!("card:{}", card.card_id.as_deref().unwrap()))[card.rarity as usize].held, 1);
    }
}

#[test]
fn a_life_that_earned_no_card_has_no_pack() {
    let (mut c, id, e) = ready(earned(&[]));
    assert!(panics(|| { open(&mut c, id, &e); }));
    let (mut c, id, e) = ready(earned(&[("unknown-card", "euclid", "principal", 4)]));
    assert!(panics(|| { open(&mut c, id, &e); }), "a card missing from the table is never minted");
}

#[test]
fn a_minted_nft_has_its_cards_title_image_serial_and_attributes() {
    let (mut c, id, e) = ready(earned(&[("lysippos-rare-male", "lysippos", "contribution", 2)]));
    let pack = open(&mut c, id, &e);
    let (result, token) = mint(&mut c, id, &pack, 0);
    let metadata = token.metadata.as_ref().unwrap();
    assert_eq!(result.rarity, 2);
    assert_eq!(metadata.title.as_deref(), Some("Portrait Modeller"));
    assert_eq!(metadata.media.as_deref(), Some("https://everfolk.life/assets/cards/collection-v14/lysippos-rare-male-footerless.webp"));
    assert!(metadata.description.as_deref().unwrap().starts_with("Portrait Modeller · Rare · 001/100."));
    let extra = extra_of(&token);
    assert_eq!(extra["card_id"], "lysippos-rare-male");
    assert_eq!(extra["edition_key"], "card:lysippos-rare-male:rarity:2");
    assert_eq!((extra["edition_number"].as_u64(), extra["edition_limit"].as_u64()), (Some(1), Some(100)));
    let traits: Vec<(String, String)> = extra["attributes"].as_array().unwrap().iter()
        .map(|a| (a["trait_type"].as_str().unwrap().into(), a["value"].as_str().unwrap().into())).collect();
    for expected in [("Card", "Portrait Modeller"), ("Rarity", "Rare"), ("Edition", "001/100"), ("Figure", "Lysippos"), ("Role", "Contributor")] {
        assert!(traits.contains(&(expected.0.into(), expected.1.into())), "{expected:?} in {traits:?}");
    }
    assert_eq!(c.edition_supply("card:lysippos-rare-male:rarity:2".into(), 2).next_edition_number, Some(2));
}

#[test]
fn a_sold_out_earned_card_is_shown_but_cannot_be_minted() {
    let (mut c, id, e) = ready(earned(&[("euclid-parent", "euclid", "principal", 4), ("cleomenes-common-male", "cleomenes", "contribution", 0)]));
    for _ in 0..RARITY_CAPS[4].unwrap() {
        c.count_minted_rarity("card:euclid-parent", 4);
    }
    let pack = open(&mut c, id, &e);
    assert_eq!(pack.cards[0].card_id.as_deref(), Some("euclid-parent"));
    assert_eq!(pack.cards[0].next_edition_number, None, "sold out");
    assert_eq!(c.rarity_supply("card:euclid-parent".into())[4].held, 0, "a sold-out card holds nothing");
    context(ALICE, START_MS, NearToken::from_yoctonear(pack.total_fee.0), [10; 32]);
    assert!(panics(|| { c.choose_mint_slot(U64(id), 0); }));
    let (_, token) = mint(&mut c, id, &pack, 1);
    assert_eq!(extra_of(&token)["card_id"], "cleomenes-common-male");
}

#[test]
fn earned_evidence_mints_only_through_its_pack() {
    let (mut c, id, e) = ready(earned(&[("euclid-parent", "euclid", "principal", 4)]));
    with_gas(ALICE, NearToken::from_near(1), 300);
    assert!(panics(|| { let _ = c.mint_life(U64(id), e.clone(), sign(&e), "letters.teach".into()); }), "no rolled direct mint");
    assert!(panics(|| { let _ = c.stage_mint_quote(U64(id), e.clone(), "letters.teach".into()); }), "life-stage NFTs are turned off");
}
