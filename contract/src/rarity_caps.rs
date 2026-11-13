//! Per-design rarity supply: each card design (a historical figure, or a city person's deed) has at most
//! 10 Legendary, 25 Epic and 100 Rare copies; Common and Uncommon are unlimited. Opened packs hold their
//! rarity until a card is minted or the pack is closed. Raw keys extend the contract without a Borsh change.
//! Minted copies are counted for every rarity, so each copy gets a serial within its design.
use crate::{Contract, ContractExt};
use near_sdk::{env, near};

/// Copies per design for Common, Uncommon, Rare, Epic and Legendary; `None` is unlimited.
pub const RARITY_CAPS: [Option<u32>; 5] = [None, None, Some(100), Some(25), Some(10)];

/// The design a card is counted under: its historical figure, or else the deed of a person of the city.
pub fn design_key(figure: Option<&str>, npc_action_id: &str) -> String {
    match figure {
        Some(id) => format!("figure:{id}"),
        None => format!("npc:{npc_action_id}"),
    }
}

fn minted_key(design: &str, rarity: u8) -> Vec<u8> {
    format!("everfolk:rarity-minted:{design}:{rarity}").into_bytes()
}
fn held_key(design: &str, rarity: u8) -> Vec<u8> {
    format!("everfolk:rarity-held:{design}:{rarity}").into_bytes()
}
fn read_count(key: &[u8]) -> u32 {
    env::storage_read(key).map(|bytes| u32::from_le_bytes(bytes.try_into().expect("rarity count"))).unwrap_or(0)
}
fn write_count(key: &[u8], value: u32) {
    if value == 0 {
        env::storage_remove(key);
    } else {
        env::storage_write(key, &value.to_le_bytes());
    }
}
fn cap_of(rarity: u8) -> Option<u32> {
    RARITY_CAPS.get(rarity as usize).copied().flatten()
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct RaritySupply {
    pub rarity: u8,
    /// `None` means unlimited.
    pub cap: Option<u32>,
    pub minted: u32,
    /// Copies sitting in opened, unminted packs.
    pub held: u32,
}

#[near]
impl Contract {
    /// Supply of each rarity for one design, e.g. `figure:alexander` or `npc:letters.teach`.
    pub fn rarity_supply(&self, design: String) -> Vec<RaritySupply> {
        (0..RARITY_CAPS.len() as u8)
            .map(|rarity| RaritySupply {
                rarity,
                cap: cap_of(rarity),
                minted: read_count(&minted_key(&design, rarity)),
                held: read_count(&held_key(&design, rarity)),
            })
            .collect()
    }
}

impl Contract {
    /// True while this design can still take a copy of this rarity.
    pub(crate) fn rarity_open(&self, design: &str, rarity: u8) -> bool {
        match cap_of(rarity) {
            None => true,
            Some(cap) => read_count(&minted_key(design, rarity)) + read_count(&held_key(design, rarity)) < cap,
        }
    }
    /// The rarity odds with sold-out tiers removed for one fixed design (crate::card_art checks each rarity's own card).
    #[cfg(test)]
    pub(crate) fn open_rarity_weights(&self, design: &str, weights: [u64; 5]) -> [u64; 5] {
        let mut open = weights;
        for (rarity, weight) in open.iter_mut().enumerate() {
            if !self.rarity_open(design, rarity as u8) {
                *weight = 0;
            }
        }
        open
    }
    pub(crate) fn hold_rarity(&self, design: &str, rarity: u8) {
        if cap_of(rarity).is_some() {
            let key = held_key(design, rarity);
            write_count(&key, read_count(&key) + 1);
        }
    }
    pub(crate) fn release_rarity(&self, design: &str, rarity: u8) {
        if cap_of(rarity).is_some() {
            let key = held_key(design, rarity);
            write_count(&key, read_count(&key).checked_sub(1).expect("held rarity"));
        }
    }
    /// Counts one minted copy of every rarity (capped or not) and returns its serial within the design.
    pub(crate) fn count_minted_rarity(&self, design: &str, rarity: u8) -> u32 {
        let key = minted_key(design, rarity);
        let serial = read_count(&key) + 1;
        write_count(&key, serial);
        serial
    }
    pub(crate) fn minted_count(&self, design: &str, rarity: u8) -> u32 {
        read_count(&minted_key(design, rarity))
    }
}
