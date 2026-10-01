#!/usr/bin/env node
/**
 * Full-page captures of many routes at one size, for side-by-side review (brief 17.3).
 *   node scripts/gallery.mjs --w 390 --h 844 --routes "/tonight,/parties" --prefix m
 * Writes review/<prefix>-<route>.png. `--wait` ms per route (the Draw gets 9.5 s).
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? d : args[i + 1];
};
const w = +opt("w", 390);
const h = +opt("h", 844);
const routes = opt("routes", "/tonight,/parties,/parties/new,/p/asha,/p/susu,/p/office,/diary,/diary/show,/house,/settings,/pass,/invite/susu,/p/asha/draw").split(",")
  .map((r) =>
    // Git Bash rewrites "/x" arguments into Windows paths; undo that.
    "/" + r.replace(/^[A-Za-z]:\/.*?\/Git\//, "").replace(/^([A-Za-z]):\//, (_, d) => `${d.toLowerCase()}/`).replace(/^\/+/, ""),
  );
const prefix = opt("prefix", w < 800 ? "m" : "d");
const outDir = path.resolve(import.meta.dirname, "../../../review");
await mkdir(outDir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  try {
    sessionStorage.setItem("kitty:preloaded", "1");
  } catch {}
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("ERR", e.message));
for (const r of routes) {
  await page.goto(`http://localhost:3100${r}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(r.includes("draw") ? 9500 : +opt("wait", 2200));
  const file = path.join(outDir, `${prefix}-${r.replace(/\W+/g, "_").replace(/^_|_$/g, "") || "root"}.png`);
  await page.screenshot({ path: file, fullPage: !r.includes("draw") });
  console.log(file);
}
await b.close();
