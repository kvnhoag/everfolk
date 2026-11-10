use crate::types::MAX_BPS;
use near_sdk::near;
use std::collections::BTreeMap;

/// Gas-safety cap on how many sources one token pays.
pub const MAX_SOURCES: usize = 64;

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Share {
    pub token_id: String,
    pub bps: u16,
}

/// Splits 10000 bps across sources in proportion to their impact on one life.
/// Order: impact descending, then token id. Beyond MAX_SOURCES the smallest tail is cut and its share
/// stays unassigned (the caller sends it to treasury); otherwise largest-remainder rounding makes the sum exactly 10000.
pub fn compute_shares(impacts: &[(String, u64)]) -> Vec<Share> {
    let mut merged: BTreeMap<&str, u128> = BTreeMap::new();
    for (token_id, impact) in impacts {
        *merged.entry(token_id.as_str()).or_default() += *impact as u128;
    }
    let mut ranked: Vec<(&str, u128)> = merged.into_iter().filter(|(_, impact)| *impact > 0).collect();
    ranked.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
    let total: u128 = ranked.iter().map(|(_, impact)| impact).sum();
    if total == 0 {
        return Vec::new();
    }
    let cut = ranked.len() > MAX_SOURCES;
    ranked.truncate(MAX_SOURCES);
    let scale = MAX_BPS as u128;
    let mut shares: Vec<(Share, u128)> = ranked
        .iter()
        .map(|(id, impact)| (Share { token_id: id.to_string(), bps: (impact * scale / total) as u16 }, impact * scale % total))
        .collect();
    if !cut {
        let assigned: u128 = shares.iter().map(|(s, _)| s.bps as u128).sum();
        let mut by_remainder: Vec<usize> = (0..shares.len()).collect();
        by_remainder.sort_by(|a, b| shares[*b].1.cmp(&shares[*a].1).then(shares[*a].0.token_id.cmp(&shares[*b].0.token_id)));
        for index in by_remainder.into_iter().take((scale - assigned) as usize) {
            shares[index].0.bps += 1;
        }
    }
    shares.into_iter().map(|(share, _)| share).collect()
}

/// `amount × bps / 10000`, rounded down, without overflowing at yocto scale.
pub fn bps_of(amount: u128, bps: u16) -> u128 {
    let scale = MAX_BPS as u128;
    amount / scale * bps as u128 + amount % scale * bps as u128 / scale
}

/// Per-token amounts for `amount` split by `shares`, plus the undistributed remainder.
pub fn split_amount(amount: u128, shares: &[Share]) -> (Vec<(String, u128)>, u128) {
    let parts: Vec<(String, u128)> =
        shares.iter().map(|s| (s.token_id.clone(), bps_of(amount, s.bps))).collect();
    let paid: u128 = parts.iter().map(|(_, n)| n).sum();
    (parts, amount - paid)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn impacts(list: &[(&str, u64)]) -> Vec<(String, u64)> {
        list.iter().map(|(id, n)| (id.to_string(), *n)).collect()
    }

    fn bps(shares: &[Share]) -> Vec<(&str, u16)> {
        shares.iter().map(|s| (s.token_id.as_str(), s.bps)).collect()
    }

    #[test]
    fn single_source_gets_all() {
        assert_eq!(bps(&compute_shares(&impacts(&[("7", 5)]))), vec![("7", 10_000)]);
    }

    #[test]
    fn no_sources_or_zero_impact_gives_no_shares() {
        assert!(compute_shares(&[]).is_empty());
        assert!(compute_shares(&impacts(&[("1", 0), ("2", 0)])).is_empty());
        assert_eq!(bps(&compute_shares(&impacts(&[("1", 0), ("2", 4)]))), vec![("2", 10_000)]);
    }

    #[test]
    fn largest_remainder_sums_to_10000() {
        let shares = compute_shares(&impacts(&[("c", 1), ("a", 1), ("b", 1)]));
        assert_eq!(bps(&shares), vec![("a", 3334), ("b", 3333), ("c", 3333)]);
        assert_eq!(shares.iter().map(|s| s.bps as u32).sum::<u32>(), 10_000);
    }

    #[test]
    fn proportional_to_impact() {
        assert_eq!(bps(&compute_shares(&impacts(&[("b", 10_000), ("a", 30_000)]))), vec![("a", 7500), ("b", 2500)]);
    }

    #[test]
    fn duplicates_merge() {
        assert_eq!(bps(&compute_shares(&impacts(&[("a", 1), ("b", 2), ("a", 1)]))), vec![("a", 5000), ("b", 5000)]);
    }

    #[test]
    fn cap_at_64_sends_tail_to_treasury() {
        let many: Vec<(String, u64)> = (0..70).map(|i| (format!("{i:03}"), 10)).collect();
        let shares = compute_shares(&many);
        assert_eq!(shares.len(), MAX_SOURCES);
        let total: u32 = shares.iter().map(|s| s.bps as u32).sum();
        assert!(total < 10_000, "kept shares must leave the tail for treasury, got {total}");
        assert_eq!(shares[0].token_id, "000");
    }

    #[test]
    fn cap_keeps_the_highest_impact_sources() {
        let mut many: Vec<(String, u64)> = (0..70).map(|i| (format!("{i:03}"), 10)).collect();
        many.push(("big".into(), 1_000));
        let shares = compute_shares(&many);
        assert_eq!(shares[0].token_id, "big");
        assert_eq!(shares.len(), MAX_SOURCES);
    }

    #[test]
    fn split_amount_dust() {
        let shares = compute_shares(&impacts(&[("a", 1), ("b", 1), ("c", 1)]));
        let (parts, dust) = split_amount(1, &shares);
        assert_eq!(parts.iter().map(|(_, n)| *n).sum::<u128>(), 0);
        assert_eq!(dust, 1);
        let (parts, dust) = split_amount(1_000_000, &shares);
        assert_eq!(parts, vec![("a".to_string(), 333_400), ("b".to_string(), 333_300), ("c".to_string(), 333_300)]);
        assert_eq!(dust, 0);
    }

    #[test]
    fn split_amount_handles_yocto_scale() {
        let shares = compute_shares(&impacts(&[("a", 3), ("b", 1)]));
        let half_near: u128 = 500_000_000_000_000_000_000_000;
        let (parts, dust) = split_amount(half_near, &shares);
        assert_eq!(parts[0].1, 375_000_000_000_000_000_000_000);
        assert_eq!(parts[1].1, 125_000_000_000_000_000_000_000);
        assert_eq!(dust, 0);
    }
}
