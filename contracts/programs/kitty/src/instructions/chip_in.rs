//! Chip-ins (flow 4): the Butler's auto-pay `collect`, and `pay_manual` (the first chip-in at
//! RSVP, paying ahead, or paying late inside grace hours).
use crate::{
    constants::*,
    error::KittyError,
    events::{ChipIn, HouseFlow},
    math,
    ops::{self, Auth},
    state::*,
    zk,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct ChipInAccounts<'info> {
    /// The guest's party wallet (`pay_manual`) or any cranker (`collect`).
    pub signer: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
    #[account(mut, seeds = [SEED_VAULT, party.key().as_ref()], bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    /// The guest's token account (checked against the guest's wallet in the handler).
    #[account(mut, token::mint = config.mint)]
    pub member_token: Box<Account<'info, TokenAccount>>,
    #[account(mut, address = config.treasury)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [SEED_HOUSE], bump = house.bump)]
    pub house: Box<Account<'info, HouseFund>>,
    #[account(mut, seeds = [SEED_HOUSE_VAULT], bump = house.vault_bump)]
    pub house_vault: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

struct Plan {
    idx: usize,
    rounds: u8,
    to_vault: u64,
    kitty_fee: u64,
    to_house: u64,
    released: u64,
    late: bool,
    receipt: [u8; 32],
    paid_through: u8,
    party_id: u64,
    bump: u8,
}

/// Work out one chip-in and update the member; token moves happen after.
fn plan(p: &mut Party, cfg: &Config, idx: usize, now: i64, by_butler: bool) -> Result<Plan> {
    let c = p.chip_in;
    let (kf, hf) = math::fees(c, cfg);
    let n = p.guests;
    let m = &p.members[idx];
    let (rounds, late) = match m.status {
        MEMBER_ACTIVE => {
            let r = m.paid_through + 1;
            require!(r <= n, KittyError::NothingDue);
            require!(r > p.current_round, KittyError::WrongRound);
            if by_butler {
                require!(p.status == PARTY_ACTIVE && now >= p.due_ts(r), KittyError::NotDue);
            } else {
                // The first chip-in goes in at RSVP; after that, at most one night ahead.
                let ok = (r == 1 && (p.status == PARTY_FORMING || p.status == PARTY_ACTIVE))
                    || (p.status == PARTY_ACTIVE && now >= p.due_ts(r) - p.period_secs);
                require!(ok, KittyError::NotDue);
            }
            (1u8, false)
        }
        MEMBER_GRACE if !by_butler => {
            // Pay back every night the House Fund fronted, plus the late fee for each.
            require!(p.current_round > m.paid_through, KittyError::NothingDue);
            (p.current_round - m.paid_through, true)
        }
        _ => return err!(KittyError::NothingDue),
    };
    let k = rounds as u64;
    let (to_vault, to_house) = if late {
        (0, (c + hf + math::late_fee(c, cfg)) * k)
    } else {
        (c * k, hf * k)
    };

    let party_id = p.id;
    let bump = p.bump;
    let m = &mut p.members[idx];
    if late {
        m.advance = m.advance.saturating_sub(c * k);
        m.late_count = m.late_count.saturating_add(rounds);
        m.status = MEMBER_ACTIVE;
        m.grace_deadline = 0;
    }
    m.paid_through += rounds;
    m.own_paid += rounds;
    // A guest who took the kitty gets L·c/R of the keepsafe back with each chip-in.
    let mut released = 0;
    if m.took_night > 0 && m.keepsafe > 0 {
        let since = (m.paid_through - m.took_night) as u64;
        let left = math::keepsafe_after(m.keepsafe_total, m.remaining, c, since);
        released = m.keepsafe.saturating_sub(left);
        m.keepsafe = left;
    }
    let receipt = zk::receipt_leaf(&m.tag, party_id, m.paid_through)?;
    Ok(Plan { idx, rounds, to_vault, kitty_fee: kf * k, to_house, released, late, receipt, paid_through: m.paid_through, party_id, bump })
}

fn execute<'info>(a: &mut ChipInAccounts<'info>, pl: &Plan, auth: Auth, by_butler: bool) -> Result<()> {
    let tp = a.token_program.to_account_info();
    let from = a.member_token.to_account_info();
    let authority = match auth {
        Auth::Signer => a.signer.to_account_info(),
        _ => a.party.to_account_info(),
    };
    ops::transfer(&tp, &from, &a.vault.to_account_info(), &authority, auth, pl.to_vault)?;
    ops::transfer(&tp, &from, &a.treasury.to_account_info(), &authority, auth, pl.kitty_fee)?;
    ops::transfer(&tp, &from, &a.house_vault.to_account_info(), &authority, auth, pl.to_house)?;
    let party_auth = Auth::Party { id: pl.party_id, bump: pl.bump };
    ops::transfer(&tp, &a.vault.to_account_info(), &from, &a.party.to_account_info(), party_auth, pl.released)?;

    a.house.fees_in += pl.to_house;
    let balance = a.house_vault.amount + pl.to_house;
    emit!(HouseFlow { kind: if pl.late { 2 } else { 0 }, amount: pl.to_house, balance, party: pl.party_id });
    a.tree.load_mut()?.append(pl.receipt, LEAF_RECEIPT)?;
    emit!(ChipIn {
        party: pl.party_id,
        member_idx: pl.idx as u8,
        paid_through: pl.paid_through,
        rounds: pl.rounds,
        amount: pl.to_vault + pl.kitty_fee + pl.to_house,
        late: pl.late,
        keepsafe_released: pl.released,
        by_butler,
    });
    Ok(())
}

/// "Chip in now": the guest pays the next night (or settles nights in grace, with the late fee).
pub fn handle_pay_manual(ctx: Context<ChipInAccounts>) -> Result<()> {
    let now = ops::now()?;
    let wallet = ctx.accounts.signer.key();
    require_keys_eq!(ctx.accounts.member_token.owner, wallet, KittyError::WrongTokenAccount);
    let pl = {
        let mut p = ctx.accounts.party.load_mut()?;
        let idx = p.find_wallet(&wallet).ok_or(error!(KittyError::NotAGuest))?;
        plan(&mut p, &ctx.accounts.config, idx, now, false)?
    };
    execute(ctx.accounts, &pl, Auth::Signer, false)
}

/// Auto-pay: anyone (the Butler) pulls a due chip-in with the party PDA's delegation.
pub fn handle_collect(ctx: Context<ChipInAccounts>, member_idx: u8) -> Result<()> {
    let now = ops::now()?;
    let (pl, id, bump) = {
        let mut p = ctx.accounts.party.load_mut()?;
        require!((member_idx as usize) < p.joined as usize, KittyError::NotAGuest);
        require_keys_eq!(ctx.accounts.member_token.owner, p.members[member_idx as usize].wallet, KittyError::WrongTokenAccount);
        let pl = plan(&mut p, &ctx.accounts.config, member_idx as usize, now, true)?;
        (pl, p.id, p.bump)
    };
    execute(ctx.accounts, &pl, Auth::Party { id, bump }, true)
}
