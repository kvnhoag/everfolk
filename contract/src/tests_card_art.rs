//! Every pack card and minted NFT shows one v14 collection card (chain/card-art.ts builds the table).
use crate::card_art::{card_for, CardArt};
use crate::rarity_caps::{design_key, RARITY_CAPS};
use crate::test_utils::*;
use crate::types::*;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_sdk::json_types::U64;
use near_sdk::{serde_json, NearToken};

const RANKS: [&str; 5] = ["common", "uncommon", "rare", "epic", "legendary"];

fn card(card_id: String, title: &str, rarity: u8, figure: Option<&str>, career: Option<&str>, sex: Option<&str>) -> CardArt {
    CardArt {
        media: format!("https://everfolk.life/assets/cards/collection-v14/{card_id}-footerless.webp"),
        card_id,
        title: title.into(),
        rarity,
        figure_id: figure.map(Into::into),
        career_group: career.map(Into::into),
        sex: sex.map(Into::into),
        edition_limit: RARITY_CAPS[rarity as usize],
    }
}

/// Euclid's main cards and the Letters and Military profession sets, as the client's table builder makes them.
fn table() -> Vec<CardArt> {
    let mut cards = Vec::new();
    for rarity in 0..5u8 {
        let id = if rarity == 4 { "euclid-parent".to_string() } else { format!("euclid-parent-{}", RANKS[rarity as usize]) };
        cards.push(card(id, "Euclid", rarity, Some("euclid"), None, None));
    }
    for (career, figure, title) in [("letters", "aristotle", "Lyceum Attendant"), ("military", "alexander", "Camp Runner")] {
        for rarity in 0..4u8 {
            for sex in ["male", "female"] {
                cards.push(card(format!("{figure}-{}-{sex}", RANKS[rarity as usize]), title, rarity, None, Some(career), Some(sex)));
            }
        }
    }
    cards
}

fn with_sex(evidence: &str, sex: Option<&str>) -> String {
    let mut value: serde_json::Value = serde_json::from_str(evidence).unwrap();
    if let Some(sex) = sex {
        value["sex"] = sex.into();
    }
    value.to_string()
}

fn ready(sex: Option<&str>, career: &str, matched: &[&str]) -> (crate::Contract, u64, String) {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c.set_world_versions(vec!["alexandria-ranked-1".into()]);
    c.set_card_art(table());
    as_account(ALICE);
    let id = c.start_life("alexandria-ranked-1".into()).life_id.0;
    let evidence = with_sex(&evidence_json(&seed_of(&c, id), id, ALICE, &[], matched, career, 75), sex);
    (c, id, evidence)
}

fn open(c: &mut crate::Contract, id: u64, evidence: &str, action: &str) -> crate::mint_pack::MintPack {
    context(ALICE, START_MS, NearToken::from_yoctonear(0), [8; 32]);
    c.open_mint_pack(U64(id), evidence.into(), sign(evidence), action.into())
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

#[test]
fn only_the_owner_sets_the_card_table_and_every_image_is_an_absolute_https_url() {
    let mut c = fresh();
    c.set_card_art(table());
    assert_eq!(c.get_card_art().len(), table().len());
    let mut relative = table();
    relative[0].media = "/assets/cards/collection-v14/euclid-parent-common-footerless.webp".into();
    let refused = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.set_card_art(relative)));
    assert!(refused.is_err(), "a relative image cannot be loaded by wallets");
    as_account(ALICE);
    let stranger = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| c.set_card_art(table())));
    assert!(stranger.is_err(), "only the owner sets the card table");
}

#[test]
fn a_card_matches_figure_and_rarity_or_career_rarity_and_sex() {
    let cards = table();
    assert_eq!(card_for(&cards, Some("euclid"), 2, "letters", Some("female")).unwrap().card_id, "euclid-parent-rare");
    assert_eq!(card_for(&cards, None, 0, "military", Some("female")).unwrap().card_id, "alexander-common-female");
    assert_eq!(card_for(&cards, None, 3, "letters", Some("male")).unwrap().card_id, "aristotle-epic-male");
    assert!(card_for(&cards, None, 1, "letters", None).is_none(), "an unrecorded sex is never guessed");
    assert!(card_for(&cards, None, 4, "letters", Some("male")).is_none(), "no Legendary profession card yet");
    assert!(card_for(&[], None, 0, "letters", Some("male")).is_none());
}

#[test]
fn pack_cards_carry_their_card_and_the_next_serial_of_that_design() {
    let (mut c, id, e) = ready(Some("female"), "military", &[]);
    let pack = open(&mut c, id, &e, "military.mentor");
    for card in &pack.cards {
        let expected = format!("alexander-{}-female", RANKS[card.rarity as usize]);
        if card.rarity < 4 {
            assert_eq!(card.card_id.as_deref(), Some(expected.as_str()));
            assert_eq!(card.edition_key, Some(format!("card:{expected}:rarity:{}", card.rarity)));
            assert_eq!(card.edition_limit, Some(RARITY_CAPS[card.rarity as usize]));
            assert_eq!((card.minted, card.next_edition_number), (Some(0), Some(1)));
        }
    }
}

