use anchor_lang::prelude::*;

/// Kitty tree depth and root history (architecture 4.4).
pub const DEPTH: usize = 26;
pub const ROOT_RING: usize = 64;
/// Party size bounds (product doc 7.1).
pub const MIN_GUESTS: u8 = 4;
pub const MAX_GUESTS: usize = 20;

/// Leaf domains (circuits/kitty_action.circom).
pub const DOMAIN_RECEIPT: u64 = 2;
pub const DOMAIN_COMPLETION: u64 = 3;
pub const LEAF_NOTE: u8 = 1;
pub const LEAF_RECEIPT: u8 = 2;
pub const LEAF_COMPLETION: u8 = 3;

/// Action circuit modes.
pub const MODE_JOIN: u64 = 0;
pub const MODE_COMPLETE: u64 = 1;
pub const MODE_HISTORY: u64 = 2;

/// Order modes.
pub const ORDER_DRAW: u8 = 0;
pub const ORDER_SEATING: u8 = 1;

/// Party status.
pub const PARTY_FORMING: u8 = 0;
pub const PARTY_ACTIVE: u8 = 1;
pub const PARTY_FINISHED: u8 = 2;
pub const PARTY_CANCELLED: u8 = 3;

/// Member status.
pub const MEMBER_ACTIVE: u8 = 0;
/// A chip-in is missing; the House Fund fronted it and grace hours are running.
pub const MEMBER_GRACE: u8 = 1;
/// A guest who took the kitty and then defaulted: covered by the waterfall, Diary on hold.
pub const MEMBER_DEFAULTED: u8 = 2;
/// A guest who had not taken the kitty and defaulted: removed, the House Fund takes the seat.
pub const MEMBER_REMOVED: u8 = 3;
/// A defaulted guest who settled up.
pub const MEMBER_SETTLED: u8 = 4;

pub const NO_WINNER: u8 = u8::MAX;

/// Basis points.
pub const BPS: u64 = 10_000;
/// Trust credit τ by tier (product doc 8.1).
pub const TRUST_CREDIT_BPS: [u64; 3] = [2_500, 5_000, 7_500];
/// The House Fund covers at most 20% of a party's total chip-ins (product doc 9.3); this is the
/// exposure each active party adds.
pub const EXPOSURE_BPS: u64 = 2_000;
/// The House Fund must hold at least 10% of the exposure of all active parties.
pub const RESERVE_BPS: u64 = 1_000;
/// Refund penalty for a removed guest (product doc 7.7).
pub const REMOVAL_PENALTY_BPS: u64 = 500;

/// ORAO VRF (same id on devnet and mainnet).
pub const ORAO_VRF_ID: Pubkey = pubkey!("VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y");
pub const ORAO_RANDOMNESS_SEED: &[u8] = b"orao-vrf-randomness-request";

/// The message an invite key signs to let a party wallet RSVP.
pub const INVITE_DOMAIN: &[u8] = b"kitty-rsvp";

pub const SEED_CONFIG: &[u8] = b"config";
pub const SEED_TREE: &[u8] = b"tree";
pub const SEED_HOUSE: &[u8] = b"house";
pub const SEED_HOUSE_VAULT: &[u8] = b"house_vault";
pub const SEED_PARTY: &[u8] = b"party";
pub const SEED_VAULT: &[u8] = b"vault";
pub const SEED_REG: &[u8] = b"reg";
pub const SEED_NULLIFIER: &[u8] = b"nf";
pub const SEED_VOUCH: &[u8] = b"vouch";
pub const SEED_SHARE: &[u8] = b"lp";
