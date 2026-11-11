use crate::random::{block_seed, roll, weighted_pick};
use crate::types::*;
use crate::{Contract, ContractExt};
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::metadata::TokenMetadata;
use near_sdk::json_types::U64;
use near_sdk::{env, near, require, AccountId, Gas};

/// Most NPC tokens one category's draw pool holds; keeps `draw_npc` under its gas floor.
pub const MAX_POOL: usize = 1000;
/// Most draws, and separately most checkpoints, one life may record (the contract pays their storage).
pub const MAX_RECORDS_PER_LIFE: usize = 128;
/// Gas floor for a draw, above its most expensive branch, so a draw can't be retried by starving one outcome of gas.
const MIN_DRAW_GAS: Gas = Gas::from_tgas(100);

fn validate_hash(hash: &str) {
    require!(
        hash.len() == 64 && hash.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)),
        "Commands hash must be 64 lowercase hex characters"
    );
}

fn now_ms() -> u64 {
    env::block_timestamp_ms()
}

/// Draws and checkpoints may only move forward; records sharing a step must agree on its hash.
fn assert_next_step(life: &Life, step: u32, hash: &str) {
    let records = life.draws.iter().map(|d| (d.step, &d.commands_hash)).chain(life.checkpoints.iter().map(|c| (c.step, &c.commands_hash)));
    for (recorded, recorded_hash) in records {
        require!(step >= recorded, "Steps must not go backwards");
        if step == recorded {
            require!(recorded_hash == hash, "A different record already exists at this step");
        }
    }
}

#[near]
impl Contract {
    /// Begins a ranked life with a seed nobody can choose, and the figure copies that shape its world.
    pub fn start_life(&mut self, world_version: String) -> LifeView {
        let account = env::predecessor_account_id();
        require!(self.world_versions.contains(&world_version), "This world version is not open for ranked play");
        require!(self.active_life.get(&account).is_none(), "You already have a ranked life in progress");
        if let Some(abandoned) = self.abandoned_at.get(&account) {
            let opens = abandoned + self.params.abandon_cooldown_ms;
            if now_ms() < opens {
                env::panic_str(&format!("Your next ranked life opens in {} seconds", (opens - now_ms()).div_ceil(1000)));
            }
        }
        let life_id = self.next_life_id;
        self.next_life_id += 1;
        let seed = block_seed(life_id, account.as_bytes());
        let life = Life {
            account_id: account.clone(),
            seed,
            world_version,
            status: LifeStatus::Alive,
            figure_picks: self.pick_figures(&seed),
            draws: Vec::new(),
            checkpoints: Vec::new(),
            started_at_ms: now_ms(),
        };
        let view = LifeView::from_life(life_id, &life);
        self.lives.insert(life_id, life);
        self.active_life.insert(account, life_id);
        view
    }

    /// Gives up a life in progress. It can never mint, and a cooldown applies before the next one.
    pub fn abandon_life(&mut self, life_id: U64) {
        let life = self.owned_alive_life(life_id.0);
        self.lives.remove(&life_id.0);
        self.active_life.remove(&life.account_id);
        self.abandoned_at.insert(life.account_id, now_ms());
    }

    /// Picks which NPC token (if any) touches this key decision. Retrying the same step, category and hash returns the stored draw.
    pub fn draw_npc(&mut self, life_id: U64, step: u32, category: String, commands_hash: String) -> Draw {
        require!(env::prepaid_gas() >= MIN_DRAW_GAS, "Attach at least 100 Tgas to draw");
        validate_hash(&commands_hash);
        require!(self.catalog.npc_actions.iter().any(|a| a.category == category), "Unknown category");
        let mut life = self.owned_alive_life(life_id.0);
        if let Some(existing) = life.draws.iter().find(|d| d.step == step) {
            require!(existing.commands_hash == commands_hash, "A different record already exists at this step");
            require!(existing.category == category, "A different category was already drawn at this step");
            return existing.clone();
        }
        assert_next_step(&life, step, &commands_hash);
        require!(life.draws.len() < MAX_RECORDS_PER_LIFE, "This life has reached its draw limit");
        let draw = self.pick_npc(life_id.0, step, category, commands_hash);
        life.draws.push(draw.clone());
        self.lives.insert(life_id.0, life);
        draw
    }

