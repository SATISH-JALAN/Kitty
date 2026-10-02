//! The Draw (flow 5): `request_draw` fixes an ORAO seed; the Butler asks ORAO for randomness with
//! that seed; `resolve_draw` reads the fulfilled randomness account and picks tonight's guest.
use crate::{
    constants::*,
    error::KittyError,
    events::{DrawRequested, DrawResolved},
    state::*,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct RequestDraw<'info> {
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
}

pub fn handle_request_draw(ctx: Context<RequestDraw>) -> Result<()> {
    let clock = Clock::get()?;
    let mut p = ctx.accounts.party.load_mut()?;
    require!(p.status == PARTY_ACTIVE, KittyError::NotActive);
    require!(p.mode == ORDER_DRAW, KittyError::NotDrawMode);
    let r = p.current_round + 1;
    require!(clock.unix_timestamp >= p.due_ts(r), KittyError::NotDue);
    require!(p.draw_round != r, KittyError::DrawPending);
    // Unknown until this slot, so nobody can pre-request randomness for a future round.
    let seed = solana_sha256_hasher::hashv(&[b"kitty-draw", &p.id.to_le_bytes(), &[r], &clock.slot.to_le_bytes()]).to_bytes();
    p.draw_seed = seed;
    p.draw_round = r;
    p.draw_winner = NO_WINNER;
    p.draw_relaxed = 0;
    emit!(DrawRequested { party: p.id, round: r, seed });
    Ok(())
}

#[derive(Accounts)]
pub struct ResolveDraw<'info> {
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
    /// CHECK: ORAO's randomness account for the party's seed (owner, address and layout checked).
    pub randomness: UncheckedAccount<'info>,
}

/// ORAO `RandomnessV2`: 8-byte discriminator, enum tag (1 = fulfilled), client, seed, randomness[64].
fn fulfilled_randomness(acc: &AccountInfo, seed: &[u8; 32]) -> Result<[u8; 64]> {
    require_keys_eq!(*acc.owner, ORAO_VRF_ID, KittyError::BadRandomness);
    let (expected, _) = Pubkey::find_program_address(&[ORAO_RANDOMNESS_SEED, seed], &ORAO_VRF_ID);
    require_keys_eq!(acc.key(), expected, KittyError::BadRandomness);
    let d = acc.try_borrow_data()?;
    let disc = solana_sha256_hasher::hash(b"account:RandomnessV2").to_bytes();
    require!(d.len() >= 8 + 1 + 32 + 32 + 64 && d[..8] == disc[..8], KittyError::BadRandomness);
    require!(d[8] == 1, KittyError::RandomnessPending);
    require!(&d[41..73] == seed, KittyError::BadRandomness);
    let mut out = [0u8; 64];
    out.copy_from_slice(&d[73..137]);
    require!(out != [0u8; 64], KittyError::RandomnessPending);
    Ok(out)
}

/// Guests who may take the kitty tonight: haven't taken it, chipped in tonight (or a House
/// seat), and their tier's earliest night has come. If nobody qualifies, the gate opens to every
/// paid-up guest who hasn't taken it (product doc 7.3).
pub fn eligible(p: &Party, r: u8) -> (Vec<u8>, bool) {
    let open = |m: &Member| m.took_night == 0 && ((m.status == MEMBER_ACTIVE && m.paid_through >= r) || m.status == MEMBER_REMOVED);
    let gated: Vec<u8> = (0..p.joined).filter(|&i| open(&p.members[i as usize]) && p.members[i as usize].seat <= r).collect();
    if !gated.is_empty() {
        return (gated, false);
    }
    ((0..p.joined).filter(|&i| open(&p.members[i as usize])).collect(), true)
}

pub fn handle_resolve_draw(ctx: Context<ResolveDraw>) -> Result<()> {
    let mut p = ctx.accounts.party.load_mut()?;
    require!(p.status == PARTY_ACTIVE, KittyError::NotActive);
    let r = p.current_round + 1;
    require!(p.draw_round == r && p.draw_winner == NO_WINNER, KittyError::NoDraw);
    let rand = fulfilled_randomness(&ctx.accounts.randomness, &p.draw_seed)?;
    let (pool, relaxed) = eligible(&p, r);
    require!(!pool.is_empty(), KittyError::NoEligibleGuest);
    let x = u64::from_le_bytes(rand[..8].try_into().unwrap());
    let winner = pool[(x % pool.len() as u64) as usize];
    p.draw_winner = winner;
    p.draw_relaxed = relaxed as u8;
    emit!(DrawResolved { party: p.id, round: r, winner_idx: winner, eligible: pool.len() as u8, gate_relaxed: relaxed });
    Ok(())
}
