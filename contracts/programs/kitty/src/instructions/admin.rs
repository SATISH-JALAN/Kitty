use crate::{constants::*, error::KittyError, state::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigParams {
    pub protocol_bps: u16,
    pub cover_bps: u16,
    pub late_bps: u16,
    pub max_host_bps: u16,
    pub min_grace_secs: i64,
    pub collect_window_secs: i64,
    pub now_tolerance_secs: i64,
    pub allowance: u64,
    pub aadhaar_pubkey_hash: [u8; 32],
    pub nullifier_seed: u64,
    pub dev_register: bool,
    pub paused: bool,
}

impl Config {
    fn apply(&mut self, a: &ConfigParams) -> Result<()> {
        require!(a.protocol_bps <= 200 && a.cover_bps <= 200 && a.late_bps <= 1_000 && a.max_host_bps <= 500, KittyError::Overflow);
        self.protocol_bps = a.protocol_bps;
        self.cover_bps = a.cover_bps;
        self.late_bps = a.late_bps;
        self.max_host_bps = a.max_host_bps;
        self.min_grace_secs = a.min_grace_secs;
        self.collect_window_secs = a.collect_window_secs;
        self.now_tolerance_secs = a.now_tolerance_secs;
        self.allowance = a.allowance;
        self.aadhaar_pubkey_hash = a.aadhaar_pubkey_hash;
        self.nullifier_seed = a.nullifier_seed;
        self.dev_register = a.dev_register;
        self.paused = a.paused;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [SEED_CONFIG], bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(init, payer = admin, space = 8 + std::mem::size_of::<KittyTree>(), seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    #[account(init, payer = admin, space = 8 + HouseFund::INIT_SPACE, seeds = [SEED_HOUSE], bump)]
    pub house: Box<Account<'info, HouseFund>>,
    #[account(init, payer = admin, seeds = [SEED_HOUSE_VAULT], bump, token::mint = mint, token::authority = house)]
    pub house_vault: Box<Account<'info, TokenAccount>>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(token::mint = mint)]
    pub treasury: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize(ctx: Context<Initialize>, args: ConfigParams) -> Result<()> {
    let c = &mut ctx.accounts.config;
    c.admin = ctx.accounts.admin.key();
    c.mint = ctx.accounts.mint.key();
    c.treasury = ctx.accounts.treasury.key();
    c.next_party_id = 1;
    c.bump = ctx.bumps.config;
    c.apply(&args)?;
    ctx.accounts.tree.load_init()?.init()?;
    let h = &mut ctx.accounts.house;
    h.bump = ctx.bumps.house;
    h.vault_bump = ctx.bumps.house_vault;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEED_CONFIG], bump = config.bump, has_one = admin @ KittyError::NotAdmin)]
    pub config: Box<Account<'info, Config>>,
}

pub fn handle_update_config(ctx: Context<UpdateConfig>, args: ConfigParams) -> Result<()> {
    ctx.accounts.config.apply(&args)
}
