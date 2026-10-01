#!/usr/bin/env node
/**
 * Art pipeline (brief 16, 16.1).
 *
 * Reads the painted art from ART_SRC (default: frontend/kitty visuals), fixes what
 * the generator couldn't deliver, and writes web-ready files to apps/web/public/art:
 *
 * - H-2 arrives with a painted checkerboard instead of transparency → keyed out.
 * - H-3 arrives as one image on flat grey → keyed out and split into H-3L / H-3R.
 * - Near-opaque alpha (≥ 248) is snapped to 255 so layers don't read as see-through.
 * - Each asset ships as AVIF + WebP at a small width set, plus a generated manifest
 *   (size, tone, widths) that `apps/web/art/manifest.ts` merges with focal points.
 *
 * Usage: pnpm art            (ART_SRC=/path/to/pngs pnpm art; ONLY=H-2,H-3 to redo some)
 */
import sharp from "sharp";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = process.env.ART_SRC ?? path.join(ROOT, "kitty visuals");
const OUT = path.join(ROOT, "apps/web/public/art");
const MANIFEST = path.join(ROOT, "apps/web/art/manifest.generated.json");

/** id → source file, how to treat it, and which widths to emit. */
const JOBS = [
  { id: "H-1", file: "h1.png", widths: [960, 1586] },
  { id: "H-2", file: "h2.png", widths: [960, 1586], key: "checker" },
  { id: "H-3", file: "h3.png", widths: [960, 1586], key: "flat", split: true },
  { id: "H-4", file: "h4.png", widths: [960, 1586] },
  { id: "H-4Z", file: "h4z.png", widths: [960, 1586] },
  { id: "H-5", file: "h5.png", widths: [960, 1586] },
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: `V-${n}`, file: `v${n}.png`, widths: [600, 900, 1060] })),
  { id: "S-1", file: "s1.png", widths: [960, 1672] },
  { id: "D-1", file: "d1.png", widths: [512, 1024] },
  { id: "T-1", file: "t1.png", widths: [640, 1254] },
  { id: "B-1", file: "b1.png", widths: [530, 1060] },
  { id: "P-1", file: "p1.png", widths: [512, 1024], texture: true },
  { id: "P-2", file: "p2.png", widths: [512, 1024], texture: true },
  { id: "P-3", file: "p3.png", widths: [512, 1024], texture: true },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Key a background out. `isBg(r,g,b)` returns the distance (0 = pure background) to the
 * nearest background colour and that colour. Background is flood-filled from the border
 * so pale details inside the art (masks, flags) survive; edges get a soft alpha ramp and
 * are un-mixed from the background colour to avoid halos.
 */
function keyOut(data, w, h, bgDistance, near = 14, far = 42, flood = true) {
  const n = w * h;
  const out = Buffer.alloc(n * 4);
  const dist = new Float32Array(n);
  const bgR = new Float32Array(n), bgG = new Float32Array(n), bgB = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const [d, bg] = bgDistance(r, g, b);
    dist[i] = d;
    bgR[i] = bg[0]; bgG[i] = bg[1]; bgB[i] = bg[2];
  }
  // Flood fill background from the border through pixels closer than `far`.
  const isBg = new Uint8Array(n);
  const stack = [];
  const push = (i) => {
    if (!isBg[i] && dist[i] < far) {
      isBg[i] = 1;
      stack.push(i);
    }
  };
  if (!flood) for (let i = 0; i < n; i++) isBg[i] = dist[i] < far ? 1 : 0;
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  for (let i = 0; i < n; i++) {
    let r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    let a = 1;
    if (isBg[i]) a = smooth(near, far, dist[i]);
    if (a > 0 && a < 1) {
      // Un-mix: observed = a·fg + (1 − a)·bg
      r = clamp((r - (1 - a) * bgR[i]) / a, 0, 255);
      g = clamp((g - (1 - a) * bgG[i]) / a, 0, 255);
      b = clamp((b - (1 - a) * bgB[i]) / a, 0, 255);
    }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b;
    out[i * 4 + 3] = Math.round(a * 255);
  }
  return out;
}

/** Painted checkerboard: two near-neutral light greys. */
function checkerDistance(r, g, b) {
  // Any light neutral is checkerboard, including the anti-aliased seams between squares.
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  const lum = (r + g + b) / 3;
  const g0 = clamp(lum, 190, 255);
  return [sat * 2.4 + Math.max(0, 186 - lum) * 1.2, [g0, g0, g0]];
}

function flatDistance(sample) {
  return (r, g, b) => {
    const d = Math.hypot(r - sample[0], g - sample[1], b - sample[2]);
    return [d, sample];
  };
}