    /// Records the hash of the command log so far, so the life cannot be rewound before this point.
    pub fn checkpoint(&mut self, life_id: U64, step: u32, commands_hash: String) {
        validate_hash(&commands_hash);
        let mut life = self.owned_alive_life(life_id.0);
        assert_next_step(&life, step, &commands_hash);
        if life.checkpoints.iter().any(|c| c.step == step) {
            return;
        }
        require!(life.checkpoints.len() < MAX_RECORDS_PER_LIFE, "This life has reached its checkpoint limit");
        life.checkpoints.push(Checkpoint { step, commands_hash });
        self.lives.insert(life_id.0, life);
    }

    pub fn get_life(&self, life_id: U64) -> Option<LifeView> {
        self.lives.get(&life_id.0).map(|life| LifeView::from_life(life_id.0, life))
    }

    pub fn active_life_of(&self, account_id: AccountId) -> Option<LifeView> {
        self.active_life.get(&account_id).and_then(|id| self.get_life(U64(*id)))
    }
}

impl Contract {
    pub(crate) fn owned_alive_life(&self, life_id: u64) -> Life {
        let life = self.lives.get(&life_id).unwrap_or_else(|| env::panic_str("Life not found")).clone();
        require!(env::predecessor_account_id() == life.account_id, "Only the life's owner can do this");
        require!(life.status == LifeStatus::Alive, "This life is no longer in progress");
        life
    }

    /// One copy per figure that has any, chosen by its share of that figure's total affection.
    pub(crate) fn pick_figures(&self, seed: &[u8; 32]) -> Vec<FigurePick> {
        let mut picks = Vec::new();
        for figure in &self.catalog.figures {
            let Some(copies) = self.figure_copies.get(&figure.figure_id) else { continue };
            let weights: Vec<u64> = copies.iter().map(|id| self.record(id).affection as u64).collect();
            let domain = format!("fig:{}", figure.figure_id);
            if let Some(index) = weighted_pick(&weights, roll(seed, domain.as_bytes())) {
                let record = self.record(&copies[index]);
                picks.push(FigurePick {
                    figure_id: figure.figure_id.clone(),
                    token_id: copies[index].clone(),
                    action_id: record.action_id.clone(),
                    rarity: record.rarity,
                });
            }
        }
        picks
    }

    fn pick_npc(&self, life_id: u64, step: u32, category: String, commands_hash: String) -> Draw {
        let pool = self.npc_pools.get(&category).cloned().unwrap_or_default();
        let mut weights: Vec<u64> = pool.iter().map(|id| self.record(id).affection as u64).collect();
        let total: u64 = weights.iter().sum();
        let nobody_bps = self.params.nobody_weight_bps as u128;
        weights.push((nobody_bps * total as u128 / (MAX_BPS as u128 - nobody_bps)) as u64);
        let mut domain = b"draw".to_vec();
        domain.extend_from_slice(&step.to_le_bytes());
        let seed = block_seed(life_id, &domain);
        let picked = weighted_pick(&weights, roll(&seed, category.as_bytes())).filter(|i| *i < pool.len());
        let record = picked.map(|i| (pool[i].clone(), self.record(&pool[i])));
        Draw {
            step,
            category,
            token_id: record.as_ref().map(|(id, _)| id.clone()),
            action_id: record.as_ref().map(|(_, r)| r.action_id.clone()),
            rarity: record.as_ref().map(|(_, r)| r.rarity),
            commands_hash,
        }
    }

    pub(crate) fn record(&self, token_id: &str) -> &TokenRecord {
        self.records.get(token_id).unwrap_or_else(|| env::panic_str("Token not found"))
    }

    /// Stores a newly minted token's game facts and adds it to the pool it can influence from.
    pub(crate) fn register_token(&mut self, owner: AccountId, record: TokenRecord, metadata: TokenMetadata) -> String {
        let token_id = self.next_token_id.to_string();
        self.next_token_id += 1;
        self.nft.internal_mint_with_refund(token_id.clone(), owner.clone(), Some(metadata), None);
        NftMint { owner_id: &owner, token_ids: &[&token_id], memo: None }.emit();
        self.add_to_pool(&token_id, &record);
        self.records.insert(token_id.clone(), record);
        token_id
    }

    pub(crate) fn add_to_pool(&mut self, token_id: &str, record: &TokenRecord) {
        let (pools, key) = match record.kind {
            TokenKind::Figure => (&mut self.figure_copies, record.figure_id.clone().expect("figure id")),
            TokenKind::Npc => (&mut self.npc_pools, record.category.clone().expect("category")),
        };
        let mut members = pools.get(&key).cloned().unwrap_or_default();
        if record.kind == TokenKind::Npc && members.len() >= MAX_POOL {
            return; // Minted and tradable, but not drawable: keeps draws under their gas floor.
        }
        members.push(token_id.to_string());
        pools.insert(key, members);
    }
}
