//! Host a party (flow 2) and RSVP (flow 3).
use crate::{
    constants::*,
    error::KittyError,
    events::{MemberJoined, PartyCreated, PartyUpdated},
    math, ops,
    state::*,
    zk,
};
use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CreatePartyArgs {
    pub chip_in: u64,
    pub guests: u8,
    pub period_secs: i64,
    pub grace_secs: i64,
    pub start_ts: i64,
    pub formation_deadline: i64,
    pub mode: u8,
    pub host_fee_bps: u16,
    pub min_tier: u8,
    /// Public half of the invite key; the invite link carries the secret in its fragment.
    pub invite_key: Pubkey,
}

#[derive(Accounts)]
pub struct CreateParty<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The host's party wallet for this party.
    pub host: Signer<'info>,
    #[account(mut, seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(seeds = [SEED_HOUSE], bump = house.bump)]
    pub house: Box<Account<'info, HouseFund>>,
    #[account(seeds = [SEED_HOUSE_VAULT], bump = house.vault_bump)]
    pub house_vault: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        space = 8 + std::mem::size_of::<Party>(),
        seeds = [SEED_PARTY, config.next_party_id.to_le_bytes().as_ref()],
        bump
    )]
    pub party: AccountLoader<'info, Party>,
    #[account(init, payer = payer, seeds = [SEED_VAULT, party.key().as_ref()], bump, token::mint = mint, token::authority = party)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(address = config.mint)]
    pub mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Exposure a party adds to the House Fund while active: 20% of all its chip-ins.
pub fn party_exposure(chip_in: u64, guests: u8) -> u64 {
    math::bps(chip_in * guests as u64 * guests as u64, EXPOSURE_BPS)
}

