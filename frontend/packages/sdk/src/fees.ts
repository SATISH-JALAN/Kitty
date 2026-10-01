/**
 * Fee and payout maths for a party (product doc 7.5, 7.7, 8.1, 9.1, 11.1).
 *
 * All amounts are integers in micro-units of the 6-decimal test token (kUSD),
 * so $1 = 1_000_000. Never do money maths in floating dollars.
 */

export const MICRO = 1_000_000;

/** Basis points, from `Config` (architecture 4.1). */
export const FEES = {
  /** Kitty fee: paid on top of each chip-in. */
  protocolBps: 50,
  /** House fee: paid on top of each chip-in, into the House Fund. */
  coverBps: 50,
  /** Late fee per late chip-in, as a share of the chip-in. */
  lateBps: 200,
  /** Host fee cap, as a share of the kitty. */
  maxHostBps: 200,
  /** Bid night discount cap, as a share of the kitty. */
  maxDiscountBps: 3000,
} as const;

export const GRACE_HOURS = 72;

export type Tier = 0 | 1 | 2;

/** Trust credit τ by tier, as basis points (0.25 / 0.50 / 0.75). */
const TRUST_CREDIT_BPS = [2500, 5000, 7500] as const;

export const TIER_NAMES = ["Guest", "Regular", "Family"] as const;

export function dollars(n: number): number {
  return Math.round(n * MICRO);
}

function bps(amount: number, rate: number): number {
  // Round half away from zero at the micro-unit; dust goes to the House Fund on-chain.
  return Math.round((amount * rate) / 10_000);
}

/** Earliest seat (night) a tier may take the kitty on (product doc 7.3). */
export function earliestSeat(tier: Tier, guests: number): number {
  if (tier === 2) return 1;
  if (tier === 1) return Math.ceil(0.3 * guests) + 1;
  return Math.ceil(0.5 * guests) + 1;
}

/** Trust credit τ in bps; gate relaxation drops it one step (7.3). */
export function trustCreditBps(tier: Tier, gateRelaxed = false): number {
  const step = gateRelaxed ? tier - 1 : tier;
  return step < 0 ? 0 : TRUST_CREDIT_BPS[step];
}

/** What a guest pays each night: chip-in + Kitty fee + House fee (7.5, 10.1). */
export function perNightDue(chipIn: number) {
  const kittyFee = bps(chipIn, FEES.protocolBps);
  const houseFee = bps(chipIn, FEES.coverBps);
  return { chipIn, kittyFee, houseFee, total: chipIn + kittyFee + houseFee };
}

export interface TakeInput {
  /** Chip-in c, micro-units. */
  chipIn: number;
  /** Guests N. */
  guests: number;
  /** The night s this guest takes the kitty on (1…N). */
  night: number;
  tier: Tier;
  /** Host fee in bps of the kitty (0–200). */
  hostFeeBps: number;
  /** Plus-one stakes V, micro-units. */
  plusOnes?: number;
  /** Bid night discount d in bps of the kitty (0–3000). */
  discountBps?: number;
  gateRelaxed?: boolean;
}

export interface TakeResult {
  /** The kitty P = N·c. */
  kitty: number;
  /** Bid discount dP, shared back to guests who haven't taken the kitty. */
  discount: number;
  hostFee: number;
  /** Remaining obligation R = c(N − s). */
  remaining: number;
  /** Keepsafe L = max(0, R(1 − τ) − V). */
  keepsafe: number;
  /** Paid now = P − dP − fₒP − L. */
  paidNow: number;
  /** Keepsafe released per later chip-in: L·c / R. */
  releasePerChipIn: number;
}

/** Payout when a guest takes the kitty (product doc 7.5). */
export function takeTheKitty(input: TakeInput): TakeResult {
  const { chipIn, guests, night, tier, hostFeeBps } = input;
  if (guests < 4 || guests > 20) throw new RangeError("A party has 4–20 guests");
  if (night < 1 || night > guests) throw new RangeError("Night must be 1…N");
  if (hostFeeBps < 0 || hostFeeBps > FEES.maxHostBps) throw new RangeError("Host fee is 0–2%");
  const discountBps = input.discountBps ?? 0;
  if (discountBps < 0 || discountBps > FEES.maxDiscountBps) throw new RangeError("Bid is 0–30%");

  const kitty = guests * chipIn;
  const discount = bps(kitty, discountBps);
  const hostFee = bps(kitty, hostFeeBps);
  const remaining = chipIn * (guests - night);
  const tau = trustCreditBps(tier, input.gateRelaxed);
  const keepsafe = Math.max(0, remaining - bps(remaining, tau) - (input.plusOnes ?? 0));
  const paidNow = kitty - discount - hostFee - keepsafe;
  const releasePerChipIn = remaining === 0 ? 0 : Math.round((keepsafe * chipIn) / remaining);
  return { kitty, discount, hostFee, remaining, keepsafe, paidNow, releasePerChipIn };
}

/** Keepsafe left after the guest makes k more chip-ins: L(1 − kc/R). */
export function keepsafeAfter(take: Pick<TakeResult, "keepsafe" | "remaining">, chipIn: number, k: number): number {
  if (take.remaining === 0) return 0;
  const paid = Math.min(k * chipIn, take.remaining);
  return take.keepsafe - Math.round((take.keepsafe * paid) / take.remaining);
}

export interface WaterfallResult {
  missed: number;
  fromKeepsafe: number;
  fromPlusOnes: number;
  fromHouse: number;
}

/**
 * Default waterfall for a guest who has taken the kitty (7.7):
 * keepsafe → plus-ones → House Fund. Every other guest is paid in full.
 */
export function waterfall(missed: number, keepsafeLeft: number, plusOnesLeft = 0): WaterfallResult {
  const fromKeepsafe = Math.min(missed, keepsafeLeft);
  const fromPlusOnes = Math.min(missed - fromKeepsafe, plusOnesLeft);
  const fromHouse = missed - fromKeepsafe - fromPlusOnes;
  return { missed, fromKeepsafe, fromPlusOnes, fromHouse };
}

/** Late fee for one late chip-in (2% of c), paid to the House Fund. */
export function lateFee(chipIn: number): number {
  return bps(chipIn, FEES.lateBps);
}

/**
 * Settle up: repay what the House Fund covered plus a late fee per missed night
 * (product doc 6 "Cure", 9.1 "2% of c per late payment").
 */
export function settleUpAmount(fromHouse: number, missedNights: number, chipIn: number): number {
  return fromHouse + missedNights * lateFee(chipIn);
}

/**
 * Kitty limit (exposure cap, 11.1): 50% of everything contributed in finished
 * parties, plus a starter allowance of one chip-in.
 */
export function kittyLimit(lifetimeChippedIn: number, allowance: number): number {
  return Math.floor(lifetimeChippedIn / 2) + allowance;
}
