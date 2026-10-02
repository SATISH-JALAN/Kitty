//! House Fund cover capital (devnet: test wallets act as cover providers, product doc 9.5).
use crate::{
    constants::*,
    error::KittyError,
    events::HouseFlow,
    math,
    ops::{self, Auth},
    state::*,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct HouseMove<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_HOUSE], bump = house.bump)]
    pub house: Box<Account<'info, HouseFund>>,
    #[account(mut, seeds = [SEED_HOUSE_VAULT], bump = house.vault_bump)]
    pub house_vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = config.mint, token::authority = owner)]
    pub owner_token: Box<Account<'info, TokenAccount>>,
    #[account(init_if_needed, payer = owner, space = 8 + HouseShare::INIT_SPACE, seeds = [SEED_SHARE, owner.key().as_ref()], bump)]
    pub share: Box<Account<'info, HouseShare>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_house_deposit(ctx: Context<HouseMove>, amount: u64) -> Result<()> {
    require!(amount > 0, KittyError::ZeroAmount);
    let balance = ctx.accounts.house_vault.amount;
    let h = &mut ctx.accounts.house;
    let shares = if h.total_shares == 0 || balance == 0 { amount } else { (amount as u128 * h.total_shares as u128 / balance as u128) as u64 };
    h.total_shares += shares;
    let s = &mut ctx.accounts.share;
    s.owner = ctx.accounts.owner.key();
    s.shares += shares;
    s.bump = ctx.bumps.share;
    ops::transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.owner_token.to_account_info(),
        &ctx.accounts.house_vault.to_account_info(),
        &ctx.accounts.owner.to_account_info(),
        Auth::Signer,
        amount,
    )?;
    emit!(HouseFlow { kind: 4, amount, balance: balance + amount, party: 0 });
    Ok(())
}

pub fn handle_house_withdraw(ctx: Context<HouseMove>, shares: u64) -> Result<()> {
    require!(shares > 0 && ctx.accounts.share.shares >= shares, KittyError::ZeroAmount);
    let balance = ctx.accounts.house_vault.amount;
    let h = &mut ctx.accounts.house;
    let amount = (shares as u128 * balance as u128 / h.total_shares as u128) as u64;
    // Withdrawals can't take the fund below 10% of active parties' exposure.
    require!(balance - amount >= math::bps(h.exposure, RESERVE_BPS), KittyError::ReserveRule);
    h.total_shares -= shares;
    ctx.accounts.share.shares -= shares;
    let bump = h.bump;
    ops::transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.house_vault.to_account_info(),
        &ctx.accounts.owner_token.to_account_info(),
        &ctx.accounts.house.to_account_info(),
        Auth::House { bump },
        amount,
    )?;
    emit!(HouseFlow { kind: 5, amount, balance: balance - amount, party: 0 });
    Ok(())
}