pub fn handle_create_party(ctx: Context<CreateParty>, a: CreatePartyArgs) -> Result<()> {
    let cfg = &mut ctx.accounts.config;
    require!(!cfg.paused, KittyError::Paused);
    require!(a.guests >= MIN_GUESTS && a.guests as usize <= MAX_GUESTS, KittyError::BadGuestCount);
    require!(a.host_fee_bps <= cfg.max_host_bps, KittyError::HostFeeTooHigh);
    require!(a.grace_secs >= cfg.min_grace_secs, KittyError::GraceTooShort);
    require!(a.mode == ORDER_DRAW || a.mode == ORDER_SEATING, KittyError::BadMode);
    require!(a.min_tier <= 2 && a.chip_in > 0, KittyError::BadTiming);
    let now = ops::now()?;
    require!(a.period_secs > 0 && a.formation_deadline > now && a.start_ts >= a.formation_deadline, KittyError::BadTiming);

    // Reserve rule (product doc 9.3): the fund holds ≥ 10% of every active party's exposure.
    let exposure = party_exposure(a.chip_in, a.guests);
    let need = math::bps(ctx.accounts.house.exposure + exposure, RESERVE_BPS);
    require!(ctx.accounts.house_vault.amount >= need, KittyError::ReserveTooLow);

    let id = cfg.next_party_id;
    cfg.next_party_id += 1;
    let mut p = ctx.accounts.party.load_init()?;
    p.id = id;
    p.chip_in = a.chip_in;
    p.exposure = exposure;
    p.allowance = cfg.allowance;
    p.unlocked_by_tier = math::unlocked_by_tier(a.chip_in, a.guests);
    p.period_secs = a.period_secs;
    p.grace_secs = a.grace_secs;
    p.start_ts = a.start_ts;
    p.formation_deadline = a.formation_deadline;
    p.created_ts = now;
    p.host_wallet = ctx.accounts.host.key();
    p.invite_key = a.invite_key;
    p.vault = ctx.accounts.vault.key();
    p.host_fee_bps = a.host_fee_bps;
    p.guests = a.guests;
    p.mode = a.mode;
    p.min_tier = a.min_tier;
    p.status = PARTY_FORMING;
    p.draw_winner = NO_WINNER;
    p.bump = ctx.bumps.party;
    p.vault_bump = ctx.bumps.vault;
    emit!(PartyCreated {
        party: id,
        host_wallet: p.host_wallet,
        chip_in: a.chip_in,
        guests: a.guests,
        period_secs: a.period_secs,
        grace_secs: a.grace_secs,
        start_ts: a.start_ts,
        formation_deadline: a.formation_deadline,
        mode: a.mode,
        host_fee_bps: a.host_fee_bps,
        min_tier: a.min_tier,
    });
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RsvpArgs {
    pub proof: zk::Proof,
    pub nullifier: [u8; 32],
    pub new_commitment: [u8; 32],
    pub tag: [u8; 32],
    pub tier: u8,
    pub root: [u8; 32],
    pub now: i64,
}

#[derive(Accounts)]
#[instruction(args: RsvpArgs)]
pub struct Rsvp<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// The guest's party wallet for this party (bound into the proof's params hash).
    pub wallet: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
    #[account(mut, seeds = [SEED_TREE], bump)]
    pub tree: AccountLoader<'info, KittyTree>,
    #[account(mut)]
    pub party: AccountLoader<'info, Party>,
    #[account(mut, seeds = [SEED_HOUSE], bump = house.bump)]
    pub house: Box<Account<'info, HouseFund>>,
    #[account(init, payer = payer, space = 8 + Marker::INIT_SPACE, seeds = [SEED_NULLIFIER, args.nullifier.as_ref()], bump)]
    pub nullifier_marker: Account<'info, Marker>,
    /// The wallet's token account; auto-pay is the party PDA as its SPL delegate.
    #[account(token::mint = config.mint, token::authority = wallet)]
    pub wallet_token: Box<Account<'info, TokenAccount>>,
    /// CHECK: the instructions sysvar (address checked).
    #[account(address = solana_instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// The invite: the instruction before this one must be an Ed25519 signature by the party's
/// invite key over "kitty-rsvp" ‖ party id ‖ wallet.
fn check_invite(ix_sysvar: &AccountInfo, invite_key: &Pubkey, party_id: u64, wallet: &Pubkey) -> Result<()> {
    use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};
    let cur = load_current_index_checked(ix_sysvar).map_err(|_| error!(KittyError::BadInvite))?;
    require!(cur > 0, KittyError::BadInvite);
    let ix = load_instruction_at_checked(cur as usize - 1, ix_sysvar).map_err(|_| error!(KittyError::BadInvite))?;
    require!(ix.program_id == ED25519_PROGRAM_ID, KittyError::BadInvite);
    let d = &ix.data;
    // [count u8, pad u8, offsets (7 × u16)], then the data; all offsets must point into this instruction.
    require!(d.len() >= 16 && d[0] == 1, KittyError::BadInvite);
    let u16_at = |i: usize| u16::from_le_bytes([d[i], d[i + 1]]) as usize;
    let (sig_ix, pk_off, pk_ix, msg_off, msg_len, msg_ix) = (u16_at(4), u16_at(6), u16_at(8), u16_at(10), u16_at(12), u16_at(14));
    require!(sig_ix == u16::MAX as usize && pk_ix == u16::MAX as usize && msg_ix == u16::MAX as usize, KittyError::BadInvite);
    require!(d.len() >= pk_off + 32 && d.len() >= msg_off + msg_len, KittyError::BadInvite);
    require!(&d[pk_off..pk_off + 32] == invite_key.as_ref(), KittyError::BadInvite);
    let mut expected = Vec::with_capacity(INVITE_DOMAIN.len() + 40);
    expected.extend_from_slice(INVITE_DOMAIN);
    expected.extend_from_slice(&party_id.to_le_bytes());
    expected.extend_from_slice(wallet.as_ref());
    require!(d[msg_off..msg_off + msg_len] == expected[..], KittyError::BadInvite);
    Ok(())
}

pub const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

