/// <reference path="./shims.d.ts" />
/**
 * The Kitty data model: Poseidon leaves, the depth-26 tree, params hashes and the circuit input
 * builder. The TypeScript twin of circuits/lib/kitty.mjs; circuits/vectors/parity.json keeps the
 * circuit, the program and this file byte-equal (test/parity.test.ts).
 */
import { buildPoseidon } from "circomlibjs";

export const D = 26;
export const K = 4;
export const MODE = { JOIN: 0, COMPLETE: 1, HISTORY: 2 } as const;
export type Mode = (typeof MODE)[keyof typeof MODE];
const DOMAIN = { NOTE: 1n, RECEIPT: 2n, COMPLETION: 3n } as const;
const NONCE_DOMAIN = 7n;
/** Trust credit τ by tier, in bps (product doc 8.1). */
export const TRUST_CREDIT_BPS = [2500n, 5000n, 7500n] as const;
/** BN254 scalar field. */
export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

type Num = bigint | number | string;
let poseidon: Awaited<ReturnType<typeof buildPoseidon>> | undefined;

export async function initPoseidon(): Promise<void> {
  if (!poseidon) poseidon = await buildPoseidon();
}
/** Poseidon over field elements. Call `initPoseidon()` once first. */
export function H(...xs: Num[]): bigint {
  if (!poseidon) throw new Error("initPoseidon() first");
  return poseidon.F.toObject(poseidon(xs.map((x) => BigInt(x))));
}

// ---------------------------------------------------------------- leaves

export interface Slot {
  party: bigint;
  /** start + grace: when round 1 must be paid by. */
  dueStart: bigint;
  period: bigint;
  rounds: bigint;
  active: bigint;
  /** Worst-case unlocked obligation for this party (kitty limit). */
  unlocked: bigint;
}
export interface Note {
  s: bigint;
  completed: bigint;
  late: bigint;
  paid: bigint;
  slots: Slot[];
  nonce: bigint;
  /** Index k of this note's nonce: nonce = H(s, 7, k). */
  k: bigint;
}

export const emptySlot = (): Slot => ({ party: 0n, dueStart: 0n, period: 0n, rounds: 0n, active: 0n, unlocked: 0n });
export const slotHash = (x: Slot) => H(x.party, x.dueStart, x.period, x.rounds, x.active, x.unlocked);
export const noteState = (n: Note) => H(n.completed, n.late, n.paid, ...n.slots.map(slotHash));
export const noteCommitment = (n: Note) => H(DOMAIN.NOTE, n.s, noteState(n), n.nonce);
export const nullifierOf = (s: Num, nonce: Num) => H(s, nonce);
export const tagOf = (s: Num, party: Num) => H(s, party);
export const pseudonymOf = (s: Num, scope: Num) => H(s, scope);
export const receiptLeaf = (tag: Num, party: Num, paidThrough: Num) => H(DOMAIN.RECEIPT, tag, party, paidThrough);
export const completionLeaf = (tag: Num, party: Num, paidRounds: Num, lateCount: Num, chipIn: Num) =>
  H(DOMAIN.COMPLETION, tag, party, H(paidRounds, lateCount, chipIn));
/** Deterministic note nonces (architecture 5.3): nonce_k = H(s, 7, k). */
export const nonceFor = (s: Num, k: Num) => H(s, NONCE_DOMAIN, k);

/** A fresh note: no parties, tier 0. */
export function freshNote(s: bigint): Note {
  return { s, completed: 0n, late: 0n, paid: 0n, slots: [emptySlot(), emptySlot(), emptySlot(), emptySlot()], nonce: nonceFor(s, 0n), k: 0n };
}

export function tierOf(completed: bigint): 0 | 1 | 2 {
  return completed >= 3n ? 2 : completed >= 1n ? 1 : 0;
}

/** A 32-byte wallet key as two 128-bit field elements (big-endian halves). */
export function walletSplit(bytes: Uint8Array): { hi: bigint; lo: bigint } {
  return { hi: bytesToBig(bytes.subarray(0, 16)), lo: bytesToBig(bytes.subarray(16, 32)) };
}

