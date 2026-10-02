//! Events: the indexer's contract (architecture 4.3).
use anchor_lang::prelude::*;

#[event]
pub struct LeafAppended {
    pub index: u64,
    pub leaf: [u8; 32],
    /// 1 note, 2 receipt, 3 completion
    pub kind: u8,
    pub root: [u8; 32],
}

#[event]
pub struct Registered {
    pub nullifier: [u8; 32],
    pub leaf_index: u64,
    pub dev: bool,
}

#[event]
pub struct PartyCreated {
    pub party: u64,
    pub host_wallet: Pubkey,
    pub chip_in: u64,
    pub guests: u8,
    pub period_secs: i64,
    pub grace_secs: i64,
    pub start_ts: i64,
    pub formation_deadline: i64,
    pub mode: u8,
    pub host_fee_bps: u16,
    pub min_tier: u8,
}

#[event]
pub struct PartyUpdated {
    pub party: u64,
    /// 0 forming, 1 active, 2 finished, 3 cancelled
    pub status: u8,
    pub current_round: u8,
}

#[event]
pub struct MemberJoined {
    pub party: u64,
    pub member_idx: u8,
    pub tag: [u8; 32],
    pub wallet: Pubkey,
    pub tier: u8,
    pub seat: u8,
    pub gate_relaxed: bool,
    pub is_host: bool,
}

#[event]
pub struct ChipIn {
    pub party: u64,
    pub member_idx: u8,
    /// Rounds now covered.
    pub paid_through: u8,
    pub rounds: u8,
    pub amount: u64,
    pub late: bool,
    pub keepsafe_released: u64,
    pub by_butler: bool,
}

#[event]
pub struct DrawRequested {
    pub party: u64,
    pub round: u8,
    pub seed: [u8; 32],
}

#[event]
pub struct DrawResolved {
    pub party: u64,
    pub round: u8,
    pub winner_idx: u8,
    pub eligible: u8,
    pub gate_relaxed: bool,
}

#[event]
pub struct RoundSettled {
    pub party: u64,
    pub round: u8,
    pub winner_idx: u8,
    pub kitty: u64,
    pub paid_now: u64,
    pub keepsafe: u64,
    pub host_fee: u64,
    /// Chip-ins the House Fund fronted for guests in grace (or paid for a removed seat).
    pub house_fronted: u64,
    pub to_house: bool,
}

#[event]
pub struct Defaulted {
    pub party: u64,
    pub member_idx: u8,
    pub missed: u64,
    pub from_keepsafe: u64,
    pub from_plus_ones: u64,
    pub from_house: u64,
    /// A guest who had not taken the kitty is removed and the House Fund takes the seat.
    pub removed: bool,
}

#[event]
pub struct SettledUp {
    pub party: u64,
    pub member_idx: u8,
    pub amount: u64,
}

#[event]
pub struct Farewell {
    pub party: u64,
    pub member_idx: u8,
    pub paid_rounds: u8,
    pub late_count: u8,
    pub payout: u64,
}

#[event]
pub struct NoteUpdated {
    pub party: u64,
    pub member_idx: u8,
}

#[event]
pub struct Vouched {
    pub party: u64,
    pub member_idx: u8,
    pub amount: u64,
    pub total: u64,
}

#[event]
pub struct HistoryVerified {
    pub pseudonym: [u8; 32],
    pub scope: [u8; 32],
    pub challenge: [u8; 32],
    pub min_completed: u64,
    pub min_paid: u64,
    pub max_late: u64,
}

#[event]
pub struct HouseFlow {
    /// 0 fee in, 1 cover out, 2 settle in, 3 late fee, 4 deposit, 5 withdraw, 6 seat payout, 7 reimbursed
    pub kind: u8,
    pub amount: u64,
    pub balance: u64,
    pub party: u64,
}