function snapAlpha(buf) {
  for (let i = 3; i < buf.length; i += 4) {
    if (buf[i] >= 248) buf[i] = 255;
    else if (buf[i] <= 3) buf[i] = 0;
  }
  return buf;
}

function toneOf(buf, channels, w, h) {
  let r = 0, g = 0, b = 0, count = 0;
  for (let i = 0; i < w * h; i += 7) {
    const a = channels === 4 ? buf[i * 4 + 3] : 255;
    if (a < 200) continue;
    r += buf[i * channels]; g += buf[i * channels + 1]; b += buf[i * channels + 2];
    count++;
  }
  const hex = (v) => Math.round(v / Math.max(count, 1)).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Column range in the middle third with no opaque pixels: where H-3's two groups separate. */
function findGap(rgba, w, h) {
  const colAlpha = new Float64Array(w);
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) colAlpha[x] += rgba[(y * w + x) * 4 + 3];
  let best = { start: -1, len: 0 }, cur = { start: -1, len: 0 };
  for (let x = Math.floor(w / 3); x < Math.floor((2 * w) / 3); x++) {
    if (colAlpha[x] < 255 * 3) {
      if (cur.start < 0) cur = { start: x, len: 0 };
      cur.len++;
      if (cur.len > best.len) best = { ...cur };
    } else cur = { start: -1, len: 0 };
  }
  return best.start < 0 ? Math.round(w / 2) : best.start + Math.round(best.len / 2);
}

async function emit(id, raw, w, h, channels, widths, texture) {
  const files = [];
  for (const width of widths.filter((x) => x <= w)) {
    const base = sharp(raw, { raw: { width: w, height: h, channels } }).resize({ width, kernel: "lanczos3" });
    const name = `${id}-${width}`;
    await base.clone().avif({ quality: texture ? 50 : 58, effort: 6 }).toFile(path.join(OUT, `${name}.avif`));
    await base.clone().webp({ quality: texture ? 72 : 80, alphaQuality: 90, effort: 5 }).toFile(path.join(OUT, `${name}.webp`));
    files.push(width);
  }
  return files;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(path.dirname(MANIFEST), { recursive: true });
  const manifest = {};

  const only = process.env.ONLY?.split(",");
  let prior = {};
  if (only) prior = JSON.parse(await import("node:fs/promises").then((f) => f.readFile(MANIFEST, "utf8")).catch(() => "{}"));
  Object.assign(manifest, prior);
  for (const job of JOBS) {
    if (only && !only.includes(job.id)) continue;
    const src = path.join(SRC, job.file);
    if (!(await exists(src))) {
      console.warn(`· ${job.id}: missing ${job.file} (placeholder will render)`);
      continue;
    }
    let img = sharp(src);
    if (job.texture) img = img.resize(1024, 1024);
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    let { width: w, height: h, channels } = info;
    let buf = data;

    if (job.key) {
      const rgb = channels === 3 ? data : await sharp(src).removeAlpha().raw().toBuffer();
      const dist = job.key === "checker" ? checkerDistance : flatDistance([rgb[0], rgb[1], rgb[2]]);
      buf = keyOut(rgb, w, h, dist, job.key === "checker" ? 16 : 12, job.key === "checker" ? 40 : 30, job.key !== "checker");
      channels = 4;
    }
    if (channels === 4) snapAlpha(buf);

    if (job.split) {
      const gap = findGap(buf, w, h);
      for (const side of ["L", "R"]) {
        const half = Buffer.from(buf);
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (side === "L" ? x >= gap : x < gap) half[(y * w + x) * 4 + 3] = 0;
        const id = `${job.id}${side}`;
        const widths = await emit(id, half, w, h, 4, job.widths);
        manifest[id] = { width: w, height: h, alpha: true, tone: toneOf(half, 4, w, h), widths, split: gap };
        console.log(`✓ ${id} ${w}×${h} (split at x=${gap})`);
      }
      continue;
    }

    const widths = await emit(job.id, buf, w, h, channels, job.widths, job.texture);
    manifest[job.id] = { width: w, height: h, alpha: channels === 4, tone: toneOf(buf, channels, w, h), widths };
    console.log(`✓ ${job.id} ${w}×${h}${channels === 4 ? " (alpha)" : ""}`);
  }

  // Social card: centre-crop to 1200×630.
  const og = path.join(SRC, "og.png");
  if (await exists(og)) {
    await sharp(og).resize(1200, 630, { fit: "cover", position: "attention" }).png({ compressionLevel: 9 })
      .toFile(path.join(ROOT, "apps/web/app/opengraph-image.png"));
    console.log("✓ OG 1200×630");
  }

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`manifest → ${path.relative(ROOT, MANIFEST)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
