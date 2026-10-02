/// <reference lib="webworker" />
/// <reference path="./shims.d.ts" />
/**
 * The prover worker (architecture 8.2 `zk`). Everything cryptographic that needs Poseidon or
 * snarkjs runs here, off the main thread: the identity secret, the Kitty tree, witnesses and
 * proofs. The device's secrets reach this worker and nowhere else.
 */
import * as Comlink from "comlink";
import * as snarkjs from "snarkjs";
import * as Z from "./model";
import { actionSignals, aadhaarSignals, proofToSolana } from "./solana";
import { AADHAAR_ARTIFACTS, aadhaarInput, makeTestQr } from "./aadhaar";
import { aadhaarZkey, artifact, hasCached, type Progress } from "./artifacts";

export interface ArtifactRef {
  url: string;
  sha256?: string;
  bytes?: number;
}
export interface Artifacts {
  wasm: ArtifactRef;
  zkey: ArtifactRef;
}

/** A note with bigints as decimal strings (the Diary's format). */
export interface NoteJson {
  s: string;
  completed: string;
  late: string;
  paid: string;
  slots: { party: string; dueStart: string; period: string; rounds: string; active: string; unlocked: string }[];
  nonce: string;
  k: string;
}
const toNote = (n: NoteJson): Z.Note => ({
  s: BigInt(n.s), completed: BigInt(n.completed), late: BigInt(n.late), paid: BigInt(n.paid), nonce: BigInt(n.nonce), k: BigInt(n.k),
  slots: n.slots.map((x) => ({ party: BigInt(x.party), dueStart: BigInt(x.dueStart), period: BigInt(x.period), rounds: BigInt(x.rounds), active: BigInt(x.active), unlocked: BigInt(x.unlocked) })),
});
const fromNote = (n: Z.Note): NoteJson => ({
  s: n.s.toString(), completed: n.completed.toString(), late: n.late.toString(), paid: n.paid.toString(), nonce: n.nonce.toString(), k: n.k.toString(),
  slots: n.slots.map((x) => ({ party: x.party.toString(), dueStart: x.dueStart.toString(), period: x.period.toString(), rounds: x.rounds.toString(), active: x.active.toString(), unlocked: x.unlocked.toString() })),
});

export interface ActionRequest {
  mode: 0 | 1 | 2;
  note: NoteJson;
  now: number;
  /** Party wallet (base58 decoded to bytes by the caller) for JOIN / COMPLETE. */
  wallet?: Uint8Array;
  params: Record<string, string | string[]>;
  /** COMPLETE: the Farewell record. */
  completion?: { paidRounds: number; lateCount: number };
}

export interface ProofResult {
  proof: { a: Uint8Array; b: Uint8Array; c: Uint8Array };
  signals: ReturnType<typeof actionSignals>;
  publicSignals: string[];
  rawProof: snarkjs.Groth16Proof;
  nextNote: NoteJson;
}

let tree: Z.Tree | null = null;
let ready: Promise<void> | null = null;
const init = () => (ready ??= Z.initPoseidon().then(() => void (tree = new Z.Tree())));

const big = (v: string | string[] | undefined) => BigInt((v as string) ?? "0");

