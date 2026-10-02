//! Money maths (product doc 7.5, 7.7, 9.1). Byte-for-byte the same as
//! `frontend/packages/sdk/src/fees.ts`: integer micro-units, bps rounded half up.
use crate::constants::*;
use crate::state::Config;

/// amount × rate / 10,000, rounded half up (amounts are never negative).
pub fn bps(amount: u64, rate: u64) -> u64 {
    ((amount as u128 * rate as u128 + 5_000) / BPS as u128) as u64
}

/// round(a × b / d) half up.
pub fn mul_div_round(a: u64, b: u64, d: u64) -> u64 {
    if d == 0 {
        return 0;
    }
    ((a as u128 * b as u128 * 2 + d as u128) / (2 * d as u128)) as u64
}

/// Earliest night a tier may take the kitty (product doc 7.3).
pub fn earliest_seat(tier: u8, guests: u8) -> u8 {
    let n = guests as u32;
    match tier {
        2 => 1,
        1 => ((3 * n + 9) / 10 + 1) as u8,
        _ => ((5 * n + 9) / 10 + 1) as u8,
    }
}

/// Trust credit τ in bps; gate relaxation drops it one step.
pub fn trust_bps(tier: u8, relaxed: bool) -> u64 {
    let t = tier.min(2) as i8 - relaxed as i8;
    if t < 0 {
        0
    } else {
        TRUST_CREDIT_BPS[t as usize]
    }
}

/// (Kitty fee, House fee) on top of one chip-in.
pub fn fees(chip_in: u64, cfg: &Config) -> (u64, u64) {
    (bps(chip_in, cfg.protocol_bps as u64), bps(chip_in, cfg.cover_bps as u64))
}

pub fn late_fee(chip_in: u64, cfg: &Config) -> u64 {
    bps(chip_in, cfg.late_bps as u64)
}

/// Worst-case unlocked obligation R·τ if seated at each tier's earliest seat (the circuit's
/// kitty-limit input).
pub fn unlocked_by_tier(chip_in: u64, guests: u8) -> [u64; 3] {
    let mut out = [0u64; 3];
    for t in 0..3u8 {
        let r = chip_in * (guests - earliest_seat(t, guests)) as u64;
        out[t as usize] = bps(r, TRUST_CREDIT_BPS[t as usize]);
    }
    out
}

pub struct Take {
    pub kitty: u64,
    pub host_fee: u64,
    pub remaining: u64,
    pub keepsafe: u64,
    pub paid_now: u64,
}

/// Payout when a guest takes the kitty on `night` (product doc 7.5).
pub fn take(chip_in: u64, guests: u8, night: u8, tier: u8, host_fee_bps: u16, plus_ones: u64, relaxed: bool) -> Take {
    let kitty = guests as u64 * chip_in;
    let host_fee = bps(kitty, host_fee_bps as u64);
    let remaining = chip_in * (guests - night) as u64;
    let tau = trust_bps(tier, relaxed);
    let keepsafe = remaining.saturating_sub(bps(remaining, tau)).saturating_sub(plus_ones);
    Take { kitty, host_fee, remaining, keepsafe, paid_now: kitty - host_fee - keepsafe }
}

/// Keepsafe left after `k` more chip-ins: L(1 − kc/R).
pub fn keepsafe_after(keepsafe_total: u64, remaining: u64, chip_in: u64, k: u64) -> u64 {
    if remaining == 0 {
        return 0;
    }
    let paid = (k * chip_in).min(remaining);
    keepsafe_total - mul_div_round(keepsafe_total, paid, remaining)
}

pub struct Waterfall {
    pub from_keepsafe: u64,
    pub from_plus_ones: u64,
    pub from_house: u64,
}

/// Default waterfall (product doc 7.7): keepsafe → plus-ones → House Fund.
pub fn waterfall(missed: u64, keepsafe_left: u64, plus_ones_left: u64) -> Waterfall {
    let from_keepsafe = missed.min(keepsafe_left);
    let from_plus_ones = (missed - from_keepsafe).min(plus_ones_left);
    Waterfall { from_keepsafe, from_plus_ones, from_house: missed - from_keepsafe - from_plus_ones }
}

#[cfg(test)]
mod tests {
    use super::*;
    const M: u64 = 1_000_000;

    // The worked examples pinned in frontend/packages/sdk/src/fees.test.ts.
    #[test]
    fn act4_tier1_night4() {
        let t = take(100 * M, 10, 4, 1, 100, 0, false);
        assert_eq!(t.kitty, 1_000 * M);
        assert_eq!(t.host_fee, 10 * M);
        assert_eq!(t.keepsafe, 300 * M);
        assert_eq!(t.paid_now, 690 * M);
        assert_eq!(mul_div_round(t.keepsafe, 100 * M, t.remaining), 50 * M);
        assert_eq!(keepsafe_after(t.keepsafe, t.remaining, 100 * M, 1), 250 * M);
    }

    #[test]
    fn tier2_bid_and_plus_one() {
        // Product doc example: slot 1, $80 bid ignored (bids cut), $50 plus-one.
        let t = take(100 * M, 10, 1, 2, 0, 50 * M, false);
        assert_eq!(t.remaining, 900 * M);
        assert_eq!(t.keepsafe, 175 * M);
    }

    #[test]
    fn waterfall_act4() {
        let w = waterfall(500 * M, 250 * M, 0);
        assert_eq!((w.from_keepsafe, w.from_plus_ones, w.from_house), (250 * M, 0, 250 * M));
    }

    #[test]
    fn seats_and_fees() {
        assert_eq!([earliest_seat(0, 10), earliest_seat(1, 10), earliest_seat(2, 10)], [6, 4, 1]);
        assert_eq!(bps(100 * M, 50), 500_000);
        assert_eq!(trust_bps(0, true), 0);
        assert_eq!(trust_bps(2, true), 5_000);
        // circuits/vectors/parity.json unlockedByTier for c = $100, N = 10
        assert_eq!(unlocked_by_tier(100 * M, 10), [100 * M, 300 * M, 675 * M]);
    }
}
