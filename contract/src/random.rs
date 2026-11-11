use near_sdk::env;

/// Uniform 64-bit draw for one named purpose, so separate rolls from one seed stay independent.
pub fn roll(seed: &[u8; 32], domain: &[u8]) -> u64 {
    let mut input = Vec::with_capacity(32 + domain.len());
    input.extend_from_slice(seed);
    input.extend_from_slice(domain);
    let hash = env::sha256_array(&input);
    u64::from_le_bytes(hash[..8].try_into().expect("8 bytes"))
}

/// Seed derived from the block's validator randomness, bound to one life and a purpose.
pub fn block_seed(life_id: u64, extra: &[u8]) -> [u8; 32] {
    let mut input = env::random_seed_array().to_vec();
    input.extend_from_slice(&life_id.to_le_bytes());
    input.extend_from_slice(extra);
    env::sha256_array(&input)
}

/// Index chosen with probability proportional to its weight; `None` when every weight is zero.
pub fn weighted_pick(weights: &[u64], r: u64) -> Option<usize> {
    let total: u128 = weights.iter().map(|w| *w as u128).sum();
    if total == 0 {
        return None;
    }
    let mut target = r as u128 % total;
    for (index, weight) in weights.iter().enumerate() {
        let weight = *weight as u128;
        if target < weight {
            return Some(index);
        }
        target -= weight;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weighted_pick_respects_weights() {
        for r in [0, 1, 4, 5, 99, u64::MAX] {
            assert_eq!(weighted_pick(&[0, 5, 0], r), Some(1));
        }
        assert_eq!(weighted_pick(&[], 7), None);
        assert_eq!(weighted_pick(&[0, 0], 7), None);
        assert_eq!(weighted_pick(&[1, 1], 0), Some(0));
        assert_eq!(weighted_pick(&[1, 1], 1), Some(1));
    }

    #[test]
    fn weighted_pick_handles_huge_weights() {
        assert_eq!(weighted_pick(&[u64::MAX, u64::MAX], u64::MAX), Some(1));
    }

    #[test]
    fn roll_is_deterministic_per_domain() {
        let seed = [9u8; 32];
        assert_eq!(roll(&seed, b"drop:euclid"), roll(&seed, b"drop:euclid"));
        assert_ne!(roll(&seed, b"drop:euclid"), roll(&seed, b"drop:alexander"));
        assert_ne!(roll(&seed, b"aff"), roll(&[8u8; 32], b"aff"));
    }
}
