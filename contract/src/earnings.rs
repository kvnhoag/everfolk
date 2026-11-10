use crate::shares::{bps_of, split_amount, Share};
use crate::types::TokenStats;
use crate::{Contract, ContractExt};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, AccountId, NearToken, Promise};

#[near]
impl Contract {
    /// Pays out everything this account has earned as a source (or as treasury).
    pub fn withdraw(&mut self) -> Promise {
        let account = env::predecessor_account_id();
        let amount = self.balances.remove(&account).unwrap_or(0);
        require!(amount > 0, "Nothing to withdraw");
        Promise::new(account).transfer(NearToken::from_yoctonear(amount))
    }

    pub fn balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.balances.get(&account_id).copied().unwrap_or(0))
    }

    pub fn sources_of(&self, token_id: String) -> Vec<Share> {
        self.sources.get(&token_id).cloned().unwrap_or_default()
    }

    pub fn children_of(&self, token_id: String, from_index: u32, limit: u32) -> Vec<String> {
        let children = self.children.get(&token_id).cloned().unwrap_or_default();
        children.into_iter().skip(from_index as usize).take(limit.min(100) as usize).collect()
    }

    pub fn token_stats(&self, token_id: String) -> TokenStats {
        self.stats.get(&token_id).cloned().unwrap_or_default()
    }
}

impl Contract {
    pub(crate) fn credit(&mut self, account: &AccountId, amount: u128) {
        if amount == 0 {
            return;
        }
        let balance = self.balances.get(account).copied().unwrap_or(0);
        self.balances.insert(account.clone(), balance + amount);
    }

    fn owner_of(&self, token_id: &str) -> AccountId {
        self.nft.owner_by_id.get(&token_id.to_string()).unwrap_or_else(|| env::panic_str("Token not found"))
    }

    /// Records a newly minted token's sources and pays them their part of the mint fee. Returns what they were paid.
    pub(crate) fn pay_sources(&mut self, child: &str, fee: u128, shares: &[Share]) -> u128 {
        self.sources.insert(child.to_string(), shares.to_vec());
        for share in shares {
            let mut stats = self.token_stats(share.token_id.clone());
            stats.lives_influenced += 1;
            self.stats.insert(share.token_id.clone(), stats);
            let mut children = self.children.get(&share.token_id).cloned().unwrap_or_default();
            children.push(child.to_string());
            self.children.insert(share.token_id.clone(), children);
        }
        self.credit_sources(shares, bps_of(fee, self.params.source_mint_share_bps))
    }

    /// Splits `amount` by shares, credits each source token's current owner, and returns what was paid out.
    pub(crate) fn credit_sources(&mut self, shares: &[Share], amount: u128) -> u128 {
        let (parts, _) = split_amount(amount, shares);
        let mut paid = 0;
        for (token_id, part) in parts {
            let owner = self.owner_of(&token_id);
            self.credit(&owner, part);
            paid += part;
            let mut stats = self.token_stats(token_id.clone());
            stats.earned = U128(stats.earned.0 + part);
            self.stats.insert(token_id, stats);
        }
        paid
    }
}
