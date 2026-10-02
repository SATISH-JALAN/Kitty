//! Kitty: private, protected savings parties on Solana (docs/architecture.md §4).
//!
//! One program holds every token of member money in PDA-owned vaults and all of the rules.
//! Members are known only by per-party tags; a Groth16 proof (circuits/kitty_action.circom)
//! shows each RSVP comes from someone in good standing without saying who.
#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod ops;
pub mod state;
pub mod tree;
pub mod vk;
pub mod zk;
#[cfg(test)]
mod parity_tests;

use anchor_lang::prelude::*;
pub use instructions::*;

declare_id!("5BLmkW7GCc2R2AkpetqRPtFy51Gu5jvxLXzPNaQ6m15t");

#[program]
pub mod kitty {
    use super::*;

    // ---------------------------------------------------------------- admin
    pub fn initialize(ctx: Context<Initialize>, args: ConfigParams) -> Result<()> {
        admin::handle_initialize(ctx, args)
    }
    pub fn update_config(ctx: Context<UpdateConfig>, args: ConfigParams) -> Result<()> {
        admin::handle_update_config(ctx, args)
    }

    // ---------------------------------------------------------------- identity
    pub fn register(ctx: Context<Register>, proof: zk::Proof, nullifier: [u8; 32], timestamp: u64, first_commitment: [u8; 32]) -> Result<()> {
        identity::handle_register(ctx, proof, nullifier, timestamp, first_commitment)
    }
    pub fn register_dev(ctx: Context<RegisterDev>, dev_nullifier: [u8; 32], first_commitment: [u8; 32]) -> Result<()> {
        identity::handle_register_dev(ctx, dev_nullifier, first_commitment)
    }

    // ---------------------------------------------------------------- parties
    pub fn create_party(ctx: Context<CreateParty>, args: CreatePartyArgs) -> Result<()> {
        join::handle_create_party(ctx, args)
    }
    pub fn rsvp(ctx: Context<Rsvp>, args: RsvpArgs) -> Result<()> {
        join::handle_rsvp(ctx, args)
    }
    pub fn pay_manual(ctx: Context<ChipInAccounts>) -> Result<()> {
        chip_in::handle_pay_manual(ctx)
    }
    pub fn collect(ctx: Context<ChipInAccounts>, member_idx: u8) -> Result<()> {
        chip_in::handle_collect(ctx, member_idx)
    }
    pub fn request_draw(ctx: Context<RequestDraw>) -> Result<()> {
        draw::handle_request_draw(ctx)
    }
    pub fn resolve_draw(ctx: Context<ResolveDraw>) -> Result<()> {
        draw::handle_resolve_draw(ctx)
    }
    pub fn settle_round(ctx: Context<SettleRound>) -> Result<()> {
        settle::handle_settle_round(ctx)
    }
    pub fn mark_default(ctx: Context<MarkDefault>, member_idx: u8) -> Result<()> {
        default::handle_mark_default(ctx, member_idx)
    }
    pub fn settle_up(ctx: Context<SettleUp>) -> Result<()> {
        default::handle_settle_up(ctx)
    }
    pub fn vouch(ctx: Context<VouchFor>, member_idx: u8, amount: u64) -> Result<()> {
        vouch::handle_vouch(ctx, member_idx, amount)
    }
    pub fn unvouch(ctx: Context<Unvouch>) -> Result<()> {
        vouch::handle_unvouch(ctx)
    }
    pub fn farewell(ctx: Context<FarewellAccounts>, member_idx: u8) -> Result<()> {
        farewell::handle_farewell(ctx, member_idx)
    }
    pub fn update_note(ctx: Context<UpdateNote>, args: NoteArgs) -> Result<()> {
        farewell::handle_update_note(ctx, args)
    }
    pub fn cancel_party(ctx: Context<CancelParty>) -> Result<()> {
        farewell::handle_cancel_party(ctx)
    }
    pub fn verify_history(ctx: Context<VerifyHistory>, args: HistoryArgs) -> Result<()> {
        history::handle_verify_history(ctx, args)
    }

    // ---------------------------------------------------------------- House Fund
    pub fn house_deposit(ctx: Context<HouseMove>, amount: u64) -> Result<()> {
        house::handle_house_deposit(ctx, amount)
    }
    pub fn house_withdraw(ctx: Context<HouseMove>, shares: u64) -> Result<()> {
        house::handle_house_withdraw(ctx, shares)
    }
}