// ---------------------------------------------------------------- party maths (matches @kitty/sdk + the program)

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
export function earliestSeat(tier: number, guests: Num): bigint {
  const n = BigInt(guests);
  if (tier === 2) return 1n;
  if (tier === 1) return ceilDiv(3n * n, 10n) + 1n;
  return ceilDiv(5n * n, 10n) + 1n;
}
export const bps = (amount: Num, rate: Num) => (BigInt(amount) * BigInt(rate) + 5000n) / 10000n;
export function unlockedByTier(chipIn: Num, guests: Num): [bigint, bigint, bigint] {
  const u = [0, 1, 2].map((t) => bps(BigInt(chipIn) * (BigInt(guests) - earliestSeat(t, guests)), TRUST_CREDIT_BPS[t]));
  return [u[0], u[1], u[2]];
}

// ---------------------------------------------------------------- params hashes

export interface JoinParams {
  party: bigint;
  grace: bigint;
  start: bigint;
  period: bigint;
  rounds: bigint;
  unlockedByTier: [bigint, bigint, bigint];
  minTier: bigint;
  allowance: bigint;
  wHi: bigint;
  wLo: bigint;
}
export interface CompleteParams {
  party: bigint;
  chipIn: bigint;
  rounds: bigint;
  wHi: bigint;
  wLo: bigint;
}
export interface HistoryParams {
  minCompleted: bigint;
  minPaid: bigint;
  maxLate: bigint;
  scope: bigint;
  challenge: bigint;
}

export function paramsJoin(p: JoinParams): bigint {
  const u = p.unlockedByTier;
  return H(p.grace, p.party, p.start, p.period, p.rounds, u[0], u[1], u[2], p.minTier, p.allowance, p.wHi, p.wLo);
}
export const paramsComplete = (p: CompleteParams) => H(p.party, p.chipIn, p.rounds, p.wHi, p.wLo);
export const paramsHistory = (p: HistoryParams) => H(p.minCompleted, p.minPaid, p.maxLate, p.scope, p.challenge);

// ---------------------------------------------------------------- tree

/** Incremental sparse Poseidon Merkle tree; empty leaf 0 (same as the program's `KittyTree`). */
export class Tree {
  readonly depth: number;
  readonly zeros: bigint[];
  private levels: Map<number, bigint>[];
  size = 0;
  private index = new Map<bigint, number>();

  constructor(depth = D) {
    this.depth = depth;
    this.zeros = [0n];
    for (let i = 1; i <= depth; i++) this.zeros.push(H(this.zeros[i - 1], this.zeros[i - 1]));
    this.levels = Array.from({ length: depth + 1 }, () => new Map<number, bigint>());
  }
  private node(d: number, i: number): bigint {
    return this.levels[d].get(i) ?? this.zeros[d];
  }
  append(leaf: Num): number {
    const at = this.size++;
    const v = BigInt(leaf);
    this.levels[0].set(at, v);
    if (!this.index.has(v)) this.index.set(v, at);
    let i = at;
    for (let d = 0; d < this.depth; d++) {
      const p = i >> 1;
      this.levels[d + 1].set(p, H(this.node(d, p * 2), this.node(d, p * 2 + 1)));
      i = p;
    }
    return at;
  }
  root(): bigint {
    return this.node(this.depth, 0);
  }
  leaf(i: number): bigint {
    return this.node(0, i);
  }
  path(index: number): { els: bigint[]; bits: bigint[] } {
    const els: bigint[] = [];
    const bits: bigint[] = [];
    let i = index;
    for (let d = 0; d < this.depth; d++) {
      els.push(this.node(d, i ^ 1));
      bits.push(BigInt(i & 1));
      i >>= 1;
    }
    return { els, bits };
  }
  /** First index of a leaf value, or -1. */
  indexOf(leaf: Num): number {
    return this.index.get(BigInt(leaf)) ?? -1;
  }
  /** Last index of a leaf value (receipts can repeat), or -1. */
  lastIndexOf(leaf: Num): number {
    const v = BigInt(leaf);
    for (let i = this.size - 1; i >= 0; i--) if (this.levels[0].get(i) === v) return i;
    return -1;
  }
}

