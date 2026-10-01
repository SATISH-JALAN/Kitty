#!/usr/bin/env node
/**
 * Screenshot helper for the self-review loop (brief 17.3).
 *
 *   node scripts/shot.mjs <path> [--w 1440] [--h 900] [--out file.png] [--wait 1200]
 *        [--scroll 0|<px>|<selector>] [--reduced] [--nojs] [--full] [--steps "0,900,1800"]
 *        [--click <selector>] [--hover <selector>]
 *
 * With --steps it scrolls with the mouse wheel through each y and writes one PNG per step.
 */
import { chromium } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const args = process.argv.slice(2);
// Git Bash rewrites "/x" to "C:/Program Files/Git/x"; undo that.
const rawRoute = args.find((a) => !a.startsWith("--")) ?? "/";
// …and "/p/x" to "P:/x" (a one-letter segment looks like a drive).
const route =
  "/" +
  rawRoute
    .replace(/^[A-Za-z]:\/.*?\/Git\//, "")
    .replace(/^([A-Za-z]):\//, (_, d) => `${d.toLowerCase()}/`)
    .replace(/^\/+/, "");
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);

const base = process.env.BASE ?? "http://localhost:3100";
const w = +opt("w", 1440);
const h = +opt("h", 900);
const out = opt("out", `shot-${route.replace(/\W+/g, "_") || "root"}-${w}.png`);
const outDir = process.env.SHOTS ?? path.resolve(import.meta.dirname, "../../../review");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: w, height: h },
  deviceScaleFactor: +opt("dpr", 1),
  reducedMotion: flag("reduced") ? "reduce" : "no-preference",
  javaScriptEnabled: !flag("nojs"),
  hasTouch: w < 800,
  isMobile: w < 800,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
if (!flag("preloader")) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("kitty:preloaded", "1");
    } catch {}
  });
}
await page.goto(base + route, { waitUntil: "networkidle" });
await page.waitForTimeout(+opt("wait", 1200));

if (opt("hover")) await page.hover(opt("hover"));
if (opt("click")) {
  await page.click(opt("click"));
  await page.waitForTimeout(+opt("after", 800));
}

const steps = opt("steps");
if (steps) {
  let y = 0;
  const anchor = opt("anchor");
  const base0 = anchor ? await page.evaluate((sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect().top + window.scrollY : 0; }, anchor) : 0;
  const list = steps.split(",").map((v) => Number(v) + base0);
  // Lenis scales wheel deltas by its wheelMultiplier (0.9); compensate so targets are real scroll px.
  const mult = (await page.evaluate(() => document.documentElement.classList.contains("lenis"))) ? 0.9 : 1;
  for (let i = 0; i < list.length; i++) {
    const target = list[i];
    await page.mouse.move(w / 2, h / 2);
    while (y < target) {
      const d = Math.min(120, target - y);
      await page.mouse.wheel(0, d / mult);
      y += d;
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(+opt("settle", 1400));
    const file = path.join(outDir, out.replace(/\.png$/, `-${String(i).padStart(2, "0")}.png`));
    await page.screenshot({ path: file });
    console.log(file);
  }
} else {
  const scroll = opt("scroll");
  if (scroll) {
    if (/^\d+$/.test(scroll)) await page.evaluate((y) => window.scrollTo(0, y), +scroll);
    else await page.locator(scroll).scrollIntoViewIfNeeded();
    await page.waitForTimeout(+opt("settle", 900));
  }
  const file = path.join(outDir, out);
  await page.screenshot({ path: file, fullPage: flag("full") });
  console.log(file);
}
if (errors.length) console.log(errors.slice(0, 12).join("\n"));
await browser.close();