const api = {
  async init() {
    await init();
  },

  /** s = Poseidon(seed mod p) (architecture 5.3). */
  async secretFromSeed(seedHex: string): Promise<string> {
    await init();
    return Z.H(BigInt("0x" + seedHex) % Z.FIELD).toString();
  },
  async freshNote(s: string): Promise<{ note: NoteJson; commitment: string }> {
    await init();
    const n = Z.freshNote(BigInt(s));
    return { note: fromNote(n), commitment: Z.noteCommitment(n).toString() };
  },
  async commitment(note: NoteJson): Promise<string> {
    await init();
    return Z.noteCommitment(toNote(note)).toString();
  },
  async tag(s: string, party: string): Promise<string> {
    await init();
    return Z.tagOf(BigInt(s), BigInt(party)).toString(16).padStart(64, "0");
  },

  // ------------------------------------------------------------ the Kitty tree

  async treeSize(): Promise<number> {
    await init();
    return tree!.size;
  },
  /** Append leaves (hex) starting at `from`; returns the new size and root. */
  async appendLeaves(from: number, leaves: string[]): Promise<{ size: number; root: string }> {
    await init();
    if (from !== tree!.size) throw new Error(`tree out of step: have ${tree!.size}, got ${from}`);
    for (const l of leaves) tree!.append(BigInt("0x" + l));
    return { size: tree!.size, root: tree!.root().toString(16).padStart(64, "0") };
  },
  async resetTree() {
    await init();
    tree = new Z.Tree();
  },
  /** Is this note (still) in the tree? */
  async hasLeaf(value: string): Promise<boolean> {
    await init();
    return tree!.indexOf(BigInt(value)) >= 0;
  },

  // ------------------------------------------------------------ proofs

  async proveAction(req: ActionRequest, artifacts: Artifacts, onProgress?: (p: { step: "keys" | "proof"; loaded?: number; total?: number }) => void): Promise<ProofResult> {
    await init();
    const t = tree!;
    const note = toNote(req.note);
    const s = note.s;
    const p = req.params;
    const w = req.wallet ? Z.walletSplit(req.wallet) : { hi: 0n, lo: 0n };
    // Receipts: the latest one for every active party (good standing).
    const receipts: Z.ActionInput["receipts"] = {};
    note.slots.forEach((slot, k) => {
      if (slot.active !== 1n) return;
      const tag = Z.tagOf(s, slot.party);
      for (let paid = slot.rounds; paid >= 1n; paid--) {
        const i = t.lastIndexOf(Z.receiptLeaf(tag, slot.party, paid));
        if (i >= 0) {
          receipts[k] = { paidThrough: paid, index: i };
          return;
        }
      }
    });
    let sel = [0, 0, 0, 0];
    let completion: Z.ActionInput["completion"];
    if (req.mode === 0) {
      const free = note.slots.findIndex((x) => x.active === 0n);
      if (free < 0) throw new Error("four parties already: finish one first");
      sel[free] = 1;
    } else if (req.mode === 1) {
      const party = big(p.party);
      sel = note.slots.map((x) => (x.active === 1n && x.party === party ? 1 : 0));
      const c = req.completion!;
      const leaf = Z.completionLeaf(Z.tagOf(s, party), party, c.paidRounds, c.lateCount, big(p.chipIn));
      const index = t.lastIndexOf(leaf);
      if (index < 0) throw new Error("the Farewell leaf isn't in the tree yet");
      completion = { paidRounds: BigInt(c.paidRounds), lateCount: BigInt(c.lateCount), index };
    }
    const action: Z.ActionInput = {
      mode: req.mode,
      note,
      newNonce: Z.nonceFor(s, note.k + 1n),
      tree: t,
      now: BigInt(req.now),
      receipts,
      sel,
      completion,
      params: {
        party: big(p.party), grace: big(p.grace), start: big(p.start), period: big(p.period), rounds: big(p.rounds),
        unlockedByTier: ((p.unlockedByTier as string[]) ?? ["0", "0", "0"]).map(BigInt) as [bigint, bigint, bigint],
        minTier: big(p.minTier), allowance: big(p.allowance), chipIn: big(p.chipIn), wHi: w.hi, wLo: w.lo,
        minCompleted: big(p.minCompleted), minPaid: big(p.minPaid), maxLate: big(p.maxLate), scope: big(p.scope), challenge: big(p.challenge),
      },
    };
    const input = Z.buildInput(action);
    const progress: Progress = (loaded, total) => onProgress?.({ step: "keys", loaded, total });
    const wasm = await artifact(artifacts.wasm.url, { ...artifacts.wasm, onProgress: progress });
    const zkey = await artifact(artifacts.zkey.url, { ...artifacts.zkey, onProgress: progress });
    onProgress?.({ step: "proof" });
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey);
    return { proof: proofToSolana(proof), signals: actionSignals(publicSignals), publicSignals, rawProof: proof, nextNote: fromNote(Z.nextNote(action)) };
  },

  async makeTestQr(): Promise<string> {
    return makeTestQr();
  },

  async aadhaarKeysCached(): Promise<boolean> {
    return hasCached("aadhaar-v2-zkey-9");
  },

  /** Guest Pass: an Anon Aadhaar proof whose signal is the first note commitment. */
  async proveRegistration(qrData: string, nullifierSeed: string, firstCommitment: string, onProgress?: (p: { step: "keys" | "proof"; loaded?: number; total?: number }) => void) {
    const input = await aadhaarInput(qrData, BigInt(nullifierSeed), BigInt(firstCommitment));
    const wasm = await artifact(`${AADHAAR_ARTIFACTS}/aadhaar-verifier.wasm`, { onProgress: (l, t) => onProgress?.({ step: "keys", loaded: l, total: t + 282 * 1024 * 1024 }) });
    const zkey = await aadhaarZkey(AADHAAR_ARTIFACTS, (l, t) => onProgress?.({ step: "keys", loaded: wasm.length + l, total: wasm.length + t }));
    onProgress?.({ step: "proof" });
    // Single-threaded: the 1.1M-constraint proof runs out of memory when split across workers.
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasm, zkey, undefined, undefined, { singleThread: true });
    return { proof: proofToSolana(proof), signals: aadhaarSignals(publicSignals), publicSignals };
  },
};

export type ProverApi = typeof api;
Comlink.expose(api);
