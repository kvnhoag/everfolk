use crate::types::{TokenExtra, TokenKind};
use crate::{Contract, ContractExt};
use near_sdk::{env, near, require, serde_json};

#[near]
impl Contract {
    /// Changes what this token does to the world. Lives already started keep the action they were born with.
    pub fn set_action(&mut self, token_id: String, action_id: String) {
        let owner = self.nft.owner_by_id.get(&token_id).unwrap_or_else(|| env::panic_str("Token not found"));
        require!(env::predecessor_account_id() == owner, "Only the token's owner can do this");
        let mut record = self.record(&token_id).clone();
        let new_category = match record.kind {
            TokenKind::Figure => {
                let figure = record.figure_id.as_deref().unwrap_or_default();
                let menu = self.catalog.figures.iter().find(|f| f.figure_id == figure).map(|f| f.action_ids.clone()).unwrap_or_default();
                require!(menu.contains(&action_id), "This action is not on this token's menu");
                None
            }
            TokenKind::Npc => {
                let group = self.catalog.npc_actions.iter().find(|a| a.action_id == record.action_id).map(|a| a.career_group.clone());
                let next = self.catalog.npc_actions.iter().find(|a| a.action_id == action_id && Some(&a.career_group) == group.as_ref());
                let next = next.unwrap_or_else(|| env::panic_str("This action is not on this token's menu"));
                Some(next.category.clone())
            }
        };
        if new_category.is_some() && new_category != record.category {
            self.remove_from_pool(&token_id, record.category.as_deref().unwrap_or_default());
            record.category = new_category;
            self.add_to_pool(&token_id, &record);
        }
        record.action_id = action_id.clone();
        self.records.insert(token_id.clone(), record);
        self.update_extra(&token_id, |extra| extra.action_id = action_id);
    }

    /// (minted copies, supply cap) for a figure.
    pub fn figure_supply(&self, figure_id: String) -> (u32, u32) {
        self.supply(&figure_id)
    }
}

impl Contract {
    fn remove_from_pool(&mut self, token_id: &str, category: &str) {
        if let Some(members) = self.npc_pools.get(category).cloned() {
            self.npc_pools.insert(category.to_string(), members.into_iter().filter(|id| id != token_id).collect());
        }
    }

    /// Rewrites the token's on-chain `extra` JSON; tokens without game extra (fixtures) are left alone.
    pub(crate) fn update_extra(&mut self, token_id: &str, change: impl FnOnce(&mut TokenExtra)) {
        let Some(by_id) = self.nft.token_metadata_by_id.as_mut() else { return };
        let key = token_id.to_string();
        let Some(mut metadata) = by_id.get(&key) else { return };
        let Some(mut extra) = metadata.extra.as_deref().and_then(|e| serde_json::from_str::<TokenExtra>(e).ok()) else { return };
        change(&mut extra);
        metadata.extra = Some(serde_json::to_string(&extra).expect("extra json"));
        metadata.updated_at = Some(env::block_timestamp_ms().to_string());
        by_id.insert(&key, &metadata);
    }
}
