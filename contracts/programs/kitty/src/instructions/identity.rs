//! Guest Pass (flow 1): an Anon Aadhaar proof creates a registration marker and the first note.
use crate::{constants::*, error::KittyError, events::Registered, state::*, zk};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(proof: zk::Proof, nullifier: [u8; 32])]
pub struct Register<'info> {
    /// Fee payer (the relay); pays the marker's rent.
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    /// Its existence is the "one person, one pass" check.
    #[account(init, payer = payer, space = 8 + Marker::INIT_SPACE, seeds = [SEED_REG, nullifier.as_ref()], bump)]
    pub marker: Account<'info, Marker>,
    pub system_program: Program<'info, System>,
}

/// Verify the Anon Aadhaar proof and append the member's first note. The proof's signal is
/// keccak(first_commitment) >> 3, so it is only good for this note.
pub fn handle_register(ctx: Context<Register>, proof: zk::Proof, nullifier: [u8; 32], timestamp: u64, first_commitment: [u8; 32]) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let signal = zk::aadhaar_signal_hash(&first_commitment);
    zk::verify_aadhaar(&proof, &cfg.aadhaar_pubkey_hash, &nullifier, timestamp, cfg.nullifier_seed, &signal)?;
    ctx.accounts.marker.bump = ctx.bumps.marker;
    let leaf_index = ctx.accounts.tree.load_mut()?.append(first_commitment, LEAF_NOTE)?;
    emit!(Registered { nullifier, leaf_index, dev: false });
    Ok(())
}

#[derive(Accounts)]
#[instruction(dev_nullifier: [u8; 32])]
pub struct RegisterDev<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump, has_one = admin @ KittyError::NotAdmin)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    #[account(init, payer = admin, space = 8 + Marker::INIT_SPACE, seeds = [SEED_REG, dev_nullifier.as_ref()], bump)]
    pub marker: Account<'info, Marker>,
    pub system_program: Program<'info, System>,
}

/// Devnet harness only (`config.dev_register`): the admin registers a test identity without an
/// Aadhaar proof, so simulated guests don't each need a minute of proving.
pub fn handle_register_dev(ctx: Context<RegisterDev>, dev_nullifier: [u8; 32], first_commitment: [u8; 32]) -> Result<()> {
    require!(ctx.accounts.config.dev_register, KittyError::DevRegisterOff);
    ctx.accounts.marker.bump = ctx.bumps.marker;
    let leaf_index = ctx.accounts.tree.load_mut()?.append(first_commitment, LEAF_NOTE)?;
    emit!(Registered { nullifier: dev_nullifier, leaf_index, dev: true });
    Ok(())
}
