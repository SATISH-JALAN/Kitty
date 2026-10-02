import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as Z from "../src";

const here = dirname(fileURLToPath(import.meta.url));
const v = JSON.parse(readFileSync(join(here, "../../../../circuits/vectors/parity.json"), "utf8"));
const hex = (x: bigint) => x.toString(16).padStart(64, "0");

beforeAll(() => Z.initPoseidon());

describe("parity with the circuit and the program (circuits/vectors/parity.json)", () => {
  it("leaves and hashes", () => {
    expect(hex(Z.H(1n, 2n))).toBe(v.poseidon2.out);
    const s = BigInt("0x" + v.s);
    expect(hex(Z.nonceFor(s, 3n))).toBe(v.nonce3);
    expect(hex(Z.tagOf(s, 7n))).toBe(v.tag7);
    const slot = Object.fromEntries(Object.entries(v.slot).filter(([k]) => k !== "hash").map(([k, x]) => [k, BigInt(x as string)])) as unknown as Z.Slot;
    expect(hex(Z.slotHash(slot))).toBe(v.slot.hash);
    const note: Z.Note = { s, completed: 1n, late: 0n, paid: 500_000_000n, slots: [slot, Z.emptySlot(), Z.emptySlot(), Z.emptySlot()], nonce: Z.nonceFor(s, 3n), k: 3n };
    expect(hex(Z.noteCommitment(note))).toBe(v.noteCommitment);
    expect(hex(Z.nullifierOf(s, note.nonce))).toBe(v.nullifier);
    expect(hex(Z.receiptLeaf(Z.tagOf(s, 7n), 7n, 4n))).toBe(v.receipt.leaf);
    expect(hex(Z.completionLeaf(Z.tagOf(s, 7n), 7n, 10n, 1n, 100_000_000n))).toBe(v.completion.leaf);
  });

  it("params hashes and wallet split", () => {
    const w = Z.walletSplit(Z.fromHex(v.wallet.bytes));
    expect(hex(w.hi)).toBe(v.wallet.hi);
    expect(hex(w.lo)).toBe(v.wallet.lo);
    const u = Z.unlockedByTier(100_000_000n, 10n);
    expect(u.map(String)).toEqual(v.unlockedByTier.out);
    const j = v.paramsJoin;
    const jp: Z.JoinParams = {
      grace: BigInt(j.grace), party: BigInt(j.party), start: BigInt(j.start), period: BigInt(j.period), rounds: BigInt(j.rounds),
      unlockedByTier: u, minTier: BigInt(j.minTier), allowance: BigInt(j.allowance), wHi: w.hi, wLo: w.lo,
    };
    expect(hex(Z.paramsJoin(jp))).toBe(j.hash);
    expect(hex(Z.paramsComplete({ party: 7n, chipIn: 100_000_000n, rounds: 10n, wHi: w.hi, wLo: w.lo }))).toBe(v.paramsComplete.hash);
    expect(hex(Z.paramsHistory({ minCompleted: 3n, minPaid: 1_000_000_000n, maxLate: 0n, scope: 4242n, challenge: 777n }))).toBe(v.paramsHistory.hash);
  });

  it("tree roots", () => {
    const t = new Z.Tree();
    expect(t.zeros.map(hex)).toEqual(v.zeros);
    v.tree.leaves.forEach((l: string, i: number) => {
      t.append(BigInt("0x" + l));
      expect(hex(t.root())).toBe(v.tree.roots[i]);
    });
  });
});
