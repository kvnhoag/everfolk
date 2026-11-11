//! Minimal in-game market. Unlike external NEP-199 marketplaces, it pays every source of the token.
use crate::shares::bps_of;
use crate::{Contract, ContractExt};
use near_contract_standards::non_fungible_token::events::NftTransfer;
use near_sdk::json_types::U128;
use near_sdk::{assert_one_yocto, env, near, require, AccountId, NearToken, Promise};

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Listing {
    pub token_id: String,
    pub seller_id: AccountId,
    pub price: U128,
}

#[near]
impl Contract {
    /// Requires 1 yoctoNEAR so a function-call access key alone can't put a token up for sale.
    #[payable]
    pub fn list(&mut self, token_id: String, price: U128) {
        assert_one_yocto();
        let seller = self.assert_token_owner(&token_id);
        require!(price.0 > 0, "Price must be above zero");
        self.listings.insert(token_id.clone(), Listing { token_id, seller_id: seller, price });
    }

    pub fn unlist(&mut self, token_id: String) {
        self.assert_token_owner(&token_id);
        self.listings.remove(&token_id);
    }

    /// Buys a listed token. Returns what the seller receives after source and treasury royalties.
    #[payable]
    pub fn buy(&mut self, token_id: String) -> U128 {
        let listing = self.listings.get(&token_id).cloned().unwrap_or_else(|| env::panic_str("This token is not for sale"));
        let buyer = env::predecessor_account_id();
        require!(buyer != listing.seller_id, "You already own this token");
        let price = listing.price.0;
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= price, "Attach at least the listing price");

        let shares = self.sources_of(token_id.clone());
        let to_sources = self.credit_sources(&shares, bps_of(price, self.params.royalty_sources_bps));
        let to_treasury = bps_of(price, self.params.royalty_treasury_bps) + bps_of(price, self.params.royalty_sources_bps) - to_sources;
        let treasury = self.treasury_id.clone();
        self.credit(&treasury, to_treasury);

        self.listings.remove(&token_id);
        self.nft.internal_transfer(&listing.seller_id, &buyer, &token_id, None, None);
        NftTransfer { old_owner_id: &listing.seller_id, new_owner_id: &buyer, token_ids: &[&token_id], authorized_id: None, memo: None }.emit();

        let proceeds = price - to_sources - to_treasury;
        Promise::new(listing.seller_id).transfer(NearToken::from_yoctonear(proceeds)).detach();
        if deposit > price {
            Promise::new(buyer).transfer(NearToken::from_yoctonear(deposit - price)).detach();
        }
        U128(proceeds)
    }

    pub fn listing(&self, token_id: String) -> Option<Listing> {
        self.listings.get(&token_id).cloned()
    }

    pub fn listings(&self, from_index: u32, limit: u32) -> Vec<Listing> {
        self.listings.values().skip(from_index as usize).take(limit.min(100) as usize).cloned().collect()
    }
}

impl Contract {
    pub(crate) fn assert_token_owner(&self, token_id: &str) -> AccountId {
        let owner = self.nft.owner_by_id.get(&token_id.to_string()).unwrap_or_else(|| env::panic_str("Token not found"));
        require!(env::predecessor_account_id() == owner, "Only the token's owner can do this");
        owner
    }
}
