//! Settle a night: the House Fund fronts any missing chip-ins (grace hours start), tonight's guest
//! takes the kitty minus the host fee and their keepsafe, and the host gets their fee.
use crate::{
    constants::*,
    error::KittyError,
    events::{HouseFlow, PartyUpdated, RoundSettled},
    math,
    ops::{self, Auth},
    state::*,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct SettleRound<'info> {
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
    #[account(mut, seeds = [SEED_VAULT, party.key().as_ref()], bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [SEED_HOUSE], bump = house.bump)]
    pub house: Box<Account<'info, HouseFund>>,
    #[account(mut, seeds = [SEED_HOUSE_VAULT], bump = house.vault_bump)]
    pub house_vault: Box<Account<'info, TokenAccount>>,
    /// Tonight's guest's token account (for a House seat: the removed guest's, for their refund).
    #[account(mut, token::mint = config.mint)]
    pub winner_token: Box<Account<'info, TokenAccount>>,
    /// The host's token account; the same account as `winner_token` when the host takes the kitty.
    #[account(mut, dup, token::mint = config.mint)]
    pub host_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_settle_round(ctx: Context<SettleRound>) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let now = ops::now()?;
    let (id, bump, r, winner, fronted, take, to_house, refund, finished, exposure);
    {
        let mut p = ctx.accounts.party.load_mut()?;
        require!(p.status == PARTY_ACTIVE, KittyError::NotActive);
        r = p.current_round + 1;
        require!(now >= p.due_ts(r) + cfg.collect_window_secs, KittyError::NotDue);
        let w = if p.mode == ORDER_DRAW {
            require!(p.draw_round == r && p.draw_winner != NO_WINNER, KittyError::NoDraw);
            p.draw_winner as usize
        } else {
            (0..p.joined as usize).find(|&i| p.members[i].seat == r).ok_or(error!(KittyError::NoEligibleGuest))?
        };
        let ws = p.members[w].status;
        require!(ws == MEMBER_ACTIVE || ws == MEMBER_REMOVED, KittyError::WinnerInGrace);
        require!(p.members[w].took_night == 0, KittyError::AlreadyTook);
        // Tonight's guest must have chipped in tonight. They have the party's grace hours to do
        // it; after that their grace is over at once, so `mark_default` can remove them and the
        // House Fund takes this seat (product doc 7.7). Without this a Seating-plan party whose
        // guest of the night can't pay would wait forever: grace otherwise starts only here.
        if ws == MEMBER_ACTIVE && p.members[w].paid_through < r {
            let grace_end = p.due_ts(r) + p.grace_secs;
            require!(now >= grace_end, KittyError::WinnerInGrace);
            let m = &mut p.members[w];
            m.status = MEMBER_GRACE;
            m.grace_deadline = grace_end;
            return Ok(());
        }
        let relaxed = if p.mode == ORDER_DRAW { p.draw_relaxed == 1 } else { p.members[w].gate_relaxed == 1 };

        // Front tonight's missing chip-ins from the House Fund.
        let c = p.chip_in;
        let grace_deadline = p.due_ts(r) + p.grace_secs;
        let mut front = 0u64;
        for i in 0..p.joined as usize {
            let m = &mut p.members[i];
            if m.paid_through >= r {
                continue;
            }
            match m.status {
                MEMBER_ACTIVE | MEMBER_GRACE => {
                    m.advance += c;
                    if m.status == MEMBER_ACTIVE {
                        m.status = MEMBER_GRACE;
                        m.grace_deadline = grace_deadline;
                    }
                }
                MEMBER_REMOVED => {
                    m.house_paid += c;
                    m.paid_through = r;
                }
                _ => {}
            }
            front += c;
        }
        fronted = front;

        let (host_wallet, guests, host_fee_bps) = (p.host_wallet, p.guests, p.host_fee_bps);
        require_keys_eq!(ctx.accounts.host_token.owner, host_wallet, KittyError::WrongTokenAccount);
        let m = &mut p.members[w];
        require_keys_eq!(ctx.accounts.winner_token.owner, m.wallet, KittyError::WrongTokenAccount);
        if m.status == MEMBER_REMOVED {
            // The House Fund holds this seat: it takes the kitty, and the removed guest gets back
            // what they paid in, minus 5% (product doc 7.7).
            let t = math::take(c, guests, r, 2, host_fee_bps, 0, false);
            let paid_in = c * m.own_paid as u64;
            refund = paid_in - math::bps(paid_in, REMOVAL_PENALTY_BPS);
            to_house = t.kitty - t.host_fee - refund;
            take = math::Take { keepsafe: 0, paid_now: 0, ..t };
        } else {
            let t = math::take(c, guests, r, m.tier, host_fee_bps, m.vouched, relaxed);
            m.keepsafe = t.keepsafe;
            m.keepsafe_total = t.keepsafe;
            m.remaining = t.remaining;
            if relaxed {
                m.gate_relaxed = 1;
            }
            refund = 0;
            to_house = 0;
            take = t;
        }
        m.took_night = r;
        winner = w as u8;
        p.current_round = r;
        p.draw_round = 0;
        p.draw_winner = NO_WINNER;
        finished = r == p.guests;
        if finished {
            p.status = PARTY_FINISHED;
        }
        exposure = p.exposure;
        id = p.id;
        bump = p.bump;
    }

    require!(ctx.accounts.house_vault.amount >= fronted, KittyError::HouseFundShort);
    let tp = ctx.accounts.token_program.to_account_info();
    let house_auth = Auth::House { bump: ctx.accounts.house.bump };
    let party_auth = Auth::Party { id, bump };
    let house_ai = ctx.accounts.house.to_account_info();
    let party_ai = ctx.accounts.party.to_account_info();
    let vault = ctx.accounts.vault.to_account_info();
    let hv = ctx.accounts.house_vault.to_account_info();
    ops::transfer(&tp, &hv, &vault, &house_ai, house_auth, fronted)?;
    ops::transfer(&tp, &vault, &ctx.accounts.host_token.to_account_info(), &party_ai, party_auth, take.host_fee)?;
    ops::transfer(&tp, &vault, &ctx.accounts.winner_token.to_account_info(), &party_ai, party_auth, take.paid_now + refund)?;
    ops::transfer(&tp, &vault, &hv, &party_ai, party_auth, to_house)?;

    let house = &mut ctx.accounts.house;
    house.paid_out += fronted;
    let mut balance = ctx.accounts.house_vault.amount - fronted;
    if fronted > 0 {
        emit!(HouseFlow { kind: 1, amount: fronted, balance, party: id });
    }
    if to_house > 0 {
        balance += to_house;
        house.fees_in += to_house;
        emit!(HouseFlow { kind: 6, amount: to_house, balance, party: id });
    }
    if finished {
        house.exposure = house.exposure.saturating_sub(exposure);
        emit!(PartyUpdated { party: id, status: PARTY_FINISHED, current_round: r });
    }
    emit!(RoundSettled {
        party: id,
        round: r,
        winner_idx: winner,
        kitty: take.kitty,
        paid_now: take.paid_now + refund,
        keepsafe: take.keepsafe,
        host_fee: take.host_fee,
        house_fronted: fronted,
        to_house: to_house > 0,
    });
    Ok(())
}
