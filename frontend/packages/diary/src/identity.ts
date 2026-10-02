/**
 * Every secret comes from one signature (architecture 5.3). The identity wallet (Privy's embedded
 * wallet, or a seed kept on this device in demo mode) signs "kitty-identity-v1" once; Ed25519
 * signatures are deterministic, so logging in again on any device gives back the same secrets.
 *
 *   seed      = SHA-256(signature)                     — feeds s (the circuit hashes it) and keys
 *   party key = SHA-256("kitty-party-wallet" ‖ seed ‖ party id)   one wallet per party
 *   diary key = HKDF-SHA256(seed, "kitty-diary-v1")    XChaCha20-Poly1305
 *   backup    = SHA-256(seed ‖ "backup-key") as the store key, and an Ed25519 key that signs writes
 *
 * The identity secret s itself is Poseidon(seed mod p), computed in the prover worker so the
 * main bundle never loads Poseidon.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { type KeyPairSigner, createKeyPairSignerFromPrivateKeyBytes } from "@solana/kit";

export const IDENTITY_MESSAGE = new TextEncoder().encode("kitty-identity-v1");
const te = new TextEncoder();

const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
const u64le = (v: bigint) => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, v, true);
  return b;
};
export const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
export function fromHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export interface Identity {
  /** SHA-256 of the identity signature: the root of every other secret. Never leaves the device. */
  seed: Uint8Array;
  diaryKey: Uint8Array;
  backupKey: string;
  backupSigningKey: Uint8Array;
  backupPublicKey: string;
}

export function identityFromSignature(signature: Uint8Array): Identity {
  if (signature.length !== 64) throw new Error("expected a 64-byte Ed25519 signature");
  const seed = sha256(signature);
  const diaryKey = hkdf(sha256, seed, undefined, te.encode("kitty-diary-v1"), 32);
  const backupSigningKey = hkdf(sha256, seed, undefined, te.encode("kitty-backup-sign-v1"), 32);
  return {
    seed,
    diaryKey,
    backupKey: toHex(sha256(cat(seed, te.encode("backup-key")))),
    backupSigningKey,
    backupPublicKey: toHex(ed25519.getPublicKey(backupSigningKey)),
  };
}

/** Demo mode: an identity wallet kept on this device (no Privy app configured). */
export function demoSignature(deviceSeed: Uint8Array): Uint8Array {
  return ed25519.sign(IDENTITY_MESSAGE, deviceSeed);
}

/** The private key bytes of this member's wallet for one party. */
export function partyWalletSeed(seed: Uint8Array, partyId: bigint): Uint8Array {
  return sha256(cat(te.encode("kitty-party-wallet"), seed, u64le(partyId)));
}

const wallets = new Map<string, Promise<KeyPairSigner>>();
/** The member's party wallet for a party (cached per session). */
export function partyWallet(seed: Uint8Array, partyId: bigint): Promise<KeyPairSigner> {
  const k = `${toHex(seed)}:${partyId}`;
  let w = wallets.get(k);
  if (!w) {
    w = createKeyPairSignerFromPrivateKeyBytes(partyWalletSeed(seed, partyId));
    wallets.set(k, w);
  }
  return w;
}

/** The party's invite key comes from the host's seed too, so a host can always re-share the link. */
export function inviteSecretFor(seed: Uint8Array, partyId: bigint): Uint8Array {
  return sha256(cat(te.encode("kitty-invite"), seed, u64le(partyId)));
}

export function signBackup(id: Identity, message: Uint8Array): Uint8Array {
  return ed25519.sign(message, id.backupSigningKey);
}
