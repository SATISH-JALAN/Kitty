// Hash-parity vectors (architecture 13): the same inputs must give byte-equal outputs in the
// circuit (circomlibjs), the program (sol_poseidon) and the app. Writes vectors/parity.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as K from "../lib/kitty.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await K.init();
const s = 0x1234567890abcdef1234567890abcdefn;
const wallet = K.walletSplit(Uint8Array.from({ length: 32 }, (_, i) => i + 1));
const slot = { party: 7n, dueStart: 1_790_000_120n, period: 180n, rounds: 10n, active: 1n, unlocked: 225_000_000n };
const note = { s, completed: 1n, late: 0n, paid: 500_000_000n, slots: [slot, K.emptySlot(), K.emptySlot(), K.emptySlot()], nonce: K.nonceFor(s, 3n) };
const jp = {
  grace: 120n, party: 7n, start: 1_790_000_000n, period: 180n, rounds: 10n,
  unlockedByTier: K.unlockedByTier(100_000_000n, 10n), minTier: 0n, allowance: 150_000_000n, wHi: wallet.hi, wLo: wallet.lo,
};
const tree = new K.Tree();
const leaves = [1n, 2n, 3n, K.noteCommitment(note), K.receiptLeaf(K.tagOf(s, 7n), 7n, 4n)];
const roots = leaves.map((l) => (tree.append(l), tree.root()));

const hex = (x) => BigInt(x).toString(16).padStart(64, "0");
const v = {
  note: "all values are 32-byte big-endian hex field elements unless named otherwise",
  poseidon2: { in: [hex(1n), hex(2n)], out: hex(K.H(1n, 2n)) },
  zeros: tree.zeros.map(hex),
  s: hex(s),
  nonce3: hex(K.nonceFor(s, 3n)),
  tag7: hex(K.tagOf(s, 7n)),
  nullifier: hex(K.nullifier(s, note.nonce)),
  slot: { ...Object.fromEntries(Object.entries(slot).map(([k, x]) => [k, x.toString()])), hash: hex(K.slotHash(slot)) },
  noteCommitment: hex(K.noteCommitment(note)),
  receipt: { tag: hex(K.tagOf(s, 7n)), party: "7", paidThrough: "4", leaf: hex(K.receiptLeaf(K.tagOf(s, 7n), 7n, 4n)) },
  completion: { tag: hex(K.tagOf(s, 7n)), party: "7", paidRounds: "10", lateCount: "1", chipIn: "100000000", leaf: hex(K.completionLeaf(K.tagOf(s, 7n), 7n, 10n, 1n, 100_000_000n)) },
  wallet: { bytes: Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => i + 1)).toString("hex"), hi: hex(wallet.hi), lo: hex(wallet.lo) },
  unlockedByTier: { chipIn: "100000000", guests: "10", out: jp.unlockedByTier.map(String) },
  paramsJoin: { ...Object.fromEntries(Object.entries(jp).map(([k, x]) => [k, Array.isArray(x) ? x.map(String) : x.toString()])), hash: hex(K.paramsJoin(jp)) },
  paramsComplete: { party: "7", chipIn: "100000000", rounds: "10", hash: hex(K.paramsComplete({ party: 7n, chipIn: 100_000_000n, rounds: 10n, wHi: wallet.hi, wLo: wallet.lo })) },
  paramsHistory: { minCompleted: "3", minPaid: "1000000000", maxLate: "0", scope: "4242", challenge: "777", hash: hex(K.paramsHistory({ minCompleted: 3n, minPaid: 1_000_000_000n, maxLate: 0n, scope: 4242n, challenge: 777n })) },
  tree: { leaves: leaves.map(hex), roots: roots.map(hex) },
};
mkdirSync(join(root, "vectors"), { recursive: true });
writeFileSync(join(root, "vectors/parity.json"), JSON.stringify(v, null, 1) + "\n");
console.log("wrote vectors/parity.json");
