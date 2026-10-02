//! Show a page (flow 9): check a HISTORY proof on-chain. The note's nullifier is shown but must
//! still be unspent (the claim is about the member's current note).
use crate::{constants::*, error::KittyError, events::HistoryVerified, ops, state::*, zk};
use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct HistoryArgs {
    pub proof: zk::Proof,
    pub nullifier: [u8; 32],
    pub pseudonym: [u8; 32],
    pub root: [u8; 32],
    pub now: i64,
    pub min_completed: u64,
    pub min_paid: u64,
    pub max_late: u64,
    pub scope: [u8; 32],
    pub challenge: [u8; 32],
}

#[derive(Accounts)]
#[instruction(args: HistoryArgs)]
pub struct VerifyHistory<'info> {
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    /// CHECK: must be the (unused) nullifier marker address for this nullifier.
    #[account(seeds = [SEED_NULLIFIER, args.nullifier.as_ref()], bump)]
    pub nullifier_marker: UncheckedAccount<'info>,
}

pub fn handle_verify_history(ctx: Context<VerifyHistory>, a: HistoryArgs) -> Result<()> {
    let now = ops::now()?;
    require!((a.now - now).abs() <= ctx.accounts.config.now_tolerance_secs, KittyError::BadClock);
    require!(ctx.accounts.nullifier_marker.data_is_empty(), KittyError::NullifierSpent);
    require!(ctx.accounts.tree.load()?.is_known_root(&a.root), KittyError::UnknownRoot);
    let params = zk::params_history(a.min_completed, a.min_paid, a.max_late, &a.scope, &a.challenge)?;
    zk::verify_action(
        &a.proof,
        &zk::ActionSignals {
            nullifier: a.nullifier,
            out_commitment: [0u8; 32],
            out_tag: a.pseudonym,
            out_claim: 1,
            root: a.root,
            now: a.now,
            params_hash: params,
            mode: MODE_HISTORY,
        },
    )?;
    emit!(HistoryVerified {
        pseudonym: a.pseudonym,
        scope: a.scope,
        challenge: a.challenge,
        min_completed: a.min_completed,
        min_paid: a.min_paid,
        max_late: a.max_late,
    });
    Ok(())
}
