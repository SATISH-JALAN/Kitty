//! Token moves. Handlers update state first, drop their zero-copy borrows, then move tokens,
//! because a PDA that signs a CPI must not be borrowed at the same time.
use crate::constants::*;
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Transfer};

/// Who authorises a move out of an account.
#[derive(Clone, Copy)]
pub enum Auth {
    /// A transaction signer (the member's party wallet, a voucher, a depositor).
    Signer,
    /// The party PDA: the party vault, or a member's token account it is the auto-pay delegate of.
    Party { id: u64, bump: u8 },
    /// The House Fund PDA: the House Fund vault.
    House { bump: u8 },
}

pub fn transfer<'info>(
    token_program: &AccountInfo<'info>,
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    auth: Auth,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let accounts = Transfer { from: from.clone(), to: to.clone(), authority: authority.clone() };
    let _ = token_program;
    match auth {
        Auth::Signer => token::transfer(CpiContext::new(token::ID, accounts), amount),
        Auth::Party { id, bump } => {
            let id = id.to_le_bytes();
            let seeds: &[&[u8]] = &[SEED_PARTY, &id, &[bump]];
            token::transfer(CpiContext::new_with_signer(token::ID, accounts, &[seeds]), amount)
        }
        Auth::House { bump } => {
            let seeds: &[&[u8]] = &[SEED_HOUSE, &[bump]];
            token::transfer(CpiContext::new_with_signer(token::ID, accounts, &[seeds]), amount)
        }
    }
}

/// Current clock.
pub fn now() -> Result<i64> {
    Ok(Clock::get()?.unix_timestamp)
}
