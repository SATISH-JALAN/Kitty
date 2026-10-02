/**
 * Give the devnet faucet its own key, so the hosted backend never holds the admin key (which is
 * also the program's upgrade authority). Moves the kUSD mint authority from the admin to a new
 * faucet wallet, funds it with SOL for the per-guest drip, and rewrites FAUCET_KEYPAIR in
 * backend/.env.local.
 *
 *   ADMIN_KEYPAIR=~/.config/solana/id.json FAUCET_FUND_SOL=1.2 tsx scripts/faucet-key.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { createKeyPairSignerFromBytes, lamports } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { AuthorityType, getSetAuthorityInstruction } from "@solana-program/token";
import { env } from "../src/env";
import { sendInstructions } from "../src/chain";

const path = (p: string) => p.replace(/^~/, homedir());
const adminPath = process.env.ADMIN_KEYPAIR ?? "~/.config/solana/id.json";
const admin = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync(path(adminPath), "utf8"))));
if (!env.KITTY_MINT) throw new Error("KITTY_MINT is not set (run setup-devnet first)");

// An extractable key, so its secret can be written to .env.local.
const kp = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
const faucet = await createKeyPairSignerFromBytes(Uint8Array.from([...pkcs8.slice(-32), ...pub]));

await sendInstructions(admin, [
  getSetAuthorityInstruction({ owned: env.KITTY_MINT as never, owner: admin, authorityType: AuthorityType.MintTokens, newAuthority: faucet.address }),
  getTransferSolInstruction({ source: admin, destination: faucet.address, amount: lamports(BigInt(Math.round(Number(process.env.FAUCET_FUND_SOL ?? "1.2") * 1e9))) }),
]);

const file = new URL("../.env.local", import.meta.url);
const secret = JSON.stringify([...pkcs8.slice(-32), ...pub]);
const text = readFileSync(file, "utf8").replace(/^FAUCET_KEYPAIR=.*$/m, `FAUCET_KEYPAIR=${secret}`);
writeFileSync(file, text);
console.log(`faucet ${faucet.address} is now the kUSD mint authority; FAUCET_KEYPAIR rewritten in backend/.env.local`);
