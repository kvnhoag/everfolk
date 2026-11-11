//! NEP-171/177/178/181 by delegation to near-contract-standards, plus NEP-199 payouts that include sources.
use crate::shares::{bps_of, split_amount};
use crate::{Contract, ContractExt};
use near_contract_standards::non_fungible_token::approval::NonFungibleTokenApproval;
use near_contract_standards::non_fungible_token::core::{NonFungibleTokenCore, NonFungibleTokenResolver};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::{NFTContractMetadata, NonFungibleTokenMetadataProvider, NFT_METADATA_SPEC};
use near_contract_standards::non_fungible_token::{Token, TokenId};
use near_sdk::json_types::U128;
use near_sdk::{assert_one_yocto, env, near, require, AccountId, Promise, PromiseOrValue};
use std::collections::HashMap;

#[near(serializers = [json])]
pub struct Payout {
    pub payout: HashMap<AccountId, U128>,
}

#[near]
impl NonFungibleTokenCore for Contract {
    #[payable]
    fn nft_transfer(&mut self, receiver_id: AccountId, token_id: TokenId, approval_id: Option<u64>, memo: Option<String>) {
        self.on_transfer(&token_id);
        self.nft.nft_transfer(receiver_id, token_id, approval_id, memo)
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.on_transfer(&token_id);
        self.nft.nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.nft.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for Contract {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.nft.nft_resolve_transfer(previous_owner_id, receiver_id, token_id, approved_account_ids)
    }
}

#[near]
impl NonFungibleTokenApproval for Contract {
    #[payable]
    fn nft_approve(&mut self, token_id: TokenId, account_id: AccountId, msg: Option<String>) -> Option<Promise> {
        self.nft.nft_approve(token_id, account_id, msg)
    }

    #[payable]
    fn nft_revoke(&mut self, token_id: TokenId, account_id: AccountId) {
        self.nft.nft_revoke(token_id, account_id)
    }

    #[payable]
    fn nft_revoke_all(&mut self, token_id: TokenId) {
        self.nft.nft_revoke_all(token_id)
    }

    fn nft_is_approved(&self, token_id: TokenId, approved_account_id: AccountId, approval_id: Option<u64>) -> bool {
        self.nft.nft_is_approved(token_id, approved_account_id, approval_id)
    }
}

#[near]
impl NonFungibleTokenEnumeration for Contract {
    fn nft_total_supply(&self) -> U128 {
        self.nft.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.nft.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.nft.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.nft.nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Contract {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(), // "nft-1.0.0" in near-contract-standards 5.29
            name: "Everfolk Lives".into(),
            symbol: "EVERFOLK".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }
}

#[near]
impl Contract {
    /// NEP-199: how a marketplace should split `balance` when this token sells.
    pub fn nft_payout(&self, token_id: TokenId, balance: U128, max_len_payout: Option<u32>) -> Payout {
        let owner = self.nft.owner_by_id.get(&token_id).unwrap_or_else(|| env::panic_str("Token not found"));
        Payout { payout: self.compute_payout(&token_id, &owner, balance.0, max_len_payout.unwrap_or(u32::MAX)) }
    }

    /// NEP-199: transfers the token and returns the payout computed against the seller.
    #[payable]
    pub fn nft_transfer_payout(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        balance: U128,
        max_len_payout: Option<u32>,
    ) -> Payout {
        assert_one_yocto();
        let payout = self.nft_payout(token_id.clone(), balance, max_len_payout);
        self.on_transfer(&token_id);
        self.nft.nft_transfer(receiver_id, token_id, approval_id, memo);
        payout
    }
}

impl Contract {
    /// Seller, treasury and the highest-impact sources (current owners) that fit in `max_len`; untaken source shares join treasury.
    pub(crate) fn compute_payout(&self, token_id: &str, seller: &AccountId, balance: u128, max_len: u32) -> HashMap<AccountId, U128> {
        require!(max_len >= 2, "max_len_payout must allow at least the seller and treasury");
        let shares = self.sources.get(token_id).cloned().unwrap_or_default();
        let sources_part = bps_of(balance, self.params.royalty_sources_bps);
        let (parts, _) = split_amount(sources_part, &shares);
        // Marketplaces cap recipients, not tokens: merge by current owner first, then keep the largest owners.
        let mut by_owner: Vec<(AccountId, u128)> = Vec::new();
        for (source, amount) in parts {
            let owner = self.nft.owner_by_id.get(&source).unwrap_or_else(|| env::panic_str("Token not found"));
            match by_owner.iter_mut().find(|(account, _)| *account == owner) {
                Some((_, total)) => *total += amount,
                None => by_owner.push((owner, amount)),
            }
        }
        by_owner.sort_by(|a, b| b.1.cmp(&a.1));
        by_owner.truncate((max_len - 2) as usize);
        let mut payout: HashMap<AccountId, u128> = HashMap::new();
        let mut paid_to_sources = 0;
        for (owner, amount) in by_owner {
            *payout.entry(owner).or_default() += amount;
            paid_to_sources += amount;
        }
        let treasury = bps_of(balance, self.params.royalty_treasury_bps) + sources_part - paid_to_sources;
        *payout.entry(self.treasury_id.clone()).or_default() += treasury;
        *payout.entry(seller.clone()).or_default() += balance - paid_to_sources - treasury;
        payout.into_iter().map(|(account, amount)| (account, U128(amount))).collect()
    }

    /// Called before any ownership change: a listing never survives a transfer.
    pub(crate) fn on_transfer(&mut self, token_id: &str) {
        self.listings.remove(token_id);
    }
}
