#!/usr/bin/env node
/** node scripts/crop.mjs <in.png> <top> <height> [left] [width] [out] — crop a region of a review shot. */
import sharp from "sharp";
const [inp, top, height, left = 0, width, out] = process.argv.slice(2);
const meta = await sharp(inp).metadata();
const w = width ? +width : meta.width - +left;
const h = Math.min(+height, meta.height - +top);
const dest = out ?? inp.replace(/\.png$/, `-crop${top}.png`);
await sharp(inp).extract({ left: +left, top: +top, width: w, height: h }).toFile(dest);
console.log(dest, `${meta.width}×${meta.height}`);
