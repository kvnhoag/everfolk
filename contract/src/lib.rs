//! Everfolk ranked lives: seeded births, live influence draws, verified mints and source royalties.
mod admin;
mod earnings;
mod lives;
mod market;
mod mint;
mod nft;
mod random;
mod shares;
mod tokens;
mod types;
mod views;

use near_contract_standards::non_fungible_token::NonFungibleToken;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{near, AccountId, BorshStorageKey, NearToken, PanicOnDefault};
use shares::Share;
use types::{CatalogConfig, Life, Params, TokenRecord, TokenStats};

#[near]
#[derive(BorshStorageKey)]
enum StorageKey {
    Lives,
    ActiveLife,
    AbandonedAt,
    Records,
    NpcPools,
    FigureCopies,
    NftOwners,
    NftMetadata,
    NftEnumeration,
    NftApprovals,
    Balances,
    Sources,
    Children,
    Stats,
    Listings,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub(crate) owner_id: AccountId,
    pub(crate) treasury_id: AccountId,
    /// Raw 32-byte ed25519 public keys of trusted life verifiers.
    pub(crate) verifier_keys: Vec<[u8; 32]>,
    pub(crate) params: Params,
    pub(crate) catalog: CatalogConfig,
    pub(crate) world_versions: Vec<String>,
    pub(crate) lives: LookupMap<u64, Life>,
    pub(crate) active_life: LookupMap<AccountId, u64>,
    pub(crate) abandoned_at: LookupMap<AccountId, u64>,
    pub(crate) next_life_id: u64,
    pub(crate) records: LookupMap<String, TokenRecord>,
    /// NPC token ids by influence category.
    pub(crate) npc_pools: LookupMap<String, Vec<String>>,
    /// Figure copy token ids by figure id.
    pub(crate) figure_copies: LookupMap<String, Vec<String>>,
    pub(crate) next_token_id: u64,
    pub(crate) nft: NonFungibleToken,
    /// Withdrawable yoctoNEAR per account (source earnings and treasury).
    pub(crate) balances: LookupMap<AccountId, u128>,
    /// Source shares fixed at mint, per token.
    pub(crate) sources: LookupMap<String, Vec<Share>>,
    /// Reverse index: tokens this token is a source of.
    pub(crate) children: LookupMap<String, Vec<String>>,
    pub(crate) stats: LookupMap<String, TokenStats>,
    pub(crate) listings: IterableMap<String, market::Listing>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, treasury_id: AccountId, verifier_keys: Vec<String>) -> Self {
        Self {
            owner_id: owner_id.clone(),
            treasury_id,
            verifier_keys: admin::parse_verifier_keys(&verifier_keys),
            params: Params {
                mint_fee: NearToken::from_near(1).as_yoctonear().into(),
                drop_rate_bps: 500,
                source_mint_share_bps: 5000,
                royalty_sources_bps: 500,
                royalty_treasury_bps: 500,
                nobody_weight_bps: 5000,
                abandon_cooldown_ms: 600_000,
                evidence_base_url: String::new(),
            },
            catalog: CatalogConfig::default(),
            world_versions: Vec::new(),
            lives: LookupMap::new(StorageKey::Lives),
            active_life: LookupMap::new(StorageKey::ActiveLife),
            abandoned_at: LookupMap::new(StorageKey::AbandonedAt),
            next_life_id: 1,
            records: LookupMap::new(StorageKey::Records),
            npc_pools: LookupMap::new(StorageKey::NpcPools),
            figure_copies: LookupMap::new(StorageKey::FigureCopies),
            next_token_id: 1,
            nft: NonFungibleToken::new(
                StorageKey::NftOwners,
                owner_id.clone(),
                Some(StorageKey::NftMetadata),
                Some(StorageKey::NftEnumeration),
                Some(StorageKey::NftApprovals),
            ),
            balances: LookupMap::new(StorageKey::Balances),
            sources: LookupMap::new(StorageKey::Sources),
            children: LookupMap::new(StorageKey::Children),
            stats: LookupMap::new(StorageKey::Stats),
            listings: IterableMap::new(StorageKey::Listings),
        }
    }
}

#[cfg(test)]
mod test_utils;
#[cfg(test)]
mod tests_admin;
#[cfg(test)]
mod tests_lives;
#[cfg(test)]
mod tests_mint;
#[cfg(test)]
mod tests_nft;
#[cfg(test)]
mod tests_market;
