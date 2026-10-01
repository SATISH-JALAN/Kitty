// Development Groth16 setup for kitty_action (architecture 5.4): a public 2^16 ptau, then two
// phase-2 contributions. Writes keys/ (zkey, vk.json, manifest with SHA-256 hashes) and the
// program's verifying key, contracts/programs/kitty/src/vk/kitty_action.rs.
// Not a ceremony: development keys for devnet only.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as snarkjs from "snarkjs";
import { vkToRust } from "../lib/solana.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const keys = join(root, "keys");
mkdirSync(keys, { recursive: true });
mkdirSync(join(root, "ptau"), { recursive: true });

// The Hermez mirrors are gone; PSE's perpetual powers of tau (prepared, 2^16) is the public replacement.
const PTAU = join(root, "ptau/ppot_0080_16.ptau");
const PTAU_URL = "https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_16.ptau";
if (!existsSync(PTAU)) {
  console.log(`downloading ${PTAU_URL}`);
  const res = await fetch(PTAU_URL);
  if (!res.ok) throw new Error(`ptau ${res.status}`);
  writeFileSync(PTAU, Buffer.from(await res.arrayBuffer()));
}

const r1cs = join(root, "build/kitty_action.r1cs");
const wasm = join(root, "build/kitty_action_js/kitty_action.wasm");
const z0 = join(keys, "kitty_action_0.zkey");
const z1 = join(keys, "kitty_action_1.zkey");
const zkey = join(keys, "kitty_action.zkey");
const logger = { info: () => {}, debug: () => {}, warn: console.warn, error: console.error };

console.log("phase 2: new zkey");
await snarkjs.zKey.newZKey(r1cs, PTAU, z0, logger);
console.log("phase 2: contribution 1");
await snarkjs.zKey.contribute(z0, z1, "kitty dev 1", randomBytes(32).toString("hex"), logger);
console.log("phase 2: contribution 2");
await snarkjs.zKey.contribute(z1, zkey, "kitty dev 2", randomBytes(32).toString("hex"), logger);

const vk = await snarkjs.zKey.exportVerificationKey(zkey, logger);
writeFileSync(join(keys, "kitty_action_vk.json"), JSON.stringify(vk, null, 1));
copyFileSync(wasm, join(keys, "kitty_action.wasm"));

const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const manifest = {
  circuit: "kitty_action",
  publicSignals: ["nullifier", "outCommitment", "outTag", "outClaim", "root", "now", "paramsHash", "mode"],
  wasm: { file: "kitty_action.wasm", sha256: sha(wasm), bytes: readFileSync(wasm).length },
  zkey: { file: "kitty_action.zkey", sha256: sha(zkey), bytes: readFileSync(zkey).length },
  vkSha256: sha(join(keys, "kitty_action_vk.json")),
  createdAt: new Date().toISOString(),
};
writeFileSync(join(keys, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const vkDir = join(root, "../contracts/programs/kitty/src/vk");
mkdirSync(vkDir, { recursive: true });
writeFileSync(join(vkDir, "kitty_action.rs"), vkToRust("VK_KITTY_ACTION", vk, "kitty_action development setup (circuits/scripts/setup.mjs)"));
console.log(`done: ${vk.nPublic} public signals; zkey ${(manifest.zkey.bytes / 1e6).toFixed(1)} MB; vk written to contracts`);
process.exit(0);
