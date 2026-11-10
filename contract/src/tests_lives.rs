use crate::test_utils::*;
use crate::types::*;
use near_sdk::json_types::U64;
use near_sdk::NearToken;

const WORLD: &str = "alexandria-ranked-1";

fn hash(n: u8) -> String {
    hex::encode([n; 32])
}

fn ready() -> crate::Contract {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c.set_world_versions(vec![WORLD.into()]);
    c
}

fn no_nobody(c: &mut crate::Contract) {
    as_account(OWNER);
    let mut p = c.get_params();
    p.nobody_weight_bps = 0;
    c.set_params(p);
}

fn start_as(c: &mut crate::Contract, who: &str) -> LifeView {
    as_account(who);
    c.start_life(WORLD.into())
}

#[test]
fn start_life_assigns_seed_and_status_alive() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    assert_eq!(life.life_id, U64(1));
    assert_eq!(life.account_id, account(ALICE));
    assert_eq!(life.seed.len(), 64);
    assert!(life.seed.chars().all(|ch| ch.is_ascii_hexdigit()));
    assert_eq!(life.status, LifeStatus::Alive);
    assert_eq!(life.world_version, WORLD);
    assert_eq!(life.started_at_ms, START_MS);
    assert!(life.figure_picks.is_empty());
    assert_eq!(c.get_life(U64(1)), Some(life.clone()));
    assert_eq!(c.active_life_of(account(ALICE)), Some(life));
}

#[test]
fn different_accounts_get_different_seeds() {
    let mut c = ready();
    let a = start_as(&mut c, ALICE);
    let b = start_as(&mut c, BOB);
    assert_ne!(a.seed, b.seed);
    assert_eq!(b.life_id, U64(2));
}

#[test]
#[should_panic(expected = "This world version is not open for ranked play")]
fn start_rejects_unlisted_world_version() {
    let mut c = ready();
    as_account(ALICE);
    c.start_life("alexandria-0.33.0".into());
}

#[test]
#[should_panic(expected = "You already have a ranked life in progress")]
fn one_alive_life_per_account() {
    let mut c = ready();
    start_as(&mut c, ALICE);
    start_as(&mut c, ALICE);
}

#[test]
fn abandon_removes_the_life() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.abandon_life(life.life_id);
    assert_eq!(c.get_life(life.life_id), None);
    assert_eq!(c.active_life_of(account(ALICE)), None);
}

#[test]
#[should_panic(expected = "Your next ranked life opens")]
fn restart_during_cooldown_rejected() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.abandon_life(life.life_id);
    context(ALICE, START_MS + 599_999, NearToken::from_yoctonear(0), [5; 32]);
    c.start_life(WORLD.into());
}

#[test]
fn restart_after_cooldown_allowed() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.abandon_life(life.life_id);
    context(ALICE, START_MS + 600_000, NearToken::from_yoctonear(0), [6; 32]);
    let next = c.start_life(WORLD.into());
    assert_eq!(next.life_id, U64(2));
}

#[test]
#[should_panic(expected = "Only the life's owner can do this")]
fn only_owner_can_abandon() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    as_account(BOB);
    c.abandon_life(life.life_id);
}

#[test]
fn start_life_includes_figure_picks() {
    let mut c = ready();
    let token = seed_figure(&mut c, "euclid", 40, 3);
    let life = start_as(&mut c, ALICE);
    assert_eq!(
        life.figure_picks,
        vec![FigurePick { figure_id: "euclid".into(), token_id: token, action_id: "euclid.school".into(), rarity: 3 }]
    );
}

#[test]
fn figure_picks_weighted_by_affection() {
    let mut c = ready();
    let _rare = seed_figure(&mut c, "euclid", 1, 2);
    let common = seed_figure(&mut c, "euclid", 99, 2);
    let mut wins = 0;
    for i in 0..200u32 {
        let mut seed = [0u8; 32];
        seed[..4].copy_from_slice(&i.to_le_bytes());
        let picks = c.pick_figures(&seed);
        assert_eq!(picks.len(), 1, "figures without copies are skipped");
        if picks[0].token_id == common {
            wins += 1;
        }
    }
    assert!(wins > 150, "the 99-affection copy won only {wins} of 200");
}

#[test]
fn draw_from_empty_pool_is_null() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    let draw = c.draw_npc(life.life_id, 3, "education".into(), hash(1));
    assert_eq!(draw, Draw { step: 3, category: "education".into(), token_id: None, action_id: None, rarity: None, commands_hash: hash(1) });
    assert_eq!(c.get_life(life.life_id).unwrap().draws, vec![draw]);
}

#[test]
fn draw_picks_only_from_the_matching_category() {
    let mut c = ready();
    seed_npc(&mut c, "military", "war", "military.mentor", 100, 1);
    let teacher = seed_npc(&mut c, "letters", "education", "letters.teach", 100, 2);
    no_nobody(&mut c);
    let life = start_as(&mut c, ALICE);
    let draw = c.draw_npc(life.life_id, 0, "education".into(), hash(1));
    assert_eq!(draw.token_id, Some(teacher));
    assert_eq!(draw.action_id.as_deref(), Some("letters.teach"));
    assert_eq!(draw.rarity, Some(2));
}

