//! Proof verification, Poseidon and the params hashes (architecture 5). Must match
//! circuits/lib/kitty.mjs exactly; circuits/vectors/parity.json pins both.
use crate::{constants::*, error::KittyError, vk};
use anchor_lang::prelude::*;
use groth16_solana::groth16::Groth16Verifier;
use solana_poseidon::{hashv, Endianness, Parameters};

/// A Groth16 proof in groth16-solana layout (A negated; G2 as c1‖c0).
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Proof {
    pub a: [u8; 64],
    pub b: [u8; 128],
    pub c: [u8; 64],
}

pub fn fe(v: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[24..].copy_from_slice(&v.to_be_bytes());
    out
}

pub fn poseidon(inputs: &[&[u8]]) -> Result<[u8; 32]> {
    Ok(hashv(Parameters::Bn254X5, Endianness::BigEndian, inputs)
        .map_err(|_| error!(KittyError::BadFieldElement))?
        .to_bytes())
}

/// A wallet key as two 128-bit field elements (big-endian halves).
pub fn wallet_split(wallet: &Pubkey) -> ([u8; 32], [u8; 32]) {
    let b = wallet.to_bytes();
    let (mut hi, mut lo) = ([0u8; 32], [0u8; 32]);
    hi[16..].copy_from_slice(&b[..16]);
    lo[16..].copy_from_slice(&b[16..]);
    (hi, lo)
}

pub fn receipt_leaf(tag: &[u8; 32], party: u64, paid_through: u8) -> Result<[u8; 32]> {
    poseidon(&[&fe(DOMAIN_RECEIPT), tag, &fe(party), &fe(paid_through as u64)])
}

pub fn completion_leaf(tag: &[u8; 32], party: u64, paid_rounds: u8, late_count: u8, chip_in: u64) -> Result<[u8; 32]> {
    let summary = poseidon(&[&fe(paid_rounds as u64), &fe(late_count as u64), &fe(chip_in)])?;
    poseidon(&[&fe(DOMAIN_COMPLETION), tag, &fe(party), &summary])
}

pub struct JoinParams {
    pub grace: u64,
    pub party: u64,
    pub start: u64,
    pub period: u64,
    pub rounds: u64,
    pub unlocked_by_tier: [u64; 3],
    pub min_tier: u64,
    pub allowance: u64,
}

pub fn params_join(p: &JoinParams, wallet: &Pubkey) -> Result<[u8; 32]> {
    let (hi, lo) = wallet_split(wallet);
    let u = p.unlocked_by_tier;
    poseidon(&[
        &fe(p.grace),
        &fe(p.party),
        &fe(p.start),
        &fe(p.period),
        &fe(p.rounds),
        &fe(u[0]),
        &fe(u[1]),
        &fe(u[2]),
        &fe(p.min_tier),
        &fe(p.allowance),
        &hi,
        &lo,
    ])
}

pub fn params_complete(party: u64, chip_in: u64, rounds: u64, wallet: &Pubkey) -> Result<[u8; 32]> {
    let (hi, lo) = wallet_split(wallet);
    poseidon(&[&fe(party), &fe(chip_in), &fe(rounds), &hi, &lo])
}

pub fn params_history(min_completed: u64, min_paid: u64, max_late: u64, scope: &[u8; 32], challenge: &[u8; 32]) -> Result<[u8; 32]> {
    poseidon(&[&fe(min_completed), &fe(min_paid), &fe(max_late), scope, challenge])
}

/// Public signals of the action circuit, in circuit order.
pub struct ActionSignals {
    pub nullifier: [u8; 32],
    pub out_commitment: [u8; 32],
    pub out_tag: [u8; 32],
    pub out_claim: u64,
    pub root: [u8; 32],
    pub now: i64,
    pub params_hash: [u8; 32],
    pub mode: u64,
}

pub fn verify_action(proof: &Proof, s: &ActionSignals) -> Result<()> {
    require!(s.now >= 0, KittyError::BadClock);
    let inputs: [[u8; 32]; 8] = [
        s.nullifier,
        s.out_commitment,
        s.out_tag,
        fe(s.out_claim),
        s.root,
        fe(s.now as u64),
        s.params_hash,
        fe(s.mode),
    ];
    let mut v = Groth16Verifier::<8>::new(&proof.a, &proof.b, &proof.c, &inputs, &vk::VK_KITTY_ACTION)
        .map_err(|_| error!(KittyError::InvalidProof))?;
    v.verify().map_err(|_| error!(KittyError::InvalidProof))
}

/// Anon Aadhaar v2 public signals: pubkeyHash, nullifier, timestamp, ageAbove18, gender, pinCode,
/// state, nullifierSeed, signalHash. Kitty reveals nothing, so the four reveal outputs are 0.
pub fn verify_aadhaar(proof: &Proof, pubkey_hash: &[u8; 32], nullifier: &[u8; 32], timestamp: u64, nullifier_seed: u64, signal_hash: &[u8; 32]) -> Result<()> {
    let z = [0u8; 32];
    let inputs: [[u8; 32]; 9] = [*pubkey_hash, *nullifier, fe(timestamp), z, z, z, z, fe(nullifier_seed), *signal_hash];
    let mut v = Groth16Verifier::<9>::new(&proof.a, &proof.b, &proof.c, &inputs, &vk::VK_AADHAAR)
        .map_err(|_| error!(KittyError::InvalidProof))?;
    v.verify().map_err(|_| error!(KittyError::InvalidProof))
}

/// Anon Aadhaar's `hash()`: keccak256 of the 32-byte big-endian value, shifted right by 3 bits.
/// Binds the registration proof to the member's first note commitment.
pub fn aadhaar_signal_hash(first_commitment: &[u8; 32]) -> [u8; 32] {
    let h = solana_keccak_hasher::hash(first_commitment).to_bytes();
    let mut out = [0u8; 32];
    let mut carry = 0u8;
    for i in 0..32 {
        out[i] = (h[i] >> 3) | carry;
        carry = h[i] << 5;
    }
    out
}
