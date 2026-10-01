// The Kitty data model in JS: Poseidon leaves, the depth-26 tree, params hashes and witness
// builders for kitty_action.circom. Byte-for-byte the same as the circuit and the program
// (checked by the parity vectors in ../vectors).
import { buildPoseidon } from "circomlibjs";

export const D = 26;
export const K = 4;
export const MODE = { JOIN: 0, COMPLETE: 1, HISTORY: 2 };
const DOMAIN = { NOTE: 1n, RECEIPT: 2n, COMPLETION: 3n };
const NONCE_DOMAIN = 7n;

/** Trust credit τ by tier, in bps (product doc 8.1). */
export const TRUST_CREDIT_BPS = [2500n, 5000n, 7500n];

let poseidon;
export async function init() {
  if (!poseidon) poseidon = await buildPoseidon();
}
/** Poseidon over field elements (bigint-ish), returns a bigint. */
export function H(...xs) {
  if (!poseidon) throw new Error("call init() first");
  return poseidon.F.toObject(poseidon(xs.map((x) => BigInt(x))));
}

// ---------------------------------------------------------------- leaves

export const emptySlot = () => ({ party: 0n, dueStart: 0n, period: 0n, rounds: 0n, active: 0n, unlocked: 0n });
export const slotHash = (x) => H(x.party, x.dueStart, x.period, x.rounds, x.active, x.unlocked);
export const noteState = (n) => H(n.completed, n.late, n.paid, ...n.slots.map(slotHash));
export const noteCommitment = (n) => H(DOMAIN.NOTE, n.s, noteState(n), n.nonce);
export const nullifier = (s, nonce) => H(s, nonce);
export const tagOf = (s, party) => H(s, party);
export const pseudonym = (s, scope) => H(s, scope);
export const receiptLeaf = (tag, party, paidThrough) => H(DOMAIN.RECEIPT, tag, party, paidThrough);
export const completionLeaf = (tag, party, paidRounds, lateCount, chipIn) =>
  H(DOMAIN.COMPLETION, tag, party, H(paidRounds, lateCount, chipIn));
/** Deterministic note nonces (architecture 5.3): nonce_k = H(s, 7, k). */
export const nonceFor = (s, k) => H(s, NONCE_DOMAIN, k);

/** A fresh note: no parties, tier 0. */
export function freshNote(s, k = 0n) {
  return { s: BigInt(s), completed: 0n, late: 0n, paid: 0n, slots: [0, 1, 2, 3].map(emptySlot), nonce: nonceFor(s, k), k: BigInt(k) };
}

/** Split a 32-byte wallet public key into two 128-bit field elements (big-endian halves). */
export function walletSplit(bytes) {
  const hex = Buffer.from(bytes).toString("hex").padStart(64, "0");
  return { hi: BigInt("0x" + hex.slice(0, 32)), lo: BigInt("0x" + hex.slice(32)) };
}

// ---------------------------------------------------------------- party maths (matches @kitty/sdk fees.ts)

const ceilDiv = (a, b) => (a + b - 1n) / b;
/** Earliest seat (night) a tier may take the kitty on (product doc 7.3). */
export function earliestSeat(tier, guests) {
  const n = BigInt(guests);
  if (tier === 2) return 1n;
  if (tier === 1) return ceilDiv(3n * n, 10n) + 1n;
  return ceilDiv(5n * n, 10n) + 1n;
}
/** bps with round-half-up (amounts are never negative). */
export const bps = (amount, rate) => (BigInt(amount) * BigInt(rate) + 5000n) / 10000n;
/** Worst-case unlocked obligation R·τ if seated at the tier's earliest seat, per tier. */
export function unlockedByTier(chipIn, guests) {
  return [0, 1, 2].map((t) => bps(BigInt(chipIn) * (BigInt(guests) - earliestSeat(t, guests)), TRUST_CREDIT_BPS[t]));
}

// ---------------------------------------------------------------- params hashes

export function paramsJoin(p) {
  const u = p.unlockedByTier;
  return H(p.grace, p.party, p.start, p.period, p.rounds, u[0], u[1], u[2], p.minTier, p.allowance, p.wHi, p.wLo);
}
export const paramsComplete = (p) => H(p.party, p.chipIn, p.rounds, p.wHi, p.wLo);
export const paramsHistory = (p) => H(p.minCompleted, p.minPaid, p.maxLate, p.scope, p.challenge);

// ---------------------------------------------------------------- tree

/** Incremental sparse Poseidon Merkle tree, empty leaf = 0, zeros[i+1] = H(zeros[i], zeros[i]). */
export class Tree {
  constructor(depth = D) {
    this.depth = depth;
    this.zeros = [0n];
    for (let i = 1; i <= depth; i++) this.zeros.push(H(this.zeros[i - 1], this.zeros[i - 1]));
    this.levels = Array.from({ length: depth + 1 }, () => new Map());
    this.size = 0;
  }
  node(d, i) {
    const v = this.levels[d].get(i);
    return v === undefined ? this.zeros[d] : v;
  }
  /** Append a leaf, returns its index. */
  append(leaf) {
    const index = this.size++;
    let i = index;
    this.levels[0].set(i, BigInt(leaf));
    for (let d = 0; d < this.depth; d++) {
      const p = i >> 1;
      this.levels[d + 1].set(p, H(this.node(d, p * 2), this.node(d, p * 2 + 1)));
      i = p;
    }
    return index;
  }
  root() {
    return this.node(this.depth, 0);
  }
  path(index) {
    const els = [];
    const bits = [];
    let i = index;
    for (let d = 0; d < this.depth; d++) {
      els.push(this.node(d, i ^ 1));
      bits.push(BigInt(i & 1));
      i >>= 1;
    }
    return { els, bits };
  }
  indexOf(leaf) {
    const v = BigInt(leaf);
    for (const [i, x] of this.levels[0]) if (x === v) return i;
    return -1;
  }
}

