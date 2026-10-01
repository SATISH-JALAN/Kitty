import sharp from "sharp";
// Find bounding boxes of alpha regions / bright regions to anchor overlays.
const V = "C:/Users/satish/Downloads/kitty visuals/";
async function alphaBox(f) {
  const { data, info } = await sharp(V + f).raw().toBuffer({ resolveWithObject: true });
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 200) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  console.log(f, "opaque box %", (x0 / info.width * 100).toFixed(1), (y0 / info.height * 100).toFixed(1), (x1 / info.width * 100).toFixed(1), (y1 / info.height * 100).toFixed(1));
}
for (const f of ["h4.png", "h4z.png", "h5.png", "t1.png"]) await alphaBox(f);
// D-1 slot: find darkest horizontal band in centre column between 45% and 65% height
const { data, info } = await sharp(V + "d1.png").raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
for (let y = Math.floor(H * 0.5); y < H * 0.6; y += 4) {
  let s = 0; for (let x = Math.floor(W * 0.45); x < W * 0.55; x++) { const i = (y * W + x) * 4; s += data[i] + data[i + 1] + data[i + 2]; }
  console.log("d1 row", (y / H * 100).toFixed(1), Math.round(s / (W * 0.1) / 3));
}
