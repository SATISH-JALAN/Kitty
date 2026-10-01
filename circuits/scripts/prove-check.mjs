// Prove one JOIN with the real development zkey, verify it, and print the time (architecture 13: target < 10 s).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as snarkjs from "snarkjs";
import * as K from "../lib/kitty.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
await K.init();
const s = 987654321987654321n;
const tree = new K.Tree();
const note = K.freshNote(s);
tree.append(K.noteCommitment(note));
const w = K.walletSplit(new Uint8Array(32).fill(5));
const params = {
  party: 1n, grace: 120n, start: 1_790_000_600n, period: 180n, rounds: 10n,
  unlockedByTier: K.unlockedByTier(100_000_000n, 10n), minTier: 0n, allowance: 150_000_000n, wHi: w.hi, wLo: w.lo,
};
const input = K.buildInput({ mode: K.MODE.JOIN, note, tree, now: 1_790_000_000n, sel: [1, 0, 0, 0], params, newNonce: K.nonceFor(s, 1n) });
const t0 = Date.now();
const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, join(root, "keys/kitty_action.wasm"), join(root, "keys/kitty_action.zkey"));
const secs = (Date.now() - t0) / 1000;
const vk = JSON.parse(readFileSync(join(root, "keys/kitty_action_vk.json"), "utf8"));
console.log({ proveSecs: secs, verified: await snarkjs.groth16.verify(vk, publicSignals, proof), publicSignals });
process.exit(0);