pub fn handle_rsvp(ctx: Context<Rsvp>, a: RsvpArgs) -> Result<()> {
    let cfg = &ctx.accounts.config;
    let wallet = ctx.accounts.wallet.key();
    let now = ops::now()?;
    let mut p = ctx.accounts.party.load_mut()?;
    require!(p.status == PARTY_FORMING, KittyError::NotForming);
    require!((p.joined as usize) < p.guests as usize, KittyError::PartyFull);
    require!(now <= p.formation_deadline, KittyError::FormationClosed);
    require!((a.now - now).abs() <= cfg.now_tolerance_secs, KittyError::BadClock);
    require!(a.tier <= 2, KittyError::InvalidProof);
    require!(p.find_tag(&a.tag).is_none() && p.find_wallet(&wallet).is_none(), KittyError::AlreadyJoined);
    check_invite(&ctx.accounts.instructions, &p.invite_key, p.id, &wallet)?;

    // Auto-pay: the party PDA may pull every remaining chip-in (round 1 is paid by hand).
    let t = &ctx.accounts.wallet_token;
    let need = p.per_round_total(cfg) * (p.guests as u64 - 1);
    let delegated = t.delegate.is_some() && t.delegate.unwrap() == ctx.accounts.party.key();
    require!(delegated && t.delegated_amount >= need, KittyError::AutoPayMissing);

    {
        let tree = ctx.accounts.tree.load()?;
        require!(tree.is_known_root(&a.root), KittyError::UnknownRoot);
    }
    let params = zk::params_join(
        &zk::JoinParams {
            grace: p.grace_secs as u64,
            party: p.id,
            start: p.start_ts as u64,
            period: p.period_secs as u64,
            rounds: p.guests as u64,
            unlocked_by_tier: p.unlocked_by_tier,
            min_tier: p.min_tier as u64,
            allowance: p.allowance,
        },
        &wallet,
    )?;
    zk::verify_action(
        &a.proof,
        &zk::ActionSignals {
            nullifier: a.nullifier,
            out_commitment: a.new_commitment,
            out_tag: a.tag,
            out_claim: a.tier as u64,
            root: a.root,
            now: a.now,
            params_hash: params,
            mode: MODE_JOIN,
        },
    )?;
    ctx.accounts.nullifier_marker.bump = ctx.bumps.nullifier_marker;

    // Seat: the earliest night the tier allows. A seating plan gives each guest their own night;
    // if none is left for the tier, the guest takes the earliest free night with τ one step lower.
    let earliest = math::earliest_seat(a.tier, p.guests);
    let (seat, relaxed) = if p.mode == ORDER_SEATING {
        let taken = |s: u8| p.members[..p.joined as usize].iter().any(|m| m.seat == s);
        match (earliest..=p.guests).find(|s| !taken(*s)) {
            Some(s) => (s, false),
            None => ((1..=p.guests).find(|s| !taken(*s)).ok_or(error!(KittyError::NoSeat))?, true),
        }
    } else {
        (earliest, false)
    };

    let idx = p.joined as usize;
    let is_host = wallet == p.host_wallet;
    p.members[idx] = Member {
        tag: a.tag,
        wallet,
        tier: a.tier,
        is_host: is_host as u8,
        seat,
        gate_relaxed: relaxed as u8,
        status: MEMBER_ACTIVE,
        ..Default::default()
    };
    p.joined += 1;
    emit!(MemberJoined { party: p.id, member_idx: idx as u8, tag: a.tag, wallet, tier: a.tier, seat, gate_relaxed: relaxed, is_host });
    if p.joined == p.guests {
        p.status = PARTY_ACTIVE;
        ctx.accounts.house.exposure += p.exposure;
        emit!(PartyUpdated { party: p.id, status: p.status, current_round: 0 });
    }
    drop(p);
    ctx.accounts.tree.load_mut()?.append(a.new_commitment, LEAF_NOTE)?;
    Ok(())
}
