/**
 * Proving artifacts: downloaded once with progress, SHA-256 checked when a hash is pinned, and
 * cached in IndexedDB (architecture 5.4, 8.5).
 */
import { get, set } from "idb-keyval";

export type Progress = (loaded: number, total: number) => void;

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return Array.from(d, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function download(url: string, onProgress?: Progress, expectedBytes = 0): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed: ${url} (${res.status})`);
  const total = Number(res.headers.get("content-length")) || expectedBytes;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress?.(loaded, total);
  }
  const out = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Fetch an artifact, from the cache when we have it. */
export async function artifact(url: string, opts: { sha256?: string; bytes?: number; onProgress?: Progress } = {}): Promise<Uint8Array> {
  const key = `kitty:artifact:${opts.sha256 ?? url}`;
  const hit = (await get(key).catch(() => undefined)) as Uint8Array | undefined;
  if (hit) {
    opts.onProgress?.(hit.length, hit.length);
    return hit;
  }
  const bytes = await download(url, opts.onProgress, opts.bytes);
  if (opts.sha256 && (await sha256Hex(bytes)) !== opts.sha256) throw new Error(`artifact hash mismatch: ${url}`);
  await set(key, bytes).catch(() => undefined);
  return bytes;
}

/** A proving key held as snarkjs "bigMem" pages (fastfile's 4 MB pages), so the 282 MB key
 *  never needs one contiguous buffer, or a second copy while it's assembled. */
export interface PagedFile {
  type: "bigMem";
  data: Uint8Array[];
}
const PAGE = 1 << 22;

/** Anon Aadhaar's chunked proving key: 10 gzipped chunks, each inflated straight into pages.
 *  The gzipped chunks are cached one entry each: Chromium doesn't reliably read back a single
 *  282 MB IndexedDB value (it comes back null), and the compressed chunks are smaller. */
export async function aadhaarZkey(base: string, onProgress?: Progress): Promise<PagedFile> {
  const APPROX = 282 * 1024 * 1024;
  const pages: Uint8Array[] = [];
  let page = new Uint8Array(PAGE);
  let off = 0;
  const write = (chunk: Uint8Array) => {
    for (let i = 0; i < chunk.length; ) {
      const n = Math.min(PAGE - off, chunk.length - i);
      page.set(chunk.subarray(i, i + n), off);
      off += n;
      i += n;
      if (off === PAGE) {
        pages.push(page);
        page = new Uint8Array(PAGE);
        off = 0;
      }
    }
  };
  let done = 0;
  for (let i = 0; i < 10; i++) {
    const key = `kitty:artifact:aadhaar-v2-zkey-${i}`;
    let gz = (await get(key).catch(() => undefined)) as Uint8Array | undefined;
    if (!gz) {
      gz = await download(`${base}/chunked_zkey/circuit_final_${i}.gz`, (l) => onProgress?.(done + l, APPROX));
      await set(key, gz).catch(() => undefined);
    }
    done += gz.length;
    onProgress?.(done, APPROX);
    const reader = new Blob([gz as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      write(value);
    }
  }
  if (off) pages.push(page.subarray(0, off));
  onProgress?.(APPROX, APPROX);
  return { type: "bigMem", data: pages };
}

export async function hasCached(keyOrSha: string): Promise<boolean> {
  return !!(await get(`kitty:artifact:${keyOrSha}`).catch(() => undefined));
}
