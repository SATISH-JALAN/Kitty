/**
 * The Party Diary (architecture 10.3): everything private about a member — the current note,
 * their parties and tags, history — encrypted with XChaCha20-Poly1305 under the Diary key.
 * Stored in IndexedDB; a backup copy (ciphertext only) can live on the API.
 */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { randomBytes } from "@noble/ciphers/utils.js";
import { get, set, del } from "idb-keyval";

export interface SlotRecord {
  party: string;
  dueStart: string;
  period: string;
  rounds: string;
  active: string;
  unlocked: string;
}
/** The note, with bigints as decimal strings. */
export interface NoteRecord {
  s: string;
  completed: string;
  late: string;
  paid: string;
  slots: SlotRecord[];
  nonce: string;
  k: string;
}

export interface DiaryParty {
  /** This member's tag in the party (hex), H(s, party id). */
  tag: string;
  /** Party PDA. */
  address: string;
  host?: boolean;
  /** The party wallet's address (derived; kept for display). */
  wallet: string;
  joinedAt?: string;
  /** Set once the COMPLETE proof moved the party into the note's counters. */
  completedAt?: string;
  farewell?: { paidRounds: number; lateCount: number };
  title?: string;
}

export interface DiaryPage {
  id: string;
  createdAt: string;
  label: string;
}

export interface Diary {
  v: 1;
  /** Registration (Guest Pass) nullifier, hex. Shown once in settings. */
  registration?: { nullifier: string; at: string; dev?: boolean };
  note: NoteRecord | null;
  parties: Record<string, DiaryParty>;
  pages: DiaryPage[];
  updatedAt: string;
}

export const emptyDiary = (): Diary => ({ v: 1, note: null, parties: {}, pages: [], updatedAt: new Date().toISOString() });

const te = new TextEncoder();
const td = new TextDecoder();

export function sealDiary(d: Diary, key: Uint8Array): Uint8Array {
  const nonce = randomBytes(24);
  const ct = xchacha20poly1305(key, nonce).encrypt(te.encode(JSON.stringify(d)));
  const out = new Uint8Array(24 + ct.length);
  out.set(nonce, 0);
  out.set(ct, 24);
  return out;
}

export function openDiary(blob: Uint8Array, key: Uint8Array): Diary {
  const pt = xchacha20poly1305(key, blob.subarray(0, 24)).decrypt(blob.subarray(24));
  const d = JSON.parse(td.decode(pt)) as Diary;
  if (d.v !== 1) throw new Error("unknown Diary version");
  return d;
}

export const toBase64 = (b: Uint8Array) => {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
export const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const idbKey = (backupKey: string) => `kitty:diary:${backupKey}`;

export async function loadLocal(backupKey: string, key: Uint8Array): Promise<Diary | null> {
  const blob = (await get(idbKey(backupKey))) as Uint8Array | undefined;
  return blob ? openDiary(blob, key) : null;
}
export async function saveLocal(backupKey: string, key: Uint8Array, d: Diary): Promise<Uint8Array> {
  const blob = sealDiary({ ...d, updatedAt: new Date().toISOString() }, key);
  await set(idbKey(backupKey), blob);
  return blob;
}
export async function forgetLocal(backupKey: string) {
  await del(idbKey(backupKey));
}

/** Small device-only values (not secret on their own, e.g. the demo identity seed). */
export const deviceStore = { get: (k: string) => get(k), set: (k: string, v: unknown) => set(k, v), del: (k: string) => del(k) };
