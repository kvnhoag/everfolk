use super::*;
use crate::test_utils::*;
use near_contract_standards::non_fungible_token::core::NonFungibleTokenCore;
use near_sdk::NearToken;

fn ready(age: u32) -> (Contract, u64, String, String) {
    let mut c = fresh();
    c.set_catalog(sample_catalog());
    c.set_world_versions(vec!["alexandria-ranked-1".into()]);
    let source = seed_figure(&mut c, "euclid", 50, 2);
    as_account(ALICE);
    let id = c.start_life("alexandria-ranked-1".into()).life_id.0;
    let mut e: serde_json::Value = serde_json::from_str(&evidence_json(
        &seed_of(&c, id),
        id,
        ALICE,
        &[(source.clone(), 10)],
        &["euclid"],
        "letters",
        50,
    ))
    .unwrap();
    e["death_age"] = age.into();
    e["death_year"] = (-350 + age as i32).into();
    let mut records = Vec::new();
    let mut figures = Vec::new();
    for (i, (stage, start)) in STAGES
        .iter()
        .enumerate()
        .filter(|(_, (_, start))| *start <= age)
    {
        let end = STAGES
            .get(i + 1)
            .map(|(_, a)| a - 1)
            .unwrap_or(age)
            .min(age);
        let record = serde_json::json!({"stageId":stage,"title":"A scholar of Rhakotis","fromAge":start,"toAge":end,"district":"rhakotis","field":"letters","tier":"master","jobId":"copyist","topSkills":{"literacy":80},"nodes":["letters-1"],"reputation":60,"accomplishments":["first-copy"],"mentors":["Damon"]});
        let historical = *start >= 16;
        figures.push(serde_json::json!({"stageId":stage,"kind":if historical {"historical"} else {"generic"},"figureId":if historical {Some("euclid")} else {None},"title":"Euclid","name":"Euclid","characterName":"Kallias","media":"/assets/figures/euclid.png","genericMedia":"/assets/pixel/portraits/adult-0.svg","stageRecord":record}));
        records.push(record);
    }
    e["stage_records"] = records.into();
    e["stage_figures"] = figures.into();
    (c, id, e.to_string(), source)
}
fn commit(c: &mut Contract, id: u64, e: &str) -> StageQuote {
    let quote = c.stage_mint_quote(U64(id), e.into(), "letters.teach".into());
    with_gas(ALICE, NearToken::from_yoctonear(quote.total_fee.0), 300);
    c.mint_stage_figures(U64(id), e.into(), sign(e), "letters.teach".into());
    quote
}
fn finish(c: &mut Contract, id: u64) -> StageMintResult {
    with_gas(CONTRACT, NearToken::from_yoctonear(0), 240);
    c.finalize_stage_mint(U64(id))
}
#[test]
fn seven_stages_have_full_metadata_shared_supply_and_one_payment() {
    let (mut c, id, e, source) = ready(61);
    let quote = commit(&mut c, id, &e);
    assert_eq!(quote.cards.len(), 7);
    assert_eq!(quote.total_fee.0, 5 * GENERIC_FEE + 2 * HISTORICAL_FEE);
    assert_eq!(c.pack_reserved("euclid"), 2);
    assert_eq!(c.get_life(U64(id)).unwrap().status, LifeStatus::Minting);
    assert!(c.mint_result(U64(id)).is_none());
    assert_eq!(c.balance_of(account(CAROL)).0, 0);
    let receipt = finish(&mut c, id);
    assert_eq!(receipt.tokens.len(), 7);
    assert_eq!(c.figure_supply("euclid".into()), (3, 5));
    assert_eq!(c.pack_reserved("euclid"), 0);
    assert!(c.active_life_of(account(ALICE)).is_none());
    assert_eq!(c.get_life(U64(id)).unwrap().status, LifeStatus::Minted);
    assert_eq!(c.balance_of(account(CAROL)).0, quote.total_fee.0 / 2);
    assert_eq!(c.balance_of(account(TREASURY)).0, quote.total_fee.0 / 2);
    assert_eq!(c.children_of(source.clone(), 0, 100).len(), 7);
    assert_eq!(c.token_stats(source).lives_influenced, 7);
    for token in &receipt.tokens {
        let nft = c.nft_token(token.result.token_id.clone()).unwrap();
        let meta = nft.metadata.unwrap();
        let extra: serde_json::Value =
            serde_json::from_str(meta.extra.as_deref().unwrap()).unwrap();
        assert_eq!(extra["stage_id"], token.stage_id);
        assert_eq!(extra["stage_record"]["mentors"][0], "Damon");
        assert_eq!(extra["stage_record"]["topSkills"]["literacy"], 80.0);
        assert_eq!(extra["stage_record"]["nodes"][0], "letters-1");
        assert_eq!(extra["stage_record"]["accomplishments"][0], "first-copy");
        assert_eq!(meta.media.unwrap(), token.portrait_media);
        assert_eq!(nft.owner_id, account(ALICE));
    }
    let first = &receipt.tokens[0];
    as_account(ALICE);
    c.set_action(first.result.token_id.clone(), "letters.lend-books".into());
    let meta = c
        .nft_token(first.result.token_id.clone())
        .unwrap()
        .metadata
        .unwrap();
    let extra: serde_json::Value = serde_json::from_str(meta.extra.as_deref().unwrap()).unwrap();
    assert_eq!(extra["stage_record"]["mentors"][0], "Damon");
    assert_eq!(extra["stage_id"], "infancy");
    assert_eq!(extra["action_id"], "letters.lend-books");
}
#[test]
fn retry_preserves_fee_seed_names_params_and_is_idempotent_after_transfer() {
    let (mut c, id, e, _) = ready(61);
    let quote = commit(&mut c, id, &e);
    as_account(OWNER);
    let mut params = c.get_params();
    params.source_mint_share_bps = 0;
    c.set_params(params);
    with_gas(ALICE, NearToken::from_yoctonear(0), 300);
    assert!(matches!(
        c.retry_stage_mint(U64(id)),
        PromiseOrValue::Promise(_)
    ));
    let result = finish(&mut c, id);
    assert_eq!(c.balance_of(account(CAROL)).0, quote.total_fee.0 / 2);
    assert_eq!(
        serde_json::to_string(&finish(&mut c, id)).unwrap(),
        serde_json::to_string(&result).unwrap()
    );
    context(ALICE, START_MS, NearToken::from_yoctonear(1), [9; 32]);
    c.nft_transfer(
        account(BOB),
        result.tokens[0].result.token_id.clone(),
        None,
        None,
    );
    with_gas(ALICE, NearToken::from_yoctonear(0), 300);
    let recovered = match c.retry_stage_mint(U64(id)) {
        PromiseOrValue::Value(r) => r,
        _ => panic!("already minted"),
    };
    assert_eq!(
        recovered.tokens[0].result.token_id,
        result.tokens[0].result.token_id
    );
    assert_eq!(
        c.mint_result(U64(id)).unwrap().token_id,
        result.tokens[0].result.token_id
    );
}
#[test]
fn cap_exhaustion_and_existing_pack_reservations_use_generic_fallback_and_fee() {
    let (mut c, id, e, _) = ready(61);
    for _ in 0..3 {
        seed_figure(&mut c, "euclid", 50, 2);
    }
    c.reserve_figure("euclid"); // an already-open legacy pack owns the last place
    let quote = commit(&mut c, id, &e);
    assert!(quote.cards.iter().all(|c| c.figure_id.is_none()));
    assert_eq!(quote.total_fee.0, 7 * GENERIC_FEE);
    let result = finish(&mut c, id);
    assert!(result
        .tokens
        .iter()
        .all(|t| t.portrait_media == "/assets/pixel/portraits/adult-0.svg"));
    assert_eq!(c.figure_supply("euclid".into()), (4, 5));
    assert_eq!(c.pack_reserved("euclid"), 1);
}
#[test]
fn reservations_leave_no_room_for_a_racing_legacy_mint() {
    let (mut c, id, e, _) = ready(61);
    for _ in 0..2 {
        seed_figure(&mut c, "euclid", 50, 2);
    }
    commit(&mut c, id, &e);
    as_account(BOB);
    let second = c.start_life("alexandria-ranked-1".into()).life_id.0;
    let ev = evidence_json(
        &seed_of(&c, second),
        second,
        BOB,
        &[],
        &["euclid"],
        "letters",
        50,
    );
    let parsed: Evidence = serde_json::from_str(&ev).unwrap();
    let mut params = c.get_params();
    params.drop_rate_bps = 10_000;
    assert!(c
        .roll_outcome(&[4; 32], &parsed, &params, &c.get_catalog(), "letters.teach", &[])
        .figure
        .is_none());
    finish(&mut c, id);
    assert_eq!(c.figure_supply("euclid".into()), (5, 5));
}
#[test]
fn death_in_infancy_includes_its_partial_stage() {
    let (mut c, id, e, _) = ready(0);
    commit(&mut c, id, &e);
    let result = finish(&mut c, id);
    assert_eq!(result.tokens.len(), 1);
    assert_eq!(result.tokens[0].stage_id, "infancy");
}
#[test]
#[should_panic(expected = "Only the life's owner")]
fn another_account_cannot_commit() {
    let (mut c, id, e, _) = ready(0);
    with_gas(BOB, NearToken::from_yoctonear(GENERIC_FEE), 300);
    c.mint_stage_figures(U64(id), e.clone(), sign(&e), "letters.teach".into());
}
#[test]
#[should_panic(expected = "Only the life's owner")]
fn another_account_cannot_retry() {
    let (mut c, id, e, _) = ready(0);
    commit(&mut c, id, &e);
    as_account(BOB);
    c.retry_stage_mint(U64(id));
}
#[test]
#[should_panic(expected = "Only the contract can finalize")]
fn public_finalize_rejected() {
    let (mut c, id, e, _) = ready(0);
    commit(&mut c, id, &e);
    as_account(ALICE);
    c.finalize_stage_mint(U64(id));
}
#[test]
#[should_panic(expected = "Invalid lived stage window")]
fn signed_invalid_window_rejected() {
    let (mut c, id, e, _) = ready(0);
    let mut e: serde_json::Value = serde_json::from_str(&e).unwrap();
    e["stage_records"][0]["toAge"] = 2.into();
    commit(&mut c, id, &e.to_string());
}
#[test]
#[should_panic(expected = "Include every lived stage")]
fn signed_duplicate_or_missing_stage_rejected() {
    let (mut c, id, e, _) = ready(61);
    let mut e: serde_json::Value = serde_json::from_str(&e).unwrap();
    e["stage_records"].as_array_mut().unwrap().pop();
    commit(&mut c, id, &e.to_string());
}
#[test]
#[should_panic(expected = "The life evidence signature is not valid")]
fn tampered_portrait_rejected() {
    let (mut c, id, e, _) = ready(0);
    let sig = sign(&e);
    let changed = e.replace("adult-0.svg", "adult-1.svg");
    with_gas(ALICE, NearToken::from_yoctonear(GENERIC_FEE), 300);
    c.mint_stage_figures(U64(id), changed, sig, "letters.teach".into());
}
#[test]
#[should_panic(expected = "Attach exactly the quoted stage fee")]
fn underpayment_rejected() {
    let (mut c, id, e, _) = ready(0);
    with_gas(ALICE, NearToken::from_yoctonear(GENERIC_FEE - 1), 300);
    c.mint_stage_figures(U64(id), e.clone(), sign(&e), "letters.teach".into());
}
#[test]
#[should_panic(expected = "Attach at least 300 Tgas")]
fn insufficient_gas_rejected() {
    let (mut c, id, e, _) = ready(0);
    with_gas(ALICE, NearToken::from_yoctonear(GENERIC_FEE), 299);
    c.mint_stage_figures(U64(id), e.clone(), sign(&e), "letters.teach".into());
}
#[test]
#[should_panic(expected = "This life is no longer in progress")]
fn second_payment_and_legacy_mint_are_blocked_after_commit() {
    let (mut c, id, e, _) = ready(0);
    commit(&mut c, id, &e);
    with_gas(ALICE, NearToken::from_yoctonear(GENERIC_FEE), 300);
    c.mint_life(U64(id), e.clone(), sign(&e), "letters.teach".into());
}

