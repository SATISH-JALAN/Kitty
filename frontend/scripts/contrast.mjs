#!/usr/bin/env node
/**
 * Contrast check over every text/background pair the UI uses (brief 5.5).
 * Normal text needs 4.5:1; "large" pairs (≥ 24 px, or ≥ 18.66 px bold) need 3:1.
 * Exits non-zero on any failure, so CI can run it.
 */
const C = {
  paper: "#F3EADB",
  paperDeep: "#E6D6BD",
  ink: "#22151F",
  inkSoft: "#5A4652",
  night: "#170E22",
  nightRaised: "#241634",
  moon: "#F6EEDF",
  moonSoft: "#BFAFC4",
  plum: "#4E2152",
  marigold: "#F4A300",
  saffron: "#E4572E",
  teal: "#0A6A62",
  tealNight: "#45C2B1",
  grace: "#9C5511",
  error: "#A63A2B",
  wax: "#7A1F3D",
  white: "#FFFFFF",
};

/** [label, fg, bg, "normal" | "large"] */
const PAIRS = [
  ["ink on paper", "ink", "paper", "normal"],
  ["ink on paper-deep", "ink", "paperDeep", "normal"],
  ["ink-soft on paper", "inkSoft", "paper", "normal"],
  ["ink-soft on paper-deep", "inkSoft", "paperDeep", "normal"],
  ["moon on night", "moon", "night", "normal"],
  ["moon on night-raised", "moon", "nightRaised", "normal"],
  ["moon-soft on night", "moonSoft", "night", "normal"],
  ["moon-soft on night-raised", "moonSoft", "nightRaised", "normal"],
  ["paper on ink (primary button)", "paper", "ink", "normal"],
  ["night on moon (primary button, night)", "night", "moon", "normal"],
  ["white on teal (money button)", "white", "teal", "normal"],
  ["night on teal-night (money button, night)", "night", "tealNight", "normal"],
  ["teal on paper (money amounts)", "teal", "paper", "normal"],
  ["teal on paper-deep", "teal", "paperDeep", "normal"],
  ["teal-night on night", "tealNight", "night", "normal"],
  ["grace on paper", "grace", "paper", "normal"],
  ["grace on paper-deep (large only)", "grace", "paperDeep", "large"],
  ["error on paper", "error", "paper", "normal"],
  ["error on paper-deep", "error", "paperDeep", "normal"],
  ["night on marigold (Devnet tag)", "night", "marigold", "normal"],
  ["saffron on paper (stat stamps, large bold)", "saffron", "paper", "large"],
  ["plum on paper (stamps, focus)", "plum", "paper", "normal"],
  ["paper on plum (selected chip)", "paper", "plum", "normal"],
  ["moon on plum", "moon", "plum", "normal"],
  ["marigold on night (focus ring, night)", "marigold", "night", "large"],
  ["wax on paper (Family tier tag)", "wax", "paper", "normal"],
  ["paper on wax", "paper", "wax", "normal"],
  ["ink on marigold", "ink", "marigold", "normal"],
];

function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

let failed = 0;
for (const [label, fg, bg, size] of PAIRS) {
  const r = ratio(C[fg], C[bg]);
  const need = size === "large" ? 3 : 4.5;
  const ok = r >= need;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${r.toFixed(2).padStart(5)}  (≥${need})  ${label}`);
}
if (failed) {
  console.error(`\n${failed} pair(s) below AA`);
  process.exit(1);
}
console.log("\nAll pairs pass AA.");
