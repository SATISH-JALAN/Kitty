/** Small deterministic hashing and PRNG helpers, shared by generators and scenes. */

/** 32-bit FNV-1a over bytes. */
export function fnv1a(bytes: ArrayLike<number>, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function hashString(s: string, seed?: number): number {
  return fnv1a(new TextEncoder().encode(s), seed);
}

/** mulberry32: fast seeded PRNG in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded value in [min, max). */
export function between(r: () => number, min: number, max: number): number {
  return min + r() * (max - min);
}

/** 32 deterministic "tag" bytes from any string (for demo guests; real tags come from Poseidon). */
export function demoTag(label: string): Uint8Array {
  const out = new Uint8Array(32);
  let h = hashString(label);
  for (let i = 0; i < 32; i += 4) {
    h = fnv1a([h & 0xff, (h >>> 8) & 0xff, (h >>> 16) & 0xff, (h >>> 24) & 0xff, i], h ^ 0x9e3779b9);
    out[i] = h & 0xff;
    out[i + 1] = (h >>> 8) & 0xff;
    out[i + 2] = (h >>> 16) & 0xff;
    out[i + 3] = (h >>> 24) & 0xff;
  }
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
