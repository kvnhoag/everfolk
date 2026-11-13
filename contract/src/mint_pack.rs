//! Persistent 1–5 card mint packs: opening is free, minting the chosen card pays the fee quoted at opening.
//! Raw keys extend existing deployments without changing Contract's Borsh layout.
use crate::mint::Outcome;
use crate::random::block_seed;
use crate::rarity_caps::design_key;
use crate::shares::{bps_of, compute_shares};
use crate::types::*;
use crate::{Contract, ContractExt};
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, require, serde_json, Gas};

fn key(id: u64) -> Vec<u8> {
    format!("everfolk:mint-pack:{id}").into_bytes()
}
fn reserved_key(id: &str) -> Vec<u8> {
    format!("everfolk:pack-reserved:{id}").into_bytes()
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MintCard {
    pub kind: TokenKind,
    pub figure_id: Option<String>,
    pub rarity: u8,
    pub affection: u8,
    pub action_id: String,
}
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MintPack {
    pub life_id: U64,
    pub evidence_hash: String,
    pub cards: Vec<MintCard>,
    pub total_fee: U128,
    pub source_share_bps: u16,
}
#[near(serializers = [json])]
struct StoredPack {
    view: MintPack,
    evidence_json: String,
    npc_action_id: String,
}
#[near(serializers = [json])]
pub struct MintTerms {
    pub mint_fee: U128,
    pub source_share_bps: u16,
    pub pack_version: u8,
}
fn read(id: u64) -> Option<StoredPack> {
    env::storage_read(&key(id))
        .map(|bytes| serde_json::from_slice(&bytes).expect("stored mint pack"))
}
fn write(pack: &StoredPack) {
    env::storage_write(
        &key(pack.view.life_id.0),
        &serde_json::to_vec(pack).expect("mint pack json"),
    );
}
fn gas_floor() {
    require!(
        env::prepaid_gas() >= Gas::from_tgas(150),
        "Attach at least 150 Tgas for a mint pack"
    );
}
fn exact_fee(fee: u128) {
    require!(
        env::attached_deposit().as_yoctonear() == fee,
        "Attach exactly the quoted fee"
    );
}
fn event(name: &str, data: serde_json::Value) {
    env::log_str(&format!(
        "EVENT_JSON:{}",
        serde_json::json!({"standard":"everfolk", "version":"1.0.0", "event":name, "data":[data]})
    ));
}

const MIN_PACK_AGE: u16 = 18;
const MAX_PACK_CARDS: u8 = 5;

/// Returns 0 cards if the life ended before adulthood (`death_age < 18`), or 1–5 cards
/// based on life duration and earned titles (`accomplishments` + `matched_figures`).
pub fn pack_card_count(evidence: &Evidence) -> u8 {
    let age = evidence.death_age as u32;
    if age < MIN_PACK_AGE as u32 {
        return 0;
    }
    let duration_base: usize = if age >= 60 {
        3
    } else if age >= 40 {
        2
    } else {
        1
    };
    let titles_count = evidence
        .accomplishments
        .len()
        .saturating_add(evidence.matched_figures.len());
    duration_base
        .saturating_add(titles_count)
        .min(MAX_PACK_CARDS as usize) as u8
}

#[near]
impl Contract {
    pub fn mint_terms(&self) -> MintTerms {
        MintTerms {
            mint_fee: self.params.mint_fee,
            source_share_bps: self.params.source_mint_share_bps,
            // 2: the fee is paid when a card is minted, not when the pack opens.
            pack_version: 2,
        }
    }
    pub fn get_mint_pack(&self, life_id: U64) -> Option<MintPack> {
        read(life_id.0).map(|p| p.view)
    }

    /// Only signed, finished lives can open a pack. Opening is free; the cards are rolled and saved once, with no rerolls.
    pub fn open_mint_pack(
        &mut self,
        life_id: U64,
        evidence_json: String,
        signature: String,
        npc_action_id: String,
    ) -> MintPack {
        gas_floor();
        let life = self.owned_alive_life(life_id.0);
        require!(
            read(life_id.0).is_none(),
            "This life already has an open pack; resume it to choose a card"
        );
        self.assert_signed(&evidence_json, &signature);
        let evidence: Evidence = serde_json::from_str(&evidence_json).expect("life evidence json");
        self.assert_evidence(life_id.0, &life, &evidence, &npc_action_id);
        let card_count = pack_card_count(&evidence);
        require!(
            card_count > 0,
            "This life ended too early to open a mint pack"
        );
        let hash = hex::encode(env::sha256_array(evidence_json.as_bytes()));
        let mut cards = Vec::new();
        for slot in 0..card_count {
            cards.push(self.pack_card(life_id.0, &hash, slot, &evidence, &npc_action_id));
        }
        let pack = StoredPack {
            view: MintPack {
                life_id,
                evidence_hash: hash,
                cards,
                total_fee: self.params.mint_fee,
                source_share_bps: self.params.source_mint_share_bps,
            },
            evidence_json,
            npc_action_id,
        };
        write(&pack);
        event(
            "mint_pack_opened",
            serde_json::to_value(&pack.view).unwrap(),
        );
        pack.view
    }

    /// Mint exactly one stored outcome from the opened pack, paying the fee quoted when it opened; the fee is split by the source shares.
    #[payable]
    pub fn choose_mint_slot(&mut self, life_id: U64, slot: u8) -> MintResult {
        gas_floor();
        let mut life = self.owned_alive_life(life_id.0);
        let pack = read(life_id.0).expect("Open a mint pack first");
        exact_fee(pack.view.total_fee.0);
        require!((slot as usize) < pack.view.cards.len(), "Unknown mint slot");
        let card = &pack.view.cards[slot as usize];
        let evidence: Evidence = serde_json::from_str(&pack.evidence_json).unwrap();
        let shares = compute_shares(
            &evidence
                .sources
                .iter()
                .map(|s| (s.token_id.clone(), s.impact))
                .collect::<Vec<_>>(),
        );
        let hash: [u8; 32] = hex::decode(&pack.view.evidence_hash)
            .unwrap()
            .try_into()
            .unwrap();
        let outcome = Outcome {
            figure: card.figure_id.clone(),
            rarity: card.rarity,
            affection: card.affection,
        };
        let token_id = self.mint_token(
            &life.account_id,
            life_id.0,
            &evidence,
            &outcome,
            &pack.npc_action_id,
            &shares,
            &hash,
            &self.params.clone(),
            &self.catalog.clone(),
        );
        // Index the source relation once; the fee was quoted when the pack opened and is paid now.
        self.pay_sources(&token_id, 0, &shares, pack.view.source_share_bps);
        let paid = self.credit_sources(
            &shares,
            bps_of(pack.view.total_fee.0, pack.view.source_share_bps),
        );
        self.credit(&self.treasury_id.clone(), pack.view.total_fee.0 - paid);
        for c in &pack.view.cards {
            self.release_card(c);
        }
        env::storage_remove(&key(life_id.0));
        life.status = LifeStatus::Minted;
        self.active_life.remove(&life.account_id);
        self.lives.insert(life_id.0, life);
        event(
            "mint_pack_chosen",
            serde_json::json!({"life_id":life_id, "slot":slot, "token_id":token_id, "total_fee":pack.view.total_fee, "evidence_hash":pack.view.evidence_hash}),
        );
        MintResult {
            token_id,
            kind: card.kind,
            figure_id: card.figure_id.clone(),
            rarity: card.rarity,
            affection: card.affection,
        }
    }
}
impl Contract {
    pub(crate) fn reserve_figure(&self, id: &str) {
        env::storage_write(&reserved_key(id), &(self.pack_reserved(id) + 1).to_le_bytes());
    }
    pub(crate) fn release_figure(&self, id: &str) {
        let count = self.pack_reserved(id).checked_sub(1).expect("reserved figure");
        if count == 0 { env::storage_remove(&reserved_key(id)); }
        else { env::storage_write(&reserved_key(id), &count.to_le_bytes()); }
    }
    pub(crate) fn pack_reserved(&self, figure: &str) -> u32 {
        env::storage_read(&reserved_key(figure))
            .map(|b| u32::from_le_bytes(b.try_into().unwrap()))
            .unwrap_or(0)
    }
    fn release_card(&self, card: &MintCard) {
        self.release_rarity(&design_key(card.figure_id.as_deref(), &card.action_id), card.rarity);
        if let Some(id) = &card.figure_id {
            let count = self
                .pack_reserved(id)
                .checked_sub(1)
                .expect("reserved figure");
            if count == 0 {
                env::storage_remove(&reserved_key(id));
            } else {
                env::storage_write(&reserved_key(id), &count.to_le_bytes());
            }
        }
    }
    fn pack_card(
        &self,
        id: u64,
        hash: &str,
        slot: u8,
        evidence: &Evidence,
        npc: &str,
    ) -> MintCard {
        let seed = block_seed(id, format!("mint-pack:{hash}:{slot}").as_bytes());
        let outcome = self.roll_outcome(&seed, evidence, &self.params, &self.catalog, npc);
        self.hold_rarity(&design_key(outcome.figure.as_deref(), npc), outcome.rarity);
        let action_id = outcome
            .figure
            .as_ref()
            .map(|id| {
                env::storage_write(
                    &reserved_key(id),
                    &(self.pack_reserved(id) + 1).to_le_bytes(),
                );
                self.catalog
                    .figures
                    .iter()
                    .find(|f| &f.figure_id == id)
                    .unwrap()
                    .action_ids[0]
                    .clone()
            })
            .unwrap_or_else(|| npc.to_string());
        MintCard {
            kind: if outcome.figure.is_some() {
                TokenKind::Figure
            } else {
                TokenKind::Npc
            },
            figure_id: outcome.figure,
            rarity: outcome.rarity,
            affection: outcome.affection,
            action_id,
        }
    }
    /// Closing an unminted pack forfeits its outcomes and frees their supply; nothing was paid, so nothing is split.
    pub(crate) fn close_mint_pack(&mut self, id: u64) {
        if let Some(pack) = read(id) {
            for c in &pack.view.cards {
                self.release_card(c);
            }
            env::storage_remove(&key(id));
            event(
                "mint_pack_closed",
                serde_json::json!({"life_id":id.to_string()}),
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::*;
    const BASE: u128 = 1_000_000_000_000_000_000_000;
    fn ready() -> (Contract, u64, String, String) {
        let mut c = fresh();
        c.set_catalog(sample_catalog());
        c.set_world_versions(vec!["alexandria-ranked-1".into()]);
        let source = seed_figure(&mut c, "euclid", 50, 2);
        as_account(ALICE);
        let id = c.start_life("alexandria-ranked-1".into()).life_id.0;
        let evidence = evidence_json(
            &seed_of(&c, id),
            id,
            ALICE,
            &[(source.clone(), 10)],
            &["euclid"],
            "letters",
            50,
        );
        (c, id, evidence, source)
    }
    fn open(c: &mut Contract, id: u64, evidence: &str) -> MintPack {
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(0),
            [8; 32],
        );
        c.open_mint_pack(
            U64(id),
            evidence.into(),
            sign(evidence),
            "letters.teach".into(),
        )
    }
    fn custom_evidence_json(
        seed: &str,
        life_id: u64,
        account_id: &str,
        sources: &[(String, u64)],
        matched: &[&str],
        accomplishments: &[(&str, u16)],
        death_age: u16,
    ) -> String {
        serde_json::json!({
            "v": 1, "seed": seed, "life_id": life_id.to_string(), "account_id": account_id,
            "world_version": "alexandria-ranked-1",
            "world_fingerprint": "f".repeat(64), "save_hash": "a".repeat(64),
            "stats": { "health": 40, "knowledge": 70, "wealth": 20, "bonds": 50 },
            "skills": { "literacy": 80 }, "origin_id": "clerk-household", "peak_job_id": "copyist",
            "accomplishments": accomplishments.iter().map(|(id, age)| serde_json::json!({ "id": id, "age": age })).collect::<Vec<_>>(),
            "death_age": death_age, "birth_year": -350, "death_year": -350 + death_age as i32,
            "career_group": "letters", "matched_figures": matched,
            "sources": sources.iter().map(|(t, i)| serde_json::json!({ "token_id": t, "impact": i })).collect::<Vec<_>>(),
        })
        .to_string()
    }
    #[test]
    fn pack_card_count_scales_from_1_to_5_and_returns_zero_before_adulthood() {
        let mut c = fresh();
        c.set_catalog(sample_catalog());
        c.set_world_versions(vec!["alexandria-ranked-1".into()]);
        as_account(ALICE);
        let id = c.start_life("alexandria-ranked-1".into()).life_id.0;
        let seed = seed_of(&c, id);
        let ev = |age: u16, acc: &[(&str, u16)], figs: &[&str]| -> Evidence {
            serde_json::from_str(&custom_evidence_json(&seed, id, ALICE, &[], figs, acc, age)).unwrap()
        };
        assert_eq!(pack_card_count(&ev(0, &[("first-copy", 0)], &["euclid"])), 0);
        assert_eq!(pack_card_count(&ev(17, &[("first-copy", 12)], &[])), 0);
        assert_eq!(pack_card_count(&ev(18, &[], &[])), 1);
        assert_eq!(pack_card_count(&ev(39, &[("first-copy", 20)], &[])), 2);
        assert_eq!(pack_card_count(&ev(40, &[], &[])), 2);
        assert_eq!(pack_card_count(&ev(59, &[("first-copy", 20)], &["euclid"])), 4);
        assert_eq!(pack_card_count(&ev(60, &[], &[])), 3);
        assert_eq!(pack_card_count(&ev(75, &[("a", 20), ("b", 35), ("c", 50)], &["euclid", "alexander"])), 5);
    }
    #[test]
    #[should_panic(expected = "This life ended too early to open a mint pack")]
    fn early_death_cannot_open_pack() {
        let mut c = fresh();
        c.set_catalog(sample_catalog());
        c.set_world_versions(vec!["alexandria-ranked-1".into()]);
        as_account(ALICE);
        let id = c.start_life("alexandria-ranked-1".into()).life_id.0;
        let ev = custom_evidence_json(&seed_of(&c, id), id, ALICE, &[], &[], &[("childhood", 10)], 16);
        open(&mut c, id, &ev);
    }
    #[test]
    fn pack_opens_free_then_minting_one_card_pays_and_splits_the_fee() {
        let (mut c, id, e, source) = ready();
        let first = open(&mut c, id, &e);
        assert_eq!(first.cards.len(), 5);
        assert_eq!(
            c.get_mint_pack(U64(id)).unwrap().evidence_hash,
            first.evidence_hash
        );
        assert_eq!(first.total_fee.0, BASE, "the pack quotes the mint fee");
        assert_eq!(c.balance_of(account(CAROL)).0, 0, "opening pays nothing");
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(BASE),
            [10; 32],
        );
        let result = c.choose_mint_slot(U64(id), 1);
        assert_eq!(result.figure_id, first.cards[1].figure_id);
        assert_eq!(result.rarity, first.cards[1].rarity);
        assert_eq!(result.affection, first.cards[1].affection);
        assert!(c.get_mint_pack(U64(id)).is_none());
        assert!(c.active_life_of(account(ALICE)).is_none());
        assert_eq!(c.get_life(U64(id)).unwrap().status, LifeStatus::Minted);
        assert_eq!(c.balance_of(account(CAROL)).0, BASE / 2);
        assert_eq!(c.balance_of(account(TREASURY)).0, BASE / 2);
        assert_eq!(c.children_of(source.clone(), 0, 100), vec![result.token_id]);
        assert_eq!(c.token_stats(source).lives_influenced, 1);
        assert_eq!(c.pack_reserved("euclid"), 0);
    }
    #[test]
    fn abandoning_open_pack_pays_nothing_and_releases_reserves() {
        let (mut c, id, e, source) = ready();
        let opened = open(&mut c, id, &e);
        assert_eq!(opened.cards.len(), 5);
        as_account(ALICE);
        c.abandon_life(U64(id));
        assert_eq!(c.balance_of(account(CAROL)).0, 0);
        assert_eq!(c.balance_of(account(TREASURY)).0, 0);
        assert_eq!(c.token_stats(source).lives_influenced, 0);
        assert_eq!(c.pack_reserved("euclid"), 0);
        assert!(c.get_mint_pack(U64(id)).is_none());
    }
    #[test]
    fn figure_cards_reserve_supply_until_released() {
        let (mut c, id, _, _) = ready();
        as_account(OWNER);
        let mut p = c.get_params();
        p.drop_rate_bps = 10_000;
        c.set_params(p);
        let three_card_ev = custom_evidence_json(
            &seed_of(&c, id),
            id,
            ALICE,
            &[],
            &["euclid"],
            &[],
            40,
        );
        let pack = open(&mut c, id, &three_card_ev);
        assert_eq!(
            pack.cards
                .iter()
                .filter(|x| x.kind == TokenKind::Figure)
                .count(),
            3
        );
        assert_eq!(c.pack_reserved("euclid"), 3);
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
        context(
            BOB,
            START_MS,
            near_sdk::NearToken::from_yoctonear(0),
            [3; 32],
        );
        let next = c.open_mint_pack(U64(second), ev.clone(), sign(&ev), "letters.teach".into());
        assert_eq!(
            next.cards
                .iter()
                .filter(|x| x.kind == TokenKind::Figure)
                .count(),
            1,
            "one minted + four reserved fills the cap"
        );
        assert_eq!(c.pack_reserved("euclid"), 4);
        as_account(ALICE);
        c.abandon_life(U64(id));
        assert_eq!(c.pack_reserved("euclid"), 1);
    }
    #[test]
    #[should_panic(expected = "This life already has an open pack")]
    fn reopening_cannot_buy_new_outcomes() {
        let (mut c, id, e, _) = ready();
        open(&mut c, id, &e);
        open(&mut c, id, &e);
    }
    #[test]
    #[should_panic(expected = "Only the life's owner")]
    fn another_wallet_cannot_choose() {
        let (mut c, id, e, _) = ready();
        open(&mut c, id, &e);
        context(
            BOB,
            START_MS,
            near_sdk::NearToken::from_yoctonear(1),
            [3; 32],
        );
        c.choose_mint_slot(U64(id), 0);
    }
    #[test]
    #[should_panic(expected = "Unknown mint slot")]
    fn invalid_slot_rejected() {
        let (mut c, id, e, _) = ready();
        let pack = open(&mut c, id, &e);
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(BASE),
            [3; 32],
        );
        c.choose_mint_slot(U64(id), pack.cards.len() as u8);
    }
    #[test]
    #[should_panic(expected = "The life evidence signature is not valid")]
    fn unsigned_pack_rejected() {
        let (mut c, id, e, _) = ready();
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(0),
            [3; 32],
        );
        c.open_mint_pack(U64(id), e, "00".repeat(64), "letters.teach".into());
    }
    #[test]
    #[should_panic(expected = "Choose a card from the open mint pack")]
    fn legacy_mint_cannot_bypass_pack() {
        let (mut c, id, e, _) = ready();
        open(&mut c, id, &e);
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(BASE),
            [3; 32],
        );
        c.mint_life(U64(id), e.clone(), sign(&e), "letters.teach".into());
    }
    #[test]
    #[should_panic(expected = "This life has ended")]
    fn no_more_gameplay_after_opening() {
        let (mut c, id, e, _) = ready();
        open(&mut c, id, &e);
        as_account(ALICE);
        c.checkpoint(U64(id), 0, "00".repeat(32));
    }
    #[test]
    #[should_panic(expected = "Attach at least 150 Tgas")]
    fn low_gas_cannot_retry_pack_outcomes() {
        let (mut c, id, e, _) = ready();
        with_gas(ALICE, near_sdk::NearToken::from_yoctonear(0), 149);
        c.open_mint_pack(U64(id), e.clone(), sign(&e), "letters.teach".into());
    }
    #[test]
    #[should_panic(expected = "Attach exactly the quoted fee")]
    fn minting_without_the_quoted_fee_fails() {
        let (mut c, id, e, _) = ready();
        open(&mut c, id, &e);
        context(ALICE, START_MS, near_sdk::NearToken::from_yoctonear(1), [10; 32]);
        c.choose_mint_slot(U64(id), 0);
    }
    #[test]
    fn mint_terms_say_the_fee_is_paid_at_mint() {
        let (c, _, _, _) = ready();
        assert_eq!(c.mint_terms().pack_version, 2);
    }
}