#[test]
fn nobody_weight_leaves_some_draws_empty() {
    let mut c = ready();
    seed_npc(&mut c, "letters", "education", "letters.teach", 10, 0);
    let life = start_as(&mut c, ALICE);
    let draws = crate::lives::MAX_RECORDS_PER_LIFE as u32;
    let empty = (0..draws).filter(|step| c.draw_npc(life.life_id, *step, "education".into(), hash(1)).token_id.is_none()).count();
    assert!((34..=94).contains(&empty), "{empty} of {draws} draws were empty at a 50% nobody weight");
}

#[test]
#[should_panic(expected = "Steps must not go backwards")]
fn draw_rejects_decreasing_step() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.draw_npc(life.life_id, 5, "education".into(), hash(1));
    c.draw_npc(life.life_id, 4, "education".into(), hash(2));
}

#[test]
fn repeat_draw_at_same_step_returns_stored_draw() {
    let mut c = ready();
    seed_npc(&mut c, "letters", "education", "letters.teach", 100, 0);
    let life = start_as(&mut c, ALICE);
    let first = c.draw_npc(life.life_id, 7, "education".into(), hash(1));
    context(ALICE, START_MS + 1, NearToken::from_yoctonear(0), [42; 32]);
    let again = c.draw_npc(life.life_id, 7, "education".into(), hash(1));
    assert_eq!(first, again);
    assert_eq!(c.get_life(life.life_id).unwrap().draws.len(), 1);
}

#[test]
#[should_panic(expected = "A different record already exists at this step")]
fn repeat_draw_with_different_hash_rejected() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.draw_npc(life.life_id, 7, "education".into(), hash(1));
    c.draw_npc(life.life_id, 7, "education".into(), hash(2));
}

#[test]
#[should_panic(expected = "A different category was already drawn at this step")]
fn repeat_draw_with_different_category_rejected() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.draw_npc(life.life_id, 7, "education".into(), hash(1));
    c.draw_npc(life.life_id, 7, "war".into(), hash(1));
}

#[test]
fn checkpoint_and_draw_may_share_a_step_with_the_same_hash() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.checkpoint(life.life_id, 9, hash(3));
    c.draw_npc(life.life_id, 9, "education".into(), hash(3));
    c.checkpoint(life.life_id, 9, hash(3));
    let stored = c.get_life(life.life_id).unwrap();
    assert_eq!(stored.checkpoints, vec![Checkpoint { step: 9, commands_hash: hash(3) }]);
    assert_eq!(stored.draws.len(), 1);
}

#[test]
fn checkpoint_records_hash_in_order() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.checkpoint(life.life_id, 5, hash(1));
    c.checkpoint(life.life_id, 12, hash(2));
    let stored = c.get_life(life.life_id).unwrap();
    assert_eq!(stored.checkpoints.iter().map(|cp| cp.step).collect::<Vec<_>>(), vec![5, 12]);
}

#[test]
#[should_panic(expected = "Steps must not go backwards")]
fn checkpoint_rejects_decreasing_step() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.checkpoint(life.life_id, 5, hash(1));
    c.checkpoint(life.life_id, 3, hash(1));
}

#[test]
#[should_panic(expected = "Only the life's owner can do this")]
fn only_owner_can_draw() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    as_account(BOB);
    c.draw_npc(life.life_id, 0, "education".into(), hash(1));
}

#[test]
#[should_panic(expected = "Only the life's owner can do this")]
fn only_owner_can_checkpoint() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    as_account(BOB);
    c.checkpoint(life.life_id, 0, hash(1));
}

#[test]
#[should_panic(expected = "Unknown category")]
fn unknown_category_rejected() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.draw_npc(life.life_id, 0, "astrology".into(), hash(1));
}

#[test]
#[should_panic(expected = "Commands hash must be 64 lowercase hex characters")]
fn malformed_commands_hash_rejected() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    c.checkpoint(life.life_id, 0, "ABC".into());
}

#[test]
#[should_panic(expected = "Life not found")]
fn draw_on_missing_life_rejected() {
    let mut c = ready();
    as_account(ALICE);
    c.draw_npc(U64(99), 0, "education".into(), hash(1));
}

#[test]
#[should_panic(expected = "Attach at least 100 Tgas")]
fn draw_with_too_little_gas_rejected() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    with_gas(ALICE, NearToken::from_yoctonear(0), 99);
    c.draw_npc(life.life_id, 0, "education".into(), hash(1));
}

#[test]
#[should_panic(expected = "This life has reached its checkpoint limit")]
fn checkpoints_per_life_are_capped() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    for step in 0..=crate::lives::MAX_RECORDS_PER_LIFE as u32 {
        c.checkpoint(life.life_id, step, hash(1));
    }
}

#[test]
#[should_panic(expected = "This life has reached its draw limit")]
fn draws_per_life_are_capped() {
    let mut c = ready();
    let life = start_as(&mut c, ALICE);
    for step in 0..=crate::lives::MAX_RECORDS_PER_LIFE as u32 {
        c.draw_npc(life.life_id, step, "education".into(), hash(1));
    }
}
