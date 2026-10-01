#!/usr/bin/env node
/**
 * Static paper grain (brief 4.4): one 256×256 tileable noise WebP, generated once.
 * Used by <Grain/> at .06 multiply (Paper) / .05 screen (Night). Never animated.
 */
import sharp from "sharp";
import path from "node:path";

const SIZE = 256;
const OUT = path.resolve(import.meta.dirname, "../apps/web/public/grain.webp");

// Seeded PRNG so the file is reproducible.
let s = 0x6b697474;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

const px = Buffer.alloc(SIZE * SIZE);
for (let i = 0; i < px.length; i++) {
  // Two octaves: fine fibre noise plus a few darker flecks.
  const fine = (rnd() + rnd() + rnd()) / 3;
  const fleck = rnd() > 0.992 ? -0.35 : 0;
  px[i] = Math.max(0, Math.min(255, Math.round((fine + fleck) * 255)));
}

await sharp(px, { raw: { width: SIZE, height: SIZE, channels: 1 } })
  .webp({ quality: 55, effort: 6 })
  .toFile(OUT);
console.log(`grain → ${path.relative(process.cwd(), OUT)}`);
