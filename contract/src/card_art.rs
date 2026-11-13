//! The v14 collection cards an earned NFT can show. scripts/ranked/card-art-table.ts builds the table from the
//! card manifest (every card a life can earn, chain/earned-cards.ts); the contract only looks cards up by id.
//! Stored as JSON under a raw key. A card missing from the table is never minted.
use crate::rarity_caps::RARITY_CAPS;
use crate::{Contract, ContractExt};
use near_sdk::{env, near, require, serde_json};

const KEY: &[u8] = b"everfolk:card-art";
const MAX_CARDS: usize = 512;

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct CardArt {
    pub card_id: String,
    /// The card face's title, used as the NFT title.
    pub title: String,
    /// Absolute https image URL, so wallets and markets can load it.
    pub media: String,
    pub rarity: u8,
    /// Must equal the contract's cap for `rarity`; `None` is unlimited.
    pub edition_limit: Option<u32>,
}

/// What `edition_supply` reports for one card design and rarity, mirroring `EditionSupply` in chain/types.ts.
#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct EditionSupply {
    pub edition_key: String,
    pub rarity: u8,
    pub minted: u32,
    pub edition_limit: Option<u32>,
    /// The serial the next copy would get; `None` once the design is sold out.
    pub next_edition_number: Option<u32>,
}

pub fn is_card_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

fn validate(cards: &[CardArt]) {
    require!(cards.len() <= MAX_CARDS, "Too many cards");
    let mut ids = std::collections::BTreeSet::new();
    for card in cards {
        require!(is_card_id(&card.card_id) && ids.insert(card.card_id.as_str()), "Card ids must be unique lowercase slugs");
        require!(!card.title.is_empty() && card.title.len() <= 96, "A card needs a title of at most 96 bytes");
        require!(card.media.starts_with("https://") && card.media.len() <= 512, "Card images must be absolute https URLs");
        require!((card.rarity as usize) < RARITY_CAPS.len(), "Unknown card rarity");
        require!(card.edition_limit == RARITY_CAPS[card.rarity as usize], "A card's edition limit must equal its rarity cap");
    }
}

pub fn card_by_id<'a>(cards: &'a [CardArt], card_id: &str) -> Option<&'a CardArt> {
    cards.iter().find(|card| card.card_id == card_id)
}

/// The design a card's copies are counted under.
pub fn card_design(card_id: &str) -> String {
    format!("card:{card_id}")
}

/// The edition key the client reads (chain/editions.ts): one design at one rarity, `<design>:rarity:<n>`.
pub fn edition_key(design: &str, rarity: u8) -> String {
    format!("{design}:rarity:{rarity}")
}

/// The design inside an edition key, if the key names this rarity.
pub fn design_of(edition_key: &str, rarity: u8) -> Option<&str> {
    edition_key.strip_suffix(&format!(":rarity:{rarity}")).filter(|design| !design.is_empty())
}

#[near]
impl Contract {
    pub fn set_card_art(&mut self, cards: Vec<CardArt>) {
        self.assert_owner();
        validate(&cards);
        env::storage_write(KEY, &serde_json::to_vec(&cards).expect("card art json"));
    }

    pub fn get_card_art(&self) -> Vec<CardArt> {
        self.card_art()
    }

    /// Minted copies of one card design at one rarity, and the serial the next copy would get.
    pub fn edition_supply(&self, edition_key: String, rarity: u8) -> EditionSupply {
        require!((rarity as usize) < RARITY_CAPS.len(), "Unknown card rarity");
        let design = design_of(&edition_key, rarity).unwrap_or_else(|| env::panic_str("An edition key ends with :rarity:<its rarity>"));
        let minted = self.minted_count(design, rarity);
        let edition_limit = RARITY_CAPS[rarity as usize];
        let open = self.rarity_open(design, rarity);
        EditionSupply { edition_key, rarity, minted, edition_limit, next_edition_number: open.then_some(minted + 1) }
    }
}

impl Contract {
    pub(crate) fn card_art(&self) -> Vec<CardArt> {
        env::storage_read(KEY).map(|bytes| serde_json::from_slice(&bytes).expect("stored card art")).unwrap_or_default()
    }
}
