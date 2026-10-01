import sharp from "sharp";
const S = "C:/Users/satish/AppData/Local/Temp/claude/C--projects-kitty/bce78a39-1f26-4f09-9ba2-a994a4095353/scratchpad/prev/";
const B = "apps/web/public/brand/";
const r = async (f, width, bg) => sharp(B + f, { density: f.includes("word") || f.includes("lockup") ? 110 : 600 }).resize({ width }).flatten({ background: bg }).png().toBuffer();
const items = [
  ["kitty-mark.svg", 480, "#F3EADB"], ["kitty-mark-night.svg", 480, "#170E22"], ["kitty-mark-mono.svg", 48, "#F3EADB"], ["kitty-mark-mono.svg", 24, "#F3EADB"], ["favicon.svg", 16, "#F3EADB"],
  ["kitty-wordmark.svg", 520, "#F3EADB"], ["kitty-lockup-night.svg", 700, "#170E22"], ["kitty-seal.svg", 240, "#F3EADB"], ["kitty-wordmark.svg", 140, "#F3EADB"],
];
const bufs = await Promise.all(items.map(([f, w, bg]) => r(f, w, bg)));
const metas = await Promise.all(bufs.map((b) => sharp(b).metadata()));
let y = 10; const comps = [];
for (let i = 0; i < bufs.length; i++) { comps.push({ input: bufs[i], left: 10, top: y }); y += metas[i].height + 16; }
await sharp({ create: { width: 740, height: y, channels: 3, background: "#ddd" } }).composite(comps).png().toFile(S + "brand.png");