#[test]
fn a_minted_nft_has_the_cards_title_image_serial_and_attributes() {
    let (mut c, id, e) = ready(Some("female"), "military", &[]);
    let pack = open(&mut c, id, &e, "military.mentor");
    let slot = pack.cards.iter().position(|card| card.rarity < 4).unwrap();
    let chosen = pack.cards[slot].clone();
    let (result, token) = mint(&mut c, id, &pack, slot);
    let metadata = token.metadata.as_ref().unwrap();
    let card_id = chosen.card_id.clone().unwrap();
    assert_eq!(metadata.title.as_deref(), Some("Camp Runner"));
    assert_eq!(metadata.media.as_deref(), Some(format!("https://everfolk.life/assets/cards/collection-v14/{card_id}-footerless.webp").as_str()));
    assert!(metadata.description.as_deref().unwrap().starts_with("Camp Runner ·"));
    let extra = extra_of(&token);
    assert_eq!(extra["card_id"], card_id.as_str());
    let key = format!("card:{card_id}:rarity:{}", result.rarity);
    assert_eq!(extra["edition_key"], key.as_str());
    assert_eq!(extra["edition_number"], 1);
    assert_eq!(extra["edition_limit"], serde_json::to_value(RARITY_CAPS[result.rarity as usize]).unwrap(), "null is unlimited");
    assert_eq!(extra["sex"], "female");
    let traits: Vec<(String, String)> = extra["attributes"].as_array().unwrap().iter()
        .map(|a| (a["trait_type"].as_str().unwrap().into(), a["value"].as_str().unwrap().into())).collect();
    let rarity = ["Common", "Uncommon", "Rare", "Epic", "Legendary"][result.rarity as usize];
    assert!(traits.contains(&("Card".into(), "Camp Runner".into())));
    assert!(traits.contains(&("Rarity".into(), rarity.into())));
    assert!(traits.contains(&("Career".into(), "Military".into())));
    assert!(traits.iter().any(|(name, value)| name == "Edition" && value.starts_with("001")));
    assert_eq!(c.edition_supply(key.clone(), result.rarity).minted, 1);
    assert_eq!(c.edition_supply(key, result.rarity).next_edition_number, Some(2));
}

#[test]
fn a_historical_figure_mints_as_its_main_card() {
    let (mut c, id, e) = ready(Some("male"), "letters", &["euclid"]);
    as_account(OWNER);
    let mut params = c.get_params();
    params.drop_rate_bps = 10_000;
    c.set_params(params);
    let pack = open(&mut c, id, &e, "letters.teach");
    let slot = pack.cards.iter().position(|card| card.figure_id.is_some()).expect("a figure card");
    let cards = table();
    let expected = card_for(&cards, Some("euclid"), pack.cards[slot].rarity, "letters", Some("male")).unwrap();
    let (_, token) = mint(&mut c, id, &pack, slot);
    assert_eq!(token.metadata.as_ref().unwrap().title.as_deref(), Some("Euclid"));
    assert_eq!(extra_of(&token)["card_id"], expected.card_id.as_str());
}

#[test]
fn rarity_supply_is_counted_per_card_design() {
    let (c, _, _) = ready(Some("female"), "military", &[]);
    for _ in 0..RARITY_CAPS[2].unwrap() {
        c.count_minted_rarity("card:alexander-rare-female", 2);
    }
    let cards = table();
    let female = c.open_weights_for(&cards, None, "military", Some("female"), "military.mentor", [6000, 2500, 1000, 400, 100]);
    let male = c.open_weights_for(&cards, None, "military", Some("male"), "military.mentor", [6000, 2500, 1000, 400, 100]);
    assert_eq!(female[2], 0, "the female Rare Camp Runner is sold out");
    assert_eq!(male[2], 1000, "the male card is a separate design");
    assert_eq!(c.edition_supply("card:alexander-rare-female:rarity:2".into(), 2).next_edition_number, None, "sold out");
}

#[test]
fn evidence_without_a_sex_keeps_the_earlier_untitled_mint() {
    let (mut c, id, e) = ready(None, "military", &[]);
    let pack = open(&mut c, id, &e, "military.mentor");
    assert!(pack.cards.iter().all(|card| card.card_id.is_none()));
    let (_, token) = mint(&mut c, id, &pack, 0);
    let metadata = token.metadata.as_ref().unwrap();
    assert_eq!(metadata.title.as_deref(), Some(format!("A life of Alexandria #{id}").as_str()));
    assert!(metadata.media.is_none());
    let extra = extra_of(&token);
    assert!(extra.get("card_id").is_none() && extra.get("attributes").is_none());
    assert_eq!(extra["edition_key"], format!("npc:military.mentor:rarity:{}", extra["rarity"]), "every NFT still gets a serial");
}

#[test]
fn a_pack_opened_before_the_upgrade_releases_its_old_design() {
    let (c, _, _) = ready(Some("male"), "letters", &[]);
    let legacy = design_key(None, "letters.teach");
    c.hold_rarity(&legacy, 3);
    let old_card: crate::mint_pack::MintCard = serde_json::from_value(serde_json::json!({
        "kind": "npc", "figure_id": null, "rarity": 3, "affection": 40, "action_id": "letters.teach"
    })).unwrap();
    c.release_pack_card(&old_card);
    assert_eq!(c.rarity_supply(legacy)[3].held, 0);
}
