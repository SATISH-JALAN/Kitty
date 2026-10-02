//! Farewell night (flow 8), the COMPLETE proof that moves the party into the Diary's history,
//! and cancelling a party that never filled.
use crate::{
    constants::*,
    error::KittyError,
    events::{Farewell, NoteUpdated, PartyUpdated},
    ops::{self, Auth},
    state::*,
    zk,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct FarewellAccounts<'info> {
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
    #[account(mut, seeds = [SEED_VAULT, party.key().as_ref()], bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = config.mint)]
    pub member_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Anyone (the Butler) can run Farewell for a guest once the party has ended: it appends their
/// completion leaf and pays back what is still held for them (keepsafe, or every chip-in if the
/// party was cancelled). A defaulted guest must settle up first.
pub fn handle_farewell(ctx: Context<FarewellAccounts>, member_idx: u8) -> Result<()> {
    let i = member_idx as usize;
    let (id, bump, payout, leaf, paid_rounds, late_count);
    {
        let mut p = ctx.accounts.party.load_mut()?;
        require!(p.status == PARTY_FINISHED || p.status == PARTY_CANCELLED, KittyError::NotFinished);
        require!(i < p.joined as usize, KittyError::NotAGuest);
        let (c, n, cancelled, party_id) = (p.chip_in, p.guests, p.status == PARTY_CANCELLED, p.id);
        let m = &mut p.members[i];
        require!(m.farewelled == 0, KittyError::AlreadyFarewelled);
        require!(m.status != MEMBER_DEFAULTED, KittyError::SettleUpFirst);
        require_keys_eq!(ctx.accounts.member_token.owner, m.wallet, KittyError::WrongTokenAccount);
        // The chip-ins the guest paid themselves. Only a full set (with at most one late) counts as
        // a completed party in the note; a removed or settled-up guest gets a release, which frees
        // the slot without raising their tier (product doc 8.1, 8.5).
        paid_rounds = if cancelled { 0 } else { m.own_paid };
        let _ = n;
        late_count = m.late_count;
        payout = if cancelled { c * m.own_paid as u64 } else { m.keepsafe };
        m.keepsafe = 0;
        m.farewelled = 1;
        leaf = zk::completion_leaf(&m.tag, party_id, paid_rounds, late_count, c)?;
        id = party_id;
        bump = p.bump;
    }
    ops::transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.member_token.to_account_info(),
        &ctx.accounts.party.to_account_info(),
        Auth::Party { id, bump },
        payout,
    )?;
    ctx.accounts.tree.load_mut()?.append(leaf, LEAF_COMPLETION)?;
    emit!(Farewell { party: id, member_idx, paid_rounds, late_count, payout });
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct NoteArgs {
    pub proof: zk::Proof,
    pub nullifier: [u8; 32],
    pub new_commitment: [u8; 32],
    pub tag: [u8; 32],
    pub root: [u8; 32],
    pub now: i64,
}

#[derive(Accounts)]
#[instruction(args: NoteArgs)]
pub struct UpdateNote<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The guest's party wallet for this party.
    pub wallet: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    pub party: AccountLoader<'info, Party>,
    #[account(init, payer = payer, space = 8 + Marker::INIT_SPACE, seeds = [SEED_NULLIFIER, args.nullifier.as_ref()], bump)]
    pub nullifier_marker: Account<'info, Marker>,
    pub system_program: Program<'info, System>,
}

/// COMPLETE: spend the note, append the next one with this party moved into the counters.
pub fn handle_update_note(ctx: Context<UpdateNote>, a: NoteArgs) -> Result<()> {
    let wallet = ctx.accounts.wallet.key();
    let now = ops::now()?;
    require!((a.now - now).abs() <= ctx.accounts.config.now_tolerance_secs, KittyError::BadClock);
    let (party_id, idx, params) = {
        let p = ctx.accounts.party.load()?;
        let i = p.find_tag(&a.tag).ok_or(error!(KittyError::NotAGuest))?;
        require_keys_eq!(p.members[i].wallet, wallet, KittyError::NotAGuest);
        require!(p.members[i].farewelled == 1, KittyError::NoFarewell);
        (p.id, i as u8, zk::params_complete(p.id, p.chip_in, p.guests as u64, &wallet)?)
    };
    require!(ctx.accounts.tree.load()?.is_known_root(&a.root), KittyError::UnknownRoot);
    zk::verify_action(
        &a.proof,
        &zk::ActionSignals {
            nullifier: a.nullifier,
            out_commitment: a.new_commitment,
            out_tag: a.tag,
            out_claim: 0,
            root: a.root,
            now: a.now,
            params_hash: params,
            mode: MODE_COMPLETE,
        },
    )?;
    ctx.accounts.nullifier_marker.bump = ctx.bumps.nullifier_marker;
    ctx.accounts.tree.load_mut()?.append(a.new_commitment, LEAF_NOTE)?;
    emit!(NoteUpdated { party: party_id, member_idx: idx });
    Ok(())
}

#[derive(Accounts)]
pub struct CancelParty<'info> {
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
}

/// The party didn't fill by its deadline: everyone's chip-ins come back at Farewell.
pub fn handle_cancel_party(ctx: Context<CancelParty>) -> Result<()> {
    let now = ops::now()?;
    let mut p = ctx.accounts.party.load_mut()?;
    require!(p.status == PARTY_FORMING, KittyError::PartyFilled);
    require!(now > p.formation_deadline, KittyError::BadTiming);
    p.status = PARTY_CANCELLED;
    emit!(PartyUpdated { party: p.id, status: PARTY_CANCELLED, current_round: 0 });
    Ok(())
}
