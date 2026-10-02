use crate::constants::*;
use anchor_lang::prelude::*;

/// Program parameters (architecture 4.1). The admin can tune fees within caps and pause new
/// parties; nothing here can move a vault.
#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    /// The 6-decimal test token (kUSD) or devnet USDC.
    pub mint: Pubkey,
    /// Token account that receives the Kitty fee.
    pub treasury: Pubkey,
    pub protocol_bps: u16,
    pub cover_bps: u16,
    pub late_bps: u16,
    pub max_host_bps: u16,
    /// Shortest grace a party may use (devnet demo parties use minutes, not 72 hours).
    pub min_grace_secs: i64,
    /// How long after a round is due before it can be settled (the Butler collects in between).
    pub collect_window_secs: i64,
    /// Allowed gap between a proof's `now` and the Solana clock (T7).
    pub now_tolerance_secs: i64,
    /// Starter kitty limit (product doc 11.1).
    pub allowance: u64,
    /// Anon Aadhaar RSA public-key hash this deployment accepts (the test key on devnet).
    pub aadhaar_pubkey_hash: [u8; 32],
    /// Kitty's Anon Aadhaar nullifier seed (app id).
    pub nullifier_seed: u64,
    pub next_party_id: u64,
    /// Devnet only: the admin may register test identities without an Aadhaar proof (harness bots).
    pub dev_register: bool,
    pub paused: bool,
    pub bump: u8,
}

/// The Kitty tree: an append-only Poseidon Merkle tree of notes, receipts and completion leaves,
/// with the last 64 roots (architecture 4.1, 7.3).
#[account(zero_copy)]
pub struct KittyTree {
    pub next_index: u64,
    pub root_index: u64,
    pub filled: [[u8; 32]; DEPTH],
    pub zeros: [[u8; 32]; DEPTH + 1],
    pub roots: [[u8; 32]; ROOT_RING],
}

/// Existence is the check (registration nullifiers and spent note nullifiers).
#[account]
#[derive(InitSpace)]
pub struct Marker {
    pub bump: u8,
}

/// One guest, inside the party account. Guests are known only by their party tag.
#[zero_copy]
#[derive(Default)]
pub struct Member {
    /// Keepsafe still held for this guest (released with each later chip-in).
    pub keepsafe: u64,
    /// Keepsafe at the moment they took the kitty.
    pub keepsafe_total: u64,
    /// Remaining obligation R = c(N − s) when they took the kitty.
    pub remaining: u64,
    /// Plus-one stakes behind this guest, and how much of them the waterfall used.
    pub vouched: u64,
    pub vouch_slashed: u64,
    /// Chip-ins the House Fund fronted while this guest is in grace.
    pub advance: u64,
    /// What the House Fund covered after a default (repaid by settling up).
    pub debt: u64,
    /// Chip-ins the House Fund paid for a removed guest's seat.
    pub house_paid: u64,
    pub grace_deadline: i64,
    pub tag: [u8; 32],
    pub wallet: Pubkey,
    pub tier: u8,
    pub is_host: u8,
    /// Earliest night this guest may take the kitty (Draw), or their night (seating plan).
    pub seat: u8,
    /// The night they took the kitty, 0 if not yet.
    pub took_night: u8,
    /// Rounds covered (by the guest, the waterfall or the House Fund for a removed seat).
    pub paid_through: u8,
    /// Rounds the guest paid themselves.
    pub own_paid: u8,
    pub status: u8,
    pub late_count: u8,
    pub missed_nights: u8,
    pub gate_relaxed: u8,
    pub farewelled: u8,
    pub _pad: [u8; 5],
}

/// A party (architecture 4.1). Fixed size, zero-copy.
#[account(zero_copy)]
pub struct Party {
    pub id: u64,
    pub chip_in: u64,
    /// The House Fund cover this party adds while active.
    pub exposure: u64,
    pub allowance: u64,
    pub unlocked_by_tier: [u64; 3],
    pub period_secs: i64,
    pub grace_secs: i64,
    pub start_ts: i64,
    pub formation_deadline: i64,
    pub created_ts: i64,
    pub host_wallet: Pubkey,
    pub invite_key: Pubkey,
    pub vault: Pubkey,
    pub draw_seed: [u8; 32],
    pub host_fee_bps: u16,
    pub guests: u8,
    pub mode: u8,
    pub min_tier: u8,
    pub status: u8,
    /// Rounds settled so far.
    pub current_round: u8,
    pub joined: u8,
    pub draw_round: u8,
    pub draw_winner: u8,
    pub draw_relaxed: u8,
    pub bump: u8,
    pub vault_bump: u8,
    pub _pad: [u8; 3],
    pub members: [Member; MAX_GUESTS],
}

impl Party {
    /// When round `r` (1-based) is due.
    pub fn due_ts(&self, r: u8) -> i64 {
        self.start_ts + (r as i64 - 1) * self.period_secs
    }
    pub fn find_tag(&self, tag: &[u8; 32]) -> Option<usize> {
        self.members[..self.joined as usize].iter().position(|m| &m.tag == tag)
    }
    pub fn find_wallet(&self, wallet: &Pubkey) -> Option<usize> {
        self.members[..self.joined as usize].iter().position(|m| &m.wallet == wallet)
    }
    pub fn per_round_total(&self, cfg: &Config) -> u64 {
        let (k, h) = crate::math::fees(self.chip_in, cfg);
        self.chip_in + k + h
    }
}

#[account]
#[derive(InitSpace)]
pub struct HouseFund {
    pub total_shares: u64,
    pub fees_in: u64,
    pub paid_out: u64,
    /// Σ exposure of active parties.
    pub exposure: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HouseShare {
    pub owner: Pubkey,
    pub shares: u64,
    pub bump: u8,
}

/// A plus-one stake behind one guest.
#[account]
#[derive(InitSpace)]
pub struct VouchStake {
    pub party: Pubkey,
    pub voucher: Pubkey,
    pub member_idx: u8,
    pub amount: u64,
    pub bump: u8,
}
