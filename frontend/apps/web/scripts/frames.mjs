#!/usr/bin/env node
/**
 * Frames at exact scroll positions: node scripts/frames.mjs <prefix> <anchorSel> <fractions|px list> [--w --h] [--of <sel>]
 * Fractions (0–1) are of the anchor section's scroll length; plain numbers ≥ 2 are px offsets.
 */
import { chromium } from "@playwright/test";
const [prefix, anchor, list, ...rest] = process.argv.slice(2);
const opt = (n, d) => {
  const i = rest.indexOf(`--${n}`);
  return i < 0 ? d : rest[i + 1];
};
const w = +opt("w", 1440);
const h = +opt("h", 900);
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 });
await c.addInitScript(() => {
  try {
    sessionStorage.setItem("kitty:preloaded", "1");
  } catch {}
});
const p = await c.newPage();
p.on("pageerror", (e) => console.log("ERR", e.message));
await p.goto("http://localhost:3100/?nosnap", { waitUntil: "networkidle" });
await p.waitForTimeout(3000);
const { top, len } = await p.evaluate((sel) => {
  const el = document.querySelector(sel);
  const r = el.getBoundingClientRect();
  return { top: r.top + scrollY, len: el.offsetHeight - innerHeight };
}, anchor);
let i = 0;
for (const v of list.split(",").map(Number)) {
  const y = Math.round(top + (v < 2 ? v * len : v));
  // Approach from slightly above so scrubbed tweens settle as a user would see them.
  await p.evaluate((yy) => window.scrollTo(0, yy - 40), y);
  await p.waitForTimeout(250);
  await p.evaluate((yy) => window.scrollTo(0, yy), y);
  await p.waitForTimeout(+opt("settle", 1600));
  const f = `../../review/${prefix}-${String(i++).padStart(2, "0")}.png`;
  await p.screenshot({ path: f });
  console.log(f, y);
}
await b.close();
