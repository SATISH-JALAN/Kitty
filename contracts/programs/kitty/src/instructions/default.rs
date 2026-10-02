//! Missed chip-ins (flow 6) and settling up (flow 7).
use crate::{
    constants::*,
    error::KittyError,
    events::{Defaulted, HouseFlow, SettledUp},
    math,
    ops::{self, Auth},
    state::*,
    zk,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct MarkDefault<'info> {
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
    #[account(mut, seeds = [SEED_VAULT, party.key().as_ref()], bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [SEED_HOUSE], bump = house.bump)]
    pub house: Box<Account<'info, HouseFund>>,
    #[account(mut, seeds = [SEED_HOUSE_VAULT], bump = house.vault_bump)]
    pub house_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Grace hours are over. A guest who took the kitty: the waterfall covers every chip-in they
/// still owe (keepsafe → plus-ones → House Fund) and no receipt is written, so their Diary is on
/// hold. A guest who hadn't: removed, a release receipt keeps their Diary clear, and the House
/// Fund takes the seat (product doc 7.7).
pub fn handle_mark_default(ctx: Context<MarkDefault>, member_idx: u8) -> Result<()> {
    let now = ops::now()?;
    let i = member_idx as usize;
    let (id, bump, w, removed, missed, release_leaf);
    {
        let mut p = ctx.accounts.party.load_mut()?;
        require!(i < p.joined as usize, KittyError::NotAGuest);
        require!(p.members[i].status == MEMBER_GRACE, KittyError::NotInGrace);
        require!(now > p.members[i].grace_deadline, KittyError::GraceNotOver);
        let (c, n, party_id) = (p.chip_in, p.guests, p.id);
        let m = &mut p.members[i];
        if m.took_night > 0 {
            let owed = c * (n - m.paid_through) as u64;
            let wf = math::waterfall(owed, m.keepsafe, m.vouched - m.vouch_slashed);
            m.keepsafe -= wf.from_keepsafe;
            m.vouch_slashed += wf.from_plus_ones;
            m.debt = wf.from_house;
            m.missed_nights = n - m.paid_through;
            m.paid_through = n;
            m.status = MEMBER_DEFAULTED;
            // The fund already fronted `advance`; the vault now gets (or returns) the difference.
            let advance = m.advance;
            m.advance = 0;
            missed = owed;
            w = (wf, advance);
            removed = false;
            release_leaf = None;
        } else {
            m.house_paid += m.advance;
            m.advance = 0;
            m.status = MEMBER_REMOVED;
            missed = 0;
            w = (math::waterfall(0, 0, 0), 0);
            removed = true;
            release_leaf = Some(zk::receipt_leaf(&m.tag, party_id, n)?);
        }
        id = p.id;
        bump = p.bump;
    }
    let (wf, advance) = w;
    let tp = ctx.accounts.token_program.to_account_info();
    let vault = ctx.accounts.vault.to_account_info();
    let hv = ctx.accounts.house_vault.to_account_info();
    let mut balance = ctx.accounts.house_vault.amount;
    if wf.from_house > advance {
        let more = wf.from_house - advance;
        require!(balance >= more, KittyError::HouseFundShort);
        ops::transfer(&tp, &hv, &vault, &ctx.accounts.house.to_account_info(), Auth::House { bump: ctx.accounts.house.bump }, more)?;
        balance -= more;
        ctx.accounts.house.paid_out += more;
        emit!(HouseFlow { kind: 1, amount: more, balance, party: id });
    } else if advance > wf.from_house {
        // The keepsafe and plus-ones covered more than the fund fronted: reimburse the fund.
        let back = advance - wf.from_house;
        ops::transfer(&tp, &vault, &hv, &ctx.accounts.party.to_account_info(), Auth::Party { id, bump }, back)?;
        balance += back;
        emit!(HouseFlow { kind: 7, amount: back, balance, party: id });
    }
    if let Some(leaf) = release_leaf {
        ctx.accounts.tree.load_mut()?.append(leaf, LEAF_RECEIPT)?;
    }
    emit!(Defaulted {
        party: id,
        member_idx,
        missed,
        from_keepsafe: wf.from_keepsafe,
        from_plus_ones: wf.from_plus_ones,
        from_house: wf.from_house,
        removed,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct SettleUp<'info> {
    pub wallet: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
    #[account(mut, token::mint = config.mint, token::authority = wallet)]
    pub wallet_token: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [SEED_HOUSE], bump = house.bump)]
    pub house: Box<Account<'info, HouseFund>>,
    #[account(mut, seeds = [SEED_HOUSE_VAULT], bump = house.vault_bump)]
    pub house_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Repay what the House Fund covered plus a late fee per missed night; the missing receipt is
/// appended and the Diary comes off hold.
pub fn handle_settle_up(ctx: Context<SettleUp>) -> Result<()> {
    let wallet = ctx.accounts.wallet.key();
    let (idx, id, amount, leaf);
    {
        let mut p = ctx.accounts.party.load_mut()?;
        let i = p.find_wallet(&wallet).ok_or(error!(KittyError::NotAGuest))?;
        let (c, n, party_id) = (p.chip_in, p.guests, p.id);
        let m = &mut p.members[i];
        require!(m.status == MEMBER_DEFAULTED, KittyError::NothingToSettle);
        amount = m.debt + m.missed_nights as u64 * math::late_fee(c, &ctx.accounts.config);
        m.late_count = m.late_count.saturating_add(m.missed_nights);
        m.debt = 0;
        m.status = MEMBER_SETTLED;
        leaf = zk::receipt_leaf(&m.tag, party_id, n)?;
        idx = i as u8;
        id = party_id;
    }
    ops::transfer(
        &ctx.accounts.token_program.to_account_info(),
        &ctx.accounts.wallet_token.to_account_info(),
        &ctx.accounts.house_vault.to_account_info(),
        &ctx.accounts.wallet.to_account_info(),
        Auth::Signer,
        amount,
    )?;
    ctx.accounts.house.fees_in += amount;
    emit!(HouseFlow { kind: 2, amount, balance: ctx.accounts.house_vault.amount + amount, party: id });
    ctx.accounts.tree.load_mut()?.append(leaf, LEAF_RECEIPT)?;
    emit!(SettledUp { party: id, member_idx: idx, amount });
    Ok(())
}
