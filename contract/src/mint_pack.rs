//! Paid, persistent three-card mint packs. Raw keys extend existing deployments without changing Contract's Borsh layout.
use crate::mint::Outcome;
use crate::random::block_seed;
use crate::shares::{bps_of, compute_shares};
use crate::types::*;
use crate::{Contract, ContractExt};
use near_sdk::json_types::{U128, U64};
use near_sdk::{env, near, require, serde_json, Gas};

const REROLL_FEE: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR
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
    pub rerolled: bool,
}
#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MintPack {
    pub life_id: U64,
    pub evidence_hash: String,
    pub cards: Vec<MintCard>,
    pub total_fee: U128,
    pub reroll_fee: U128,
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
    pub reroll_fee: U128,
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

#[near]
impl Contract {
    pub fn mint_terms(&self) -> MintTerms {
        MintTerms {
            mint_fee: self.params.mint_fee,
            reroll_fee: U128(REROLL_FEE),
            source_share_bps: self.params.source_mint_share_bps,
            pack_version: 1,
        }
    }
    pub fn get_mint_pack(&self, life_id: U64) -> Option<MintPack> {
        read(life_id.0).map(|p| p.view)
    }

    /// Only signed, finished lives can open a pack. The cards are rolled and saved atomically with payment.
    #[payable]
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
            "This life already has an open pack; resume it without paying again"
        );
        exact_fee(self.params.mint_fee.0);
        self.assert_signed(&evidence_json, &signature);
        let evidence: Evidence = serde_json::from_str(&evidence_json).expect("life evidence json");
        self.assert_evidence(life_id.0, &life, &evidence, &npc_action_id);
        let hash = hex::encode(env::sha256_array(evidence_json.as_bytes()));
        let mut cards = Vec::new();
        for slot in 0..3 {
            cards.push(self.pack_card(life_id.0, &hash, slot, false, &evidence, &npc_action_id));
        }
        let pack = StoredPack {
            view: MintPack {
                life_id,
                evidence_hash: hash,
                cards,
                total_fee: self.params.mint_fee,
                reroll_fee: U128(REROLL_FEE),
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

    /// Each slot can be replaced once. A failed or rejected transaction leaves both the slot and the fee unchanged.
    #[payable]
    pub fn reroll_mint_slot(&mut self, life_id: U64, slot: u8) -> MintPack {
        gas_floor();
        self.owned_alive_life(life_id.0);
        let mut pack = read(life_id.0).expect("Open a mint pack first");
        exact_fee(pack.view.reroll_fee.0);
        require!(slot < 3, "Unknown mint slot");
        require!(
            !pack.view.cards[slot as usize].rerolled,
            "This slot has already been rerolled"
        );
        self.release_card(&pack.view.cards[slot as usize]);
        let evidence: Evidence = serde_json::from_str(&pack.evidence_json).unwrap();
        pack.view.cards[slot as usize] = self.pack_card(
            life_id.0,
            &pack.view.evidence_hash,
            slot,
            true,
            &evidence,
            &pack.npc_action_id,
        );
        pack.view.total_fee.0 += pack.view.reroll_fee.0;
        write(&pack);
        event(
            "mint_pack_rerolled",
            serde_json::json!({"slot":slot, "pack":pack.view}),
        );
        pack.view
    }

    /// Select exactly one stored outcome, mint it, and distribute the entire base + reroll fee using the source shares.
    #[payable]
    pub fn choose_mint_slot(&mut self, life_id: U64, slot: u8) -> MintResult {
        gas_floor();
        exact_fee(1); // wallet approval for the final selection
        let mut life = self.owned_alive_life(life_id.0);
        let pack = read(life_id.0).expect("Open a mint pack first");
        require!(slot < 3, "Unknown mint slot");
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
        );
        // Index the source relation once; economics were frozen when the pack opened.
        self.pay_sources(&token_id, 0, &shares);
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
    pub(crate) fn pack_reserved(&self, figure: &str) -> u32 {
        env::storage_read(&reserved_key(figure))
            .map(|b| u32::from_le_bytes(b.try_into().unwrap()))
            .unwrap_or(0)
    }
    fn release_card(&self, card: &MintCard) {
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
        rerolled: bool,
        evidence: &Evidence,
        npc: &str,
    ) -> MintCard {
        let seed = block_seed(id, format!("mint-pack:{hash}:{slot}:{rerolled}").as_bytes());
        let outcome = self.roll_outcome(&seed, evidence);
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
            rerolled,
        }
    }
    /// Closing a paid pack forfeits its outcomes but still pays every source and the treasury.
    pub(crate) fn close_mint_pack(&mut self, id: u64) {
        if let Some(pack) = read(id) {
            let evidence: Evidence = serde_json::from_str(&pack.evidence_json).unwrap();
            let shares = compute_shares(
                &evidence
                    .sources
                    .iter()
                    .map(|s| (s.token_id.clone(), s.impact))
                    .collect::<Vec<_>>(),
            );
            let paid = self.credit_sources(
                &shares,
                bps_of(pack.view.total_fee.0, pack.view.source_share_bps),
            );
            self.credit(&self.treasury_id.clone(), pack.view.total_fee.0 - paid);
            for c in &pack.view.cards {
                self.release_card(c);
            }
            env::storage_remove(&key(id));
            event(
                "mint_pack_closed",
                serde_json::json!({"life_id":id.to_string(), "total_fee":pack.view.total_fee}),
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
            near_sdk::NearToken::from_yoctonear(BASE),
            [8; 32],
        );
        c.open_mint_pack(
            U64(id),
            evidence.into(),
            sign(evidence),
            "letters.teach".into(),
        )
    }
    #[test]
    fn pack_is_persistent_then_mints_one_stored_card_and_splits_every_paid_fee() {
        let (mut c, id, e, source) = ready();
        let first = open(&mut c, id, &e);
        assert_eq!(first.cards.len(), 3);
        assert_eq!(
            c.get_mint_pack(U64(id)).unwrap().evidence_hash,
            first.evidence_hash
        );
        assert_eq!(
            c.balance_of(account(CAROL)).0,
            0,
            "fees are escrowed until selection or closing"
        );
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(REROLL_FEE),
            [9; 32],
        );
        let changed = c.reroll_mint_slot(U64(id), 1);
        assert!(changed.cards[1].rerolled);
        assert_eq!(changed.total_fee.0, BASE + REROLL_FEE);
        assert_eq!(
            serde_json::to_string(&first.cards[0]).unwrap(),
            serde_json::to_string(&changed.cards[0]).unwrap()
        );
        assert_eq!(
            serde_json::to_string(&first.cards[2]).unwrap(),
            serde_json::to_string(&changed.cards[2]).unwrap()
        );
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(1),
            [10; 32],
        );
        let result = c.choose_mint_slot(U64(id), 1);
        assert_eq!(result.figure_id, changed.cards[1].figure_id);
        assert_eq!(result.rarity, changed.cards[1].rarity);
        assert_eq!(result.affection, changed.cards[1].affection);
        assert!(c.get_mint_pack(U64(id)).is_none());
        assert!(c.active_life_of(account(ALICE)).is_none());
        assert_eq!(c.get_life(U64(id)).unwrap().status, LifeStatus::Minted);
        assert_eq!(c.balance_of(account(CAROL)).0, (BASE + REROLL_FEE) / 2);
        assert_eq!(c.balance_of(account(TREASURY)).0, (BASE + REROLL_FEE) / 2);
        assert_eq!(c.children_of(source.clone(), 0, 100), vec![result.token_id]);
        assert_eq!(c.token_stats(source).lives_influenced, 1);
        assert_eq!(c.pack_reserved("euclid"), 0);
    }
    #[test]
    fn every_slot_can_reroll_once_and_close_still_distributes_the_total() {
        let (mut c, id, e, source) = ready();
        open(&mut c, id, &e);
        for slot in 0..3 {
            context(
                ALICE,
                START_MS,
                near_sdk::NearToken::from_yoctonear(REROLL_FEE),
                [slot; 32],
            );
            c.reroll_mint_slot(U64(id), slot);
        }
        assert_eq!(
            c.get_mint_pack(U64(id)).unwrap().total_fee.0,
            BASE + 3 * REROLL_FEE
        );
        as_account(ALICE);
        c.abandon_life(U64(id));
        assert_eq!(c.balance_of(account(CAROL)).0, (BASE + 3 * REROLL_FEE) / 2);
        assert_eq!(
            c.balance_of(account(TREASURY)).0,
            (BASE + 3 * REROLL_FEE) / 2
        );
        assert_eq!(c.token_stats(source).lives_influenced, 0);
        assert_eq!(c.pack_reserved("euclid"), 0);
        assert!(c.get_mint_pack(U64(id)).is_none());
    }
    #[test]
    fn figure_cards_reserve_supply_until_released() {
        let (mut c, id, e, _) = ready();
        as_account(OWNER);
        let mut p = c.get_params();
        p.drop_rate_bps = 10_000;
        c.set_params(p);
        let pack = open(&mut c, id, &e);
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
            near_sdk::NearToken::from_yoctonear(BASE),
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
    #[should_panic(expected = "This slot has already been rerolled")]
    fn second_reroll_rejected() {
        let (mut c, id, e, _) = ready();
        open(&mut c, id, &e);
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(REROLL_FEE),
            [3; 32],
        );
        c.reroll_mint_slot(U64(id), 0);
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(REROLL_FEE),
            [4; 32],
        );
        c.reroll_mint_slot(U64(id), 0);
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
    #[should_panic(expected = "Attach exactly the quoted fee")]
    fn underpaid_reroll_rejected() {
        let (mut c, id, e, _) = ready();
        open(&mut c, id, &e);
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(REROLL_FEE - 1),
            [3; 32],
        );
        c.reroll_mint_slot(U64(id), 0);
    }
    #[test]
    #[should_panic(expected = "Unknown mint slot")]
    fn invalid_slot_rejected() {
        let (mut c, id, e, _) = ready();
        open(&mut c, id, &e);
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(1),
            [3; 32],
        );
        c.choose_mint_slot(U64(id), 3);
    }
    #[test]
    #[should_panic(expected = "The life evidence signature is not valid")]
    fn unsigned_pack_rejected() {
        let (mut c, id, e, _) = ready();
        context(
            ALICE,
            START_MS,
            near_sdk::NearToken::from_yoctonear(BASE),
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
        with_gas(ALICE, near_sdk::NearToken::from_yoctonear(BASE), 149);
        c.open_mint_pack(U64(id), e.clone(), sign(&e), "letters.teach".into());
    }
}
