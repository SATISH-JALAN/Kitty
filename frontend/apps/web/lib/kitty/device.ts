"use client";
/**
 * The device (architecture 8.2 `identity` + `diary`): unlocks from one identity signature, holds
 * the decrypted Party Diary in memory (./store), and saves it encrypted to IndexedDB and (as
 * ciphertext) to the backup store. Nothing secret goes into React Query caches or logs.
 */
import {
  type Diary,
  type Identity,
  fromBase64,
  identityFromSignature,
  loadLocal,
  openDiary,
  saveLocal,
  sealDiary,
  signBackup,
  toBase64,
} from "@kitty/diary";
import { prover } from "@kitty/zk/client";
import { API, ApiError, apiGet, apiSend } from "./api";
import { emptyDiary, useDevice } from "./store";

export { useDevice };

let backupTimer: ReturnType<typeof setTimeout> | null = null;

export async function unlock(signature: Uint8Array): Promise<void> {
  useDevice.setState({ status: "unlocking" });
  const identity = identityFromSignature(signature);
  const hex = Array.from(identity.seed, (x) => x.toString(16).padStart(2, "0")).join("");
  const s = await prover().secretFromSeed(hex);
  let diary = await loadLocal(identity.backupKey, identity.diaryKey).catch(() => null);
  if (!diary && API) diary = await fetchBackup(identity).catch(() => null);
  useDevice.setState({ identity, s, diary: diary ?? emptyDiary(), status: "ready" });
}

export function lock() {
  useDevice.setState({ status: "locked", identity: null, s: null, diary: emptyDiary(), backup: { at: null, state: "idle" } });
}

export async function update(fn: (d: Diary) => Diary): Promise<void> {
  const { identity } = useDevice.getState();
  if (!identity) throw new Error("locked");
  const diary = { ...fn(useDevice.getState().diary), updatedAt: new Date().toISOString() };
  useDevice.setState({ diary });
  await saveLocal(identity.backupKey, identity.diaryKey, diary);
  if (!API) return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => void pushBackup(), 1500);
}

export async function restore(): Promise<boolean> {
  const { identity } = useDevice.getState();
  if (!identity) return false;
  const d = await fetchBackup(identity);
  if (!d) return false;
  useDevice.setState({ diary: d });
  await saveLocal(identity.backupKey, identity.diaryKey, d);
  return true;
}

async function fetchBackup(id: Identity): Promise<Diary | null> {
  const r = await apiGet<{ ciphertext: string; version: number; updatedAt: string } | null>(`/v1/backup/${id.backupKey}`).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  });
  if (!r) return null; // no backup yet
  useDevice.setState({ backup: { at: r.updatedAt, state: "idle" } });
  return openDiary(fromBase64(r.ciphertext), id.diaryKey);
}

async function sha256Hex(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(d, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Encrypted backup (architecture 7.2): key = SHA-256(seed ‖ "backup-key"), writes signed. */
export async function pushBackup(): Promise<void> {
  const { identity, diary } = useDevice.getState();
  if (!identity || !API) return;
  useDevice.setState({ backup: { ...useDevice.getState().backup, state: "saving" } });
  try {
    const ciphertext = toBase64(sealDiary(diary, identity.diaryKey));
    const version = Math.floor(Date.parse(diary.updatedAt) / 1000);
    const msg = new TextEncoder().encode(`kitty-backup:${identity.backupKey}:${version}:${await sha256Hex(ciphertext)}`);
    const signature = toBase64(signBackup(identity, msg));
    await apiSend(`/v1/backup/${identity.backupKey}`, { pubkey: identity.backupPublicKey, ciphertext, version, signature }, "PUT");
    useDevice.setState({ backup: { at: new Date().toISOString(), state: "idle" } });
  } catch {
    useDevice.setState({ backup: { ...useDevice.getState().backup, state: "error" } });
  }
}
