/**
 * Invite keys. The host's invite link carries a 32-byte secret in its fragment (never sent to a
 * server). A guest signs "kitty-rsvp" ‖ party id ‖ their party wallet with it, and the program
 * checks that signature through the Ed25519 instruction placed just before `rsvp`.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { type Address, type Instruction, getAddressEncoder, getU64Encoder, getBase58Decoder } from "@solana/kit";
import { ED25519_PROGRAM_ADDRESS } from "./constants";

const te = new TextEncoder();

export function newInviteSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}
export function invitePublicKey(secret: Uint8Array): Address {
  return getBase58Decoder().decode(ed25519.getPublicKey(secret)) as Address;
}

/** URL-safe base64 for the link fragment (#k=…). */
export function encodeInviteSecret(secret: Uint8Array): string {
  let s = "";
  for (const b of secret) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
export function decodeInviteSecret(k: string): Uint8Array {
  const s = atob(k.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

export function inviteMessage(partyId: bigint, wallet: Address): Uint8Array {
  const domain = te.encode("kitty-rsvp");
  const id = getU64Encoder().encode(partyId);
  const w = getAddressEncoder().encode(wallet);
  const out = new Uint8Array(domain.length + 8 + 32);
  out.set(domain, 0);
  out.set(id, domain.length);
  out.set(w, domain.length + 8);
  return out;
}

/** The Ed25519 program instruction with the invite signature (all data inside the instruction). */
export function inviteSignatureInstruction(secret: Uint8Array, partyId: bigint, wallet: Address): Instruction {
  const message = inviteMessage(partyId, wallet);
  const pubkey = ed25519.getPublicKey(secret);
  const signature = ed25519.sign(message, secret);
  const PK = 16;
  const SIG = PK + 32;
  const MSG = SIG + 64;
  const data = new Uint8Array(MSG + message.length);
  const view = new DataView(data.buffer);
  data[0] = 1; // one signature
  data[1] = 0;
  view.setUint16(2, SIG, true);
  view.setUint16(4, 0xffff, true);
  view.setUint16(6, PK, true);
  view.setUint16(8, 0xffff, true);
  view.setUint16(10, MSG, true);
  view.setUint16(12, message.length, true);
  view.setUint16(14, 0xffff, true);
  data.set(pubkey, PK);
  data.set(signature, SIG);
  data.set(message, MSG);
  return { programAddress: ED25519_PROGRAM_ADDRESS, accounts: [], data };
}