// ---------------------------------------------------------------- circuit input

export interface ActionInput {
  mode: Mode;
  note: Note;
  newNonce?: bigint;
  tree: Tree;
  now: bigint;
  /** Per slot index: the receipt proving that party is paid up (JOIN, HISTORY). */
  receipts?: Partial<Record<number, { paidThrough: bigint; index: number }>>;
  /** One-hot slot selection: JOIN a free slot, COMPLETE the party's slot. */
  sel?: number[];
  params: Partial<JoinParams & CompleteParams & HistoryParams>;
  /** COMPLETE: the completion leaf. */
  completion?: { paidRounds: bigint; lateCount: bigint; index: number };
}

const DEFAULT_PARAMS = {
  party: 0n, wHi: 0n, wLo: 0n, grace: 0n, start: 0n, period: 0n, rounds: 0n,
  unlockedByTier: [0n, 0n, 0n] as [bigint, bigint, bigint], minTier: 0n, allowance: 0n, chipIn: 0n,
  minCompleted: 0n, minPaid: 0n, maxLate: 0n, scope: 0n, challenge: 0n,
};

export function paramsHashFor(a: ActionInput): bigint {
  const p = { ...DEFAULT_PARAMS, ...a.params };
  return a.mode === MODE.JOIN ? paramsJoin(p) : a.mode === MODE.COMPLETE ? paramsComplete(p) : paramsHistory(p);
}

const zeroPath = () => ({ els: Array<bigint>(D).fill(0n), bits: Array<bigint>(D).fill(0n) });
type Signal = string | Signal[];
const str = (v: unknown): Signal => (Array.isArray(v) ? v.map(str) : String(v));

/** The snarkjs input object for kitty_action.circom. */
export function buildInput(a: ActionInput): Record<string, Signal> {
  const { note, tree } = a;
  const p = { ...DEFAULT_PARAMS, ...a.params };
  const at = tree.lastIndexOf(noteCommitment(note));
  if (at < 0) throw new Error("note not in tree");
  const np = tree.path(at);
  const rc = note.slots.map((_, k) => {
    const r = a.receipts?.[k];
    return r ? { paid: r.paidThrough, path: tree.path(r.index) } : { paid: 0n, path: zeroPath() };
  });
  const cp = a.completion ? tree.path(a.completion.index) : zeroPath();
  const input = {
    root: tree.root(),
    now: a.now,
    paramsHash: paramsHashFor(a),
    mode: BigInt(a.mode),
    s: note.s,
    completed: note.completed,
    late: note.late,
    lifetimePaid: note.paid,
    oldNonce: note.nonce,
    newNonce: a.newNonce ?? 0n,
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
    sel: (a.sel ?? [0, 0, 0, 0]).map(BigInt),
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
    paidRounds: a.completion?.paidRounds ?? 0n,
    lateCount: a.completion?.lateCount ?? 0n,
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

/** The note after an action, exactly as the circuit computes it (the Diary stores this). */
export function nextNote(a: ActionInput): Note {
  const { note } = a;
  const p = { ...DEFAULT_PARAMS, ...a.params };
  if (a.mode === MODE.HISTORY) return note;
  const slots = note.slots.map((x) => ({ ...x }));
  const k = (a.sel ?? []).findIndex((v) => v === 1);
  let { completed, late, paid } = note;
  if (a.mode === MODE.JOIN) {
    slots[k] = {
      party: p.party, dueStart: p.start + p.grace, period: p.period, rounds: p.rounds,
      active: 1n, unlocked: p.unlockedByTier[tierOf(note.completed)],
    };
  } else {
    const c = a.completion!;
    slots[k] = emptySlot();
    const full = c.paidRounds === p.rounds && c.lateCount <= 1n;
    completed += full ? 1n : 0n;
    late += c.lateCount;
    paid += c.paidRounds * p.chipIn;
  }
  return { ...note, completed, late, paid, slots, nonce: a.newNonce!, k: note.k + 1n };
}

export { bytesToBig, bigToBytes32, toHex, fromHex } from "./bytes";
import { bytesToBig } from "./bytes";
