//! Read-only views the client uses to show who can reach a life.
use crate::{Contract, ContractExt};
use near_sdk::near;

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq)]
pub struct PoolEntry {
    pub token_id: String,
    pub affection: u8,
    pub rarity: u8,
    pub action_id: String,
}

#[near]
impl Contract {
    /// NPC tokens that can be drawn at key decisions of this category.
    pub fn active_pool(&self, category: String) -> Vec<PoolEntry> {
        self.entries(self.npc_pools.get(&category).cloned().unwrap_or_default())
    }

    /// Every minted copy of a figure; one is picked per life by affection share.
    pub fn figure_copies(&self, figure_id: String) -> Vec<PoolEntry> {
        self.entries(self.figure_copies.get(&figure_id).cloned().unwrap_or_default())
    }
}

impl Contract {
    fn entries(&self, token_ids: Vec<String>) -> Vec<PoolEntry> {
        token_ids
            .into_iter()
            .map(|token_id| {
                let record = self.record(&token_id);
                PoolEntry { affection: record.affection, rarity: record.rarity, action_id: record.action_id.clone(), token_id }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use crate::test_utils::*;

    #[test]
    fn active_pool_lists_npcs_by_category() {
        let mut c = fresh();
        c.set_catalog(sample_catalog());
        let teacher = seed_npc(&mut c, "letters", "education", "letters.teach", 40, 1);
        seed_npc(&mut c, "military", "war", "military.mentor", 10, 0);
        let pool = c.active_pool("education".into());
        assert_eq!(pool, vec![PoolEntry { token_id: teacher, affection: 40, rarity: 1, action_id: "letters.teach".into() }]);
        assert!(c.active_pool("fate".into()).is_empty());
    }

    #[test]
    fn figure_copies_lists_every_copy() {
        let mut c = fresh();
        c.set_catalog(sample_catalog());
        let a = seed_figure(&mut c, "euclid", 5, 2);
        let b = seed_figure(&mut c, "euclid", 9, 3);
        let copies = c.figure_copies("euclid".into());
        assert_eq!(copies.iter().map(|p| (p.token_id.clone(), p.affection)).collect::<Vec<_>>(), vec![(a, 5), (b, 9)]);
        assert!(c.figure_copies("alexander".into()).is_empty());
    }

    use super::PoolEntry;
}