// ---------------------------------------------------------------- witness

const zeroPath = () => ({ els: Array(D).fill(0n), bits: Array(D).fill(0n) });
const str = (v) => (Array.isArray(v) ? v.map(str) : v.toString());

/**
 * Build the circuit input for one action.
 * @param o.mode       MODE.*
 * @param o.note       the current note (with .s, .nonce, counters, slots)
 * @param o.newNonce   nonce of the next note
 * @param o.tree       a Tree holding the note and any receipts / completion leaf
 * @param o.now        unix seconds
 * @param o.receipts   per slot index: { paidThrough, index } (active slots, JOIN/HISTORY)
 * @param o.sel        one-hot slot selection (JOIN: a free slot; COMPLETE: the party's slot)
 * @param o.params     the mode's parameters (see paramsJoin / paramsComplete / paramsHistory)
 * @param o.completion COMPLETE: { paidRounds, lateCount, index }
 */
export function buildInput(o) {
  const { mode, note, tree } = o;
  const p = { ...defaults(), ...o.params };
  const noteIdx = tree.indexOf(noteCommitment(note));
  if (noteIdx < 0) throw new Error("note not in tree");
  const np = tree.path(noteIdx);
  const rc = note.slots.map((_, k) => {
    const r = o.receipts?.[k];
    return r ? { paid: BigInt(r.paidThrough), path: tree.path(r.index) } : { paid: 0n, path: zeroPath() };
  });
  const cp = o.completion ? tree.path(o.completion.index) : zeroPath();
  const paramsHash = mode === MODE.JOIN ? paramsJoin(p) : mode === MODE.COMPLETE ? paramsComplete(p) : paramsHistory(p);
  const input = {
    root: tree.root(),
    now: BigInt(o.now),
    paramsHash: o.paramsHashOverride ?? paramsHash,
    mode: BigInt(mode),
    s: note.s,
    completed: note.completed,
    late: note.late,
    lifetimePaid: note.paid,
    oldNonce: note.nonce,
    newNonce: o.newNonce ?? 0n,
    slotParty: note.slots.map((x) => x.party),
    slotDueStart: note.slots.map((x) => x.dueStart),
    slotPeriod: note.slots.map((x) => x.period),
    slotRounds: note.slots.map((x) => x.rounds),
    slotActive: note.slots.map((x) => x.active),
    slotUnlocked: note.slots.map((x) => x.unlocked),
    notePath: np.els,
    noteIdx: np.bits,
    rcptPaid: rc.map((r) => r.paid),
    rcptPath: rc.map((r) => r.path.els),
    rcptIdx: rc.map((r) => r.path.bits),
    sel: (o.sel ?? [0, 0, 0, 0]).map(BigInt),
    party: p.party,
    wHi: p.wHi,
    wLo: p.wLo,
    grace: p.grace,
    start: p.start,
    period: p.period,
    rounds: p.rounds,
    unlockedByTier: p.unlockedByTier,
    minTier: p.minTier,
    allowance: p.allowance,
    chipIn: p.chipIn,
    paidRounds: o.completion ? BigInt(o.completion.paidRounds) : 0n,
    lateCount: o.completion ? BigInt(o.completion.lateCount) : 0n,
    compPath: cp.els,
    compIdx: cp.bits,
    minCompleted: p.minCompleted,
    minPaid: p.minPaid,
    maxLate: p.maxLate,
    scope: p.scope,
    challenge: p.challenge,
  };
  return Object.fromEntries(Object.entries(input).map(([k, v]) => [k, str(v)]));
}

function defaults() {
  return {
    party: 0n, wHi: 0n, wLo: 0n, grace: 0n, start: 0n, period: 0n, rounds: 0n,
    unlockedByTier: [0n, 0n, 0n], minTier: 0n, allowance: 0n, chipIn: 0n,
    minCompleted: 0n, minPaid: 0n, maxLate: 0n, scope: 0n, challenge: 0n,
  };
}

/** The note after an action, as the circuit computes it (the device stores this). */
export function nextNote(o) {
  const { mode, note } = o;
  const p = { ...defaults(), ...o.params };
  const slots = note.slots.map((x) => ({ ...x }));
  const k = (o.sel ?? []).findIndex((v) => Number(v) === 1);
  let { completed, late, paid } = note;
  if (mode === MODE.JOIN) {
    const tier = note.completed >= 3n ? 2 : note.completed >= 1n ? 1 : 0;
    slots[k] = {
      party: BigInt(p.party), dueStart: BigInt(p.start) + BigInt(p.grace), period: BigInt(p.period),
      rounds: BigInt(p.rounds), active: 1n, unlocked: BigInt(p.unlockedByTier[tier]),
    };
  } else if (mode === MODE.COMPLETE) {
    slots[k] = emptySlot();
    const c = o.completion;
    const full = BigInt(c.paidRounds) === BigInt(p.rounds) && BigInt(c.lateCount) <= 1n;
    completed += full ? 1n : 0n;
    late += BigInt(c.lateCount);
    paid += BigInt(c.paidRounds) * BigInt(p.chipIn);
  } else {
    return note;
  }
  return { ...note, completed, late, paid, slots, nonce: o.newNonce, k: (note.k ?? 0n) + 1n };
}
