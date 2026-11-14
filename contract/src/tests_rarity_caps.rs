//! Per-design rarity supply: Legendary 10, Epic 25, Rare 100; Common and Uncommon unlimited.
use crate::rarity_caps::{design_key, RARITY_CAPS};
use crate::test_utils::*;
use crate::types::*;
use near_sdk::json_types::U64;

const NPC: [u64; 5] = [6000, 2500, 1000, 400, 100];

fn ready() -> (crate::Contract, u64, String) {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c.set_world_versions(vec!["alexandria-ranked-1".into()]);
    as_account(ALICE);
    let id = c.start_life("alexandria-ranked-1".into()).life_id.0;
    let evidence = evidence_json(&seed_of(&c, id), id, ALICE, &[], &["euclid"], "letters", 75);
    (c, id, evidence)
}
fn sell_out(c: &crate::Contract, design: &str, rarity: u8) {
    for _ in 0..RARITY_CAPS[rarity as usize].unwrap() {
        c.count_minted_rarity(design, rarity);
    }
}
fn open(c: &mut crate::Contract, id: u64, evidence: &str) -> crate::mint_pack::MintPack {
    context(ALICE, START_MS, near_sdk::NearToken::from_yoctonear(0), [8; 32]);
    c.open_mint_pack(U64(id), evidence.into(), sign(evidence), "letters.teach".into())
}

#[test]
fn caps_are_legendary_10_epic_25_rare_100_and_unlimited_below() {
    assert_eq!(RARITY_CAPS, [None, None, Some(100), Some(25), Some(10)]);
    assert_eq!(design_key(Some("alexander"), "letters.teach"), "figure:alexander");
    assert_eq!(design_key(None, "letters.teach"), "npc:letters.teach");
}

#[test]
fn a_sold_out_rarity_leaves_the_roll_and_the_rest_keep_their_odds() {
    let (c, _, _) = ready();
    let design = "npc:letters.teach";
    assert_eq!(c.open_rarity_weights(design, NPC), NPC);
    sell_out(&c, design, 4);
    assert_eq!(c.open_rarity_weights(design, NPC), [6000, 2500, 1000, 400, 0]);
    assert_eq!(c.open_rarity_weights("npc:letters.copy", NPC), NPC, "another design keeps its own supply");
    let supply = c.rarity_supply(design.into());
    assert_eq!(supply[4].minted, 10);
    assert_eq!(supply[0].cap, None);
}

#[test]
fn held_pack_cards_count_until_released() {
    let (c, _, _) = ready();
    let design = "figure:euclid";
    for _ in 0..24 {
        c.hold_rarity(design, 3);
    }
    assert!(c.rarity_open(design, 3));
    c.hold_rarity(design, 3);
    assert!(!c.rarity_open(design, 3), "25 held Epic copies fill the cap");
    c.release_rarity(design, 3);
    assert!(c.rarity_open(design, 3));
    c.hold_rarity(design, 0);
    assert_eq!(c.rarity_supply(design.into())[0].held, 0, "unlimited rarities are not tracked");
}

#[test]
fn packs_never_roll_a_sold_out_rarity() {
    let (mut c, id, e) = ready();
    for rarity in 2..5 {
        sell_out(&c, "npc:letters.teach", rarity);
    }
    let pack = open(&mut c, id, &e);
    for card in pack.cards.iter().filter(|card| card.kind == TokenKind::Npc) {
        assert!(card.rarity <= 1, "rarity {} is sold out", card.rarity);
    }
}

#[test]
fn a_figure_with_no_rarity_left_is_not_drawn() {
    let (mut c, id, e) = ready();
    as_account(OWNER);
    let mut params = c.get_params();
    params.drop_rate_bps = 10_000;
    c.set_params(params);
    for rarity in 2..5 {
        sell_out(&c, "figure:euclid", rarity);
    }
    let pack = open(&mut c, id, &e);
    assert!(pack.cards.iter().all(|card| card.figure_id.is_none()));
}

#[test]
fn opening_holds_capped_rarities_and_minting_turns_one_into_a_minted_copy() {
    let (mut c, id, e) = ready();
    let pack = open(&mut c, id, &e);
    let held = |c: &crate::Contract| -> u32 {
        pack.cards.iter().map(|card| design_key(card.figure_id.as_deref(), &card.action_id))
            .collect::<std::collections::BTreeSet<_>>().into_iter()
            .map(|design| c.rarity_supply(design).iter().map(|row| row.held).sum::<u32>()).sum()
    };
    let capped = pack.cards.iter().filter(|card| card.rarity >= 2).count() as u32;
    assert_eq!(held(&c), capped);
    context(ALICE, START_MS, near_sdk::NearToken::from_yoctonear(pack.total_fee.0), [10; 32]);
    let slot = pack.cards.iter().position(|card| card.rarity >= 2).unwrap_or(0);
    let result = c.choose_mint_slot(U64(id), slot as u8);
    assert_eq!(held(&c), 0, "minting or closing releases every held card");
    let chosen = &pack.cards[slot];
    let minted = c.rarity_supply(design_key(chosen.figure_id.as_deref(), &chosen.action_id))[result.rarity as usize].minted;
    assert_eq!(minted, if result.rarity >= 2 { 1 } else { 0 });
}
