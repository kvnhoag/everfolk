//! Farming deeds and the demo world version against the existing contract. No contract code changes.
use crate::test_utils::*;
use crate::types::*;
use crate::Contract;
use near_sdk::json_types::U64;
use near_sdk::serde_json::json;

const DEMO: &str = "alexandria-demo-1";
const RANKED: &str = "alexandria-ranked-1";

fn with_demo_deeds(mut catalog: CatalogConfig) -> CatalogConfig {
    catalog.npc_actions.extend([
        NpcActionConfig { action_id: "farming.stock-granary".into(), career_group: "farming".into(), category: "harvest".into() },
        NpcActionConfig { action_id: "farming.share-seed".into(), career_group: "farming".into(), category: "harvest".into() },
        NpcActionConfig { action_id: "military.guard-road".into(), career_group: "military".into(), category: "road".into() },
    ]);
    catalog
}

fn ready() -> Contract {
    let mut c = fresh();
    c.set_catalog(with_demo_deeds(sample_catalog()));
    c.set_world_versions(vec![RANKED.into(), DEMO.into()]);
    c
}

fn evidence(seed: &str, life: u64, group: &str) -> String {
    json!({
        "v": 1, "seed": seed, "life_id": life.to_string(), "account_id": ALICE, "world_version": DEMO,
        "world_fingerprint": "f".repeat(64), "save_hash": "a".repeat(64),
        "stats": { "bonds": 40 }, "skills": {}, "origin_id": "tenant-household", "peak_job_id": "tenant-farmer",
        "accomplishments": [], "death_age": 48, "birth_year": -350, "death_year": -302,
        "career_group": group, "matched_figures": [], "sources": []
    })
    .to_string()
}

#[test]
fn farming_life_mints_into_the_farming_group() {
    let mut c = ready();
    as_account(ALICE);
    let life = c.start_life(DEMO.into());
    assert_eq!(life.world_version, DEMO);
    let body = evidence(&life.seed, life.life_id.0, "farming");
    pay(ALICE, 1);
    let result = c.mint_life(U64(life.life_id.0), body.clone(), sign(&body), "farming.stock-granary".into());
    assert_eq!(result.kind, TokenKind::Npc);
    assert_eq!(result.figure_id, None);
    let record = c.record(&result.token_id);
    assert_eq!(record.action_id, "farming.stock-granary");
    assert_eq!(record.category.as_deref(), Some("harvest"));
    let extra: TokenExtra = near_sdk::serde_json::from_str(
        c.nft.token_metadata_by_id.as_ref().unwrap().get(&result.token_id).unwrap().extra.as_deref().unwrap(),
    ).unwrap();
    assert_eq!(extra.career_group, "farming");
}

#[test]
fn harvest_draw_does_not_take_a_war_token() {
    let mut c = ready();
    let war = seed_npc(&mut c, "military", "war", "military.mentor", 100, 1);
    let granary = seed_npc(&mut c, "farming", "harvest", "farming.stock-granary", 100, 0);
    as_account(OWNER);
    let mut params = c.get_params();
    params.nobody_weight_bps = 0;
    c.set_params(params);
    as_account(ALICE);
    let life = c.start_life(DEMO.into());
    let draw = c.draw_npc(life.life_id, 0, "harvest".into(), "ab".repeat(32));
    assert_eq!(draw.token_id.as_deref(), Some(granary.as_str()));
    assert_ne!(draw.token_id.as_deref(), Some(war.as_str()));
    assert_eq!(draw.category, "harvest");
}

#[test]
#[should_panic(expected = "This action does not belong to the life's career")]
fn ranked_group_cannot_mint_a_farming_deed() {
    let mut c = ready();
    as_account(ALICE);
    let life = c.start_life(DEMO.into());
    let body = evidence(&life.seed, life.life_id.0, "letters");
    pay(ALICE, 1);
    c.mint_life(U64(life.life_id.0), body.clone(), sign(&body), "farming.stock-granary".into());
}

#[test]
fn ranked_world_still_starts_and_does_not_require_the_demo_version() {
    let mut c = ready();
    as_account(ALICE);
    let life = c.start_life(RANKED.into());
    assert_eq!(life.world_version, RANKED);
    let versions = c.get_world_versions();
    assert!(versions.contains(&RANKED.to_string()));
    assert!(versions.contains(&DEMO.to_string()));
}
