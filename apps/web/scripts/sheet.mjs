#!/usr/bin/env node
/** node scripts/sheet.mjs <out.png> <cols> <width> <in1.png> <in2.png> … — tile frames into one contact sheet. */
import sharp from "sharp";
const [out, cols, width, ...files] = process.argv.slice(2);
const c = +cols;
const w = +width;
const bufs = await Promise.all(files.map((f) => sharp(f).resize({ width: w }).png().toBuffer()));
const metas = await Promise.all(bufs.map((b) => sharp(b).metadata()));
const h = Math.max(...metas.map((m) => m.height));
const rows = Math.ceil(bufs.length / c);
await sharp({ create: { width: c * w + (c - 1) * 6, height: rows * h + (rows - 1) * 6, channels: 3, background: "#888" } })
  .composite(bufs.map((input, i) => ({ input, left: (i % c) * (w + 6), top: Math.floor(i / c) * (h + 6) })))
  .png()
  .toFile(out);
console.log(out);