#[test]
fn stage_nfts_show_their_portrait_and_never_claim_a_collection_card() {
    let (mut c, id, e, _) = ready(61);
    let mut table = Vec::new();
    for rarity in 0..4u8 {
        for sex in ["male", "female"] {
            let card_id = format!("aristotle-{}-{sex}", ["common", "uncommon", "rare", "epic"][rarity as usize]);
            table.push(crate::card_art::CardArt {
                media: format!("https://everfolk.life/assets/cards/collection-v14/{card_id}-footerless.webp"), card_id,
                title: "Lyceum Attendant".into(), rarity, figure_id: None, career_group: Some("letters".into()),
                sex: Some(sex.into()), edition_limit: crate::rarity_caps::RARITY_CAPS[rarity as usize],
            });
        }
    }
    as_account(OWNER);
    c.set_card_art(table);
    let mut with_sex: serde_json::Value = serde_json::from_str(&e).unwrap();
    with_sex["sex"] = "female".into();
    let e = with_sex.to_string();
    commit(&mut c, id, &e);
    for token in finish(&mut c, id).tokens {
        let meta = c.nft_token(token.result.token_id.clone()).unwrap().metadata.unwrap();
        let extra: serde_json::Value = serde_json::from_str(meta.extra.as_deref().unwrap()).unwrap();
        assert_eq!(meta.media.unwrap(), token.portrait_media);
        assert!(extra.get("card_id").is_none() && extra.get("attributes").is_none(), "{extra}");
    }
}
