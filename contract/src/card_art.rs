//! The v14 collection card each pack card and minted NFT shows. chain/card-art.ts builds the table from the
//! card manifest; the contract only matches it. Stored as JSON under a raw key, so existing deployments
//! upgrade without a Borsh change. With no table, or no match, minting keeps its earlier metadata.
use crate::rarity_caps::{design_key, RARITY_CAPS};
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
    /// A historical figure's main card; `None` for a profession card.
    pub figure_id: Option<String>,
    /// Profession cards match the life's career group and the player's sex.
    pub career_group: Option<String>,
    pub sex: Option<String>,
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

fn is_card_id(id: &str) -> bool {
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
        match &card.figure_id {
            Some(figure) => require!(!figure.is_empty() && card.career_group.is_none() && card.sex.is_none(), "A figure card matches figure and rarity only"),
            None => require!(
                card.career_group.as_deref().is_some_and(|group| !group.is_empty())
                    && matches!(card.sex.as_deref(), Some("male") | Some("female")),
                "A profession card needs a career group and a sex"
            ),
        }
    }
}

/// The card for a figure (by rarity) or a person of the city (by career, rarity and recorded sex).
pub fn card_for<'a>(cards: &'a [CardArt], figure: Option<&str>, rarity: u8, career: &str, sex: Option<&str>) -> Option<&'a CardArt> {
    cards.iter().find(|card| {
        card.rarity == rarity
            && match figure {
                Some(id) => card.figure_id.as_deref() == Some(id),
                None => card.figure_id.is_none() && card.career_group.as_deref() == Some(career) && sex.is_some() && card.sex.as_deref() == sex,
            }
    })
}

/// The design a copy is counted under: `card:<card_id>`, or the earlier figure/deed key when it has no card.
pub fn card_design(cards: &[CardArt], figure: Option<&str>, rarity: u8, career: &str, sex: Option<&str>, npc_action_id: &str) -> String {
    card_for(cards, figure, rarity, career, sex).map(|card| format!("card:{}", card.card_id)).unwrap_or_else(|| design_key(figure, npc_action_id))
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

    /// Rarity odds for one roll, each rarity checked against the card design it would produce.
    pub(crate) fn open_weights_for(&self, cards: &[CardArt], figure: Option<&str>, career: &str, sex: Option<&str>, npc_action_id: &str, weights: [u64; 5]) -> [u64; 5] {
        let mut open = weights;
        for (rarity, weight) in open.iter_mut().enumerate() {
            if !self.rarity_open(&card_design(cards, figure, rarity as u8, career, sex, npc_action_id), rarity as u8) {
                *weight = 0;
            }
        }
        open
    }
}
