//! Plus-ones: a stake behind a guest before they take the kitty. It lowers their keepsafe and is
//! second in the default waterfall; what the waterfall didn't use comes back after the party.
use crate::{
    constants::*,
    error::KittyError,
    events::Vouched,
    math,
    ops::{self, Auth},
    state::*,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
#[instruction(member_idx: u8)]
pub struct VouchFor<'info> {
    #[account(mut)]
    pub voucher: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
    #[account(mut, seeds = [SEED_VAULT, party.key().as_ref()], bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = config.mint, token::authority = voucher)]
    pub voucher_token: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = voucher,
        space = 8 + VouchStake::INIT_SPACE,
        seeds = [SEED_VOUCH, party.key().as_ref(), &[member_idx], voucher.key().as_ref()],
        bump
    )]
    pub vouch: Box<Account<'info, VouchStake>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_vouch(ctx: Context<VouchFor>, member_idx: u8, amount: u64) -> Result<()> {
    require!(amount > 0, KittyError::ZeroAmount);
    let (id, total) = {
        let mut p = ctx.accounts.party.load_mut()?;
        require!(p.status == PARTY_FORMING || p.status == PARTY_ACTIVE, KittyError::NotActive);
        let i = member_idx as usize;
        require!(i < p.joined as usize, KittyError::NotAGuest);
        let m = &mut p.members[i];
        require!(m.took_night == 0 && m.status == MEMBER_ACTIVE, KittyError::AlreadyTook);
        m.vouched += amount;
        (p.id, p.members[i].vouched)
    };
    let v = &mut ctx.accounts.vouch;
    v.party = ctx.accounts.party.key();
    v.voucher = ctx.accounts.voucher.key();
    v.member_idx = member_idx;
    v.amount += amount;
    v.bump = ctx.bumps.vouch;
    ops::transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.voucher_token.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.voucher.to_account_info(),
        Auth::Signer,
        amount,
    )?;
    emit!(Vouched { party: id, member_idx, amount, total });
    Ok(())
}

#[derive(Accounts)]
pub struct Unvouch<'info> {
    #[account(mut)]
    pub voucher: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    pub party: AccountLoader<'info, Party>,
    #[account(mut, seeds = [SEED_VAULT, party.key().as_ref()], bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = config.mint, token::authority = voucher)]
    pub voucher_token: Box<Account<'info, TokenAccount>>,
    #[account(mut, close = voucher, has_one = voucher, has_one = party)]
    pub vouch: Box<Account<'info, VouchStake>>,
    pub token_program: Program<'info, Token>,
}

/// After the party ends: the stake back, minus its share of anything the waterfall used.
pub fn handle_unvouch(ctx: Context<Unvouch>) -> Result<()> {
    let (back, id, bump) = {
        let p = ctx.accounts.party.load()?;
        require!(p.status == PARTY_FINISHED || p.status == PARTY_CANCELLED, KittyError::NotFinished);
        let m = &p.members[ctx.accounts.vouch.member_idx as usize];
        let left = m.vouched - m.vouch_slashed;
        (math::mul_div_round(ctx.accounts.vouch.amount, left, m.vouched).min(ctx.accounts.vouch.amount), p.id, p.bump)
    };
    ops::transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.vault.to_account_info(),
        &ctx.accounts.voucher_token.to_account_info(),
        &ctx.accounts.party.to_account_info(),
        Auth::Party { id, bump },
        back,
    )
}
