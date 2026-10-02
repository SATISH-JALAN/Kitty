/**
 * Anon Aadhaar v2 in the browser, test mode (architecture 5.1, product doc 8.2): make a fresh
 * test QR on the device (Anon Aadhaar's public test key; a random photo gives each person their
 * own nullifier), and turn QR data into the circuit's input. Ported from @anon-aadhaar/core 2.4
 * (generateArgs, createCustomV2TestData) without its Node/React dependencies.
 */
import { keccak_256 } from "@noble/hashes/sha3.js";
import TEST from "./aadhaar-test.json";

export const AADHAAR_ARTIFACTS = "https://anon-aadhaar-artifacts.s3.eu-central-1.amazonaws.com/v2.0.0";
export const AADHAAR_TEST_PUBKEY_HASH = BigInt(TEST.pubkeyHash);

const D = 255;

function bigToBytes(x: bigint): Uint8Array {
  const hex = x.toString(16);
  const s = hex.length % 2 ? "0" + hex : hex;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
}
function bytesToBig(b: Uint8Array): bigint {
  let v = 0n;
  for (const x of b) v = (v << 8n) | BigInt(x);
  return v;
}
const cat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

async function streamThrough(bytes: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(t));
  return new Uint8Array(await out.arrayBuffer());
}
const inflate = (b: Uint8Array) => streamThrough(b, new DecompressionStream("deflate"));
const deflate = (b: Uint8Array) => streamThrough(b, new CompressionStream("deflate"));

/** QR data (a big decimal number) → the signed payload and its RSA signature. */
export async function parseQr(qrData: string): Promise<{ signedData: Uint8Array; signature: Uint8Array }> {
  let raw: Uint8Array;
  try {
    raw = await inflate(bigToBytes(BigInt(qrData.trim())));
  } catch {
    throw new Error("unreadable");
  }
  if (raw.length < 300) throw new Error("unreadable");
  return { signedData: raw.subarray(0, raw.length - 256), signature: raw.subarray(raw.length - 256) };
}

/** The current IST timestamp as Aadhaar writes it: YYYYMMDDHHMMSSsss. */
function istStamp(): string {
  const d = new Date(Date.now() + 330 * 60_000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${p(d.getUTCMilliseconds(), 3)}`;
}

function replaceBetween(arr: Uint8Array, withBytes: Uint8Array, start: number, end: number): Uint8Array {
  return cat(arr.subarray(0, start), withBytes, arr.subarray(end + 1));
}

/**
 * A fresh V2 test QR: Anon Aadhaar's (already V2) test payload with a new timestamp and a random
 * photo, re-signed with the public test key. The photo feeds the nullifier, so every generated QR
 * is a different "person". Returns the QR data (decimal string).
 */
export async function makeTestQr(): Promise<string> {
  const base = await parseQr(TEST.testQRData);
  // "V2" 255 "3" 255 then the reference id: 4 digits and a 17-digit timestamp at offset 9.
  const stamp = new TextEncoder().encode(istStamp());
  let data: Uint8Array = replaceBetween(base.signedData, stamp, 9, 9 + stamp.length - 1);
  // Photo: everything after the 18th delimiter.
  let begin = 0;
  for (let i = 0; i < 18; ++i) begin = data.indexOf(D, begin + 1);
  const photoLen = data.length - begin;
  const photo = crypto.getRandomValues(new Uint8Array(photoLen - 1)).map((b) => (b === D ? 0 : b));
  data = replaceBetween(data, photo, begin + 1, begin + photoLen - 1);
  const signed = data;
  const pem = TEST.testPrivateKeyPkcs8.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, signed as BufferSource));
  return bytesToBig(await deflate(cat(signed, sig))).toString();
}

/** SHA-256 padding to a fixed maximum (zk-email helpers' sha256Pad). */
function sha256Pad(msg: Uint8Array, maxBytes: number): [Uint8Array, number] {
  const bitLen = BigInt(msg.length * 8);
  let len = msg.length + 1;
  while ((len + 8) % 64 !== 0) len++;
  const padded = new Uint8Array(maxBytes);
  padded.set(msg, 0);
  padded[msg.length] = 0x80;
  const lenAt = len;
  for (let i = 0; i < 8; i++) padded[lenAt + i] = Number((bitLen >> BigInt(8 * (7 - i))) & 0xffn);
  const messageLen = lenAt + 8;
  if (messageLen > maxBytes) throw new Error("QR payload too long");
  return [padded, messageLen];
}

function splitToWords(n: bigint, wordBits: bigint, count: number): string[] {
  const words: string[] = [];
  const base = 1n << wordBits;
  let t = n;
  for (let i = 0; i < count; i++) {
    words.push((t % base).toString());
    t /= base;
  }
  if (t !== 0n) throw new Error("number does not fit");
  return words;
}

/** Anon Aadhaar's `hash()`: keccak256 of the 32-byte big-endian value, >> 3. */
export function aadhaarHash(x: bigint): bigint {
  const b = new Uint8Array(32);
  let v = x;
  for (let i = 31; i >= 0; i--) {
    b[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytesToBig(keccak_256(b)) >> 3n;
}

/**
 * Circuit input for `AadhaarQRVerifier(121, 17, 1536)`. Kitty reveals nothing (all four reveal
 * flags 0) and binds the proof to the member's first note via the signal.
 */
export async function aadhaarInput(qrData: string, nullifierSeed: bigint, signal: bigint) {
  const { signedData, signature } = await parseQr(qrData);
  const [padded, len] = sha256Pad(signedData, 512 * 3);
  const delimiterIndices: string[] = [];
  for (let i = 0; i < padded.length && delimiterIndices.length < 18; i++) if (padded[i] === D) delimiterIndices.push(String(i));
  return {
    qrDataPadded: Array.from(padded, String),
    qrDataPaddedLength: String(len),
    delimiterIndices,
    signature: splitToWords(bytesToBig(signature), 121n, 17),
    pubKey: splitToWords(BigInt("0x" + TEST.testModulusHex), 121n, 17),
    nullifierSeed: nullifierSeed.toString(),
    signalHash: aadhaarHash(signal).toString(),
    revealAgeAbove18: "0",
    revealGender: "0",
    revealPinCode: "0",
    revealState: "0",
  };
}
