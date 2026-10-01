#!/usr/bin/env node
/**
 * Records the walkthrough video (brief 17.3): the landing film scrolled at human speed with
 * pauses at each chapter, then the app — Tonight (a chip-in), a party, the Draw, the Guest
 * Pass flow, an invite, the Diary, the House Fund. Output: review/video/*.webm.
 *   BASE=http://localhost:3200 node scripts/record.mjs [--w 1440 --h 900] [--name desktop]
 */
import { chromium } from "@playwright/test";
import { mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? d : args[i + 1];
};
const W = +opt("w", 1440);
const H = +opt("h", 900);
const name = opt("name", "desktop");
const mobile = W < 800;
const BASE = process.env.BASE ?? "http://localhost:3200";
const dir = path.resolve(import.meta.dirname, "../../../review/video", name);
await mkdir(dir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
  recordVideo: { dir, size: { width: W, height: H } },
});
const page = await ctx.newPage();
const wait = (ms) => page.waitForTimeout(ms);

/** Scroll by `px` with small wheel steps (or touch-like steps on mobile) at `speed` px/s. */
async function glide(px, speed = 900) {
  const step = 60;
  const n = Math.ceil(px / step);
  const dt = (step / speed) * 1000;
  await page.mouse.move(W / 2, H / 2);
  for (let i = 0; i < n; i++) {
    if (mobile) await page.evaluate((s) => window.scrollBy(0, s), step);
    else await page.mouse.wheel(0, step / 0.9);
    await wait(dt);
  }
}
async function to(sel, frac = 0) {
  return page.evaluate(
    ([s, f]) => {
      const el = document.querySelector(s);
      const r = el.getBoundingClientRect();
      return Math.round(r.top + scrollY + f * (el.offsetHeight - innerHeight));
    },
    [sel, frac],
  );
}
async function glideTo(y, speed) {
  const cur = await page.evaluate(() => scrollY);
  if (y > cur) await glide(y - cur, speed);
}

/* ------------------------------ The landing film ------------------------------ */
await page.goto(`${BASE}/`, { waitUntil: "load" });
await wait(7000); // preloader, iris, hero intro
if (!mobile) {
  await page.mouse.move(W * 0.25, H * 0.42);
  await wait(900);
  await page.mouse.move(W * 0.7, H * 0.5, { steps: 20 });
  await wait(900);
}
// Act 1: push, seal, dolly, caption, into the paper.
await glideTo(await to("#act-1", 0.6), 420);
await wait(1400);
await glideTo(await to("#act-1", 1), 500);
await wait(900);
// Act 2: the seven traditions.
await glideTo(await to("#act-2", 0.8), 1500);
await wait(900);
await glideTo(await to("#act-2", 1), 600);
await wait(1600);
// Bunting + Act 3: three scenes with pauses.
for (const f of [0.25, 0.58, 0.92]) {
  await glideTo(await to("#act-3", f), 800);
  await wait(1500);
}
// Act 4: every chapter, slowly.
for (const f of [0.03, 0.145, 0.27, 0.385, 0.505, 0.605, 0.775, 0.935, 1]) {
  await glideTo(await to("#act-4", f), 850);
  await wait(1500);
}
// Act 5, 6, 7.
for (const [sel, list] of [
  ["#act-5", [0.3, 0.66, 0.9, 1]],
  ["#act-6", [0.4, 0.64, 0.9]],
  ["#act-7", [0.7]],
]) {
  for (const f of list) {
    await glideTo(await to(sel, f), 900);
    await wait(1500);
  }
}
// Finale + footer.
await glideTo(await to("#rsvp", 1), 700);
await wait(2000);
await glide(1200, 900);
await wait(2000);
if (!mobile) {
  await page.mouse.move(W * 0.3, H * 0.7, { steps: 15 });
  await page.mouse.move(W * 0.7, H * 0.72, { steps: 25 });
  await wait(1200);
}

/* ------------------------------ The app ------------------------------ */
const visit = async (route, ms = 3000) => {
  await page.goto(`${BASE}${route}`, { waitUntil: "load" });
  await wait(ms);
};
await visit("/tonight", 2500);
// Chip in: the chit is stamped, the row settles, a toast slides in.
const chip = page.getByRole("button", { name: "Chip in now" }).first();
if (await chip.isVisible()) {
  await chip.click();
  await wait(3500);
}
await glide(900, 700);
await wait(1500);
await visit("/parties", 2500);
await visit("/p/asha", 2500);
if (!mobile) {
  await page.locator("[data-seat='4']").click();
  await wait(1500);
}
await page.getByRole("tab", { name: "Guests" }).click();
await wait(1500);
await visit("/p/asha/draw", 10000);
await visit("/parties/new", 2000);
await page.getByRole("radio", { name: "tanda" }).click();
await wait(1200);
await page.getByRole("button", { name: "Continue" }).click();
await wait(1400);
await visit("/invite/susu", 4500);
await glide(700, 600);
await wait(1200);
// Guest Pass, end to end.
await visit("/pass", 2500);
await page.fill('input[type="email"]', "guest@kitty.test");
await wait(400);
await page.click('button[type="submit"]');
await wait(1200);
await page.setInputFiles('input[type="file"]', path.resolve(import.meta.dirname, "../../../../docs/ref/logo-concept.png"));
await wait(2200);
await page.getByRole("button", { name: "Make my pass" }).click();
await wait(15000);
await visit("/diary", 3000);
await page.getByRole("button", { name: "Seats" }).click();
await wait(2000);
await visit("/house", 3500);
await glide(700, 600);
await wait(1500);

await ctx.close();
await b.close();
const files = (await readdir(dir)).filter((f) => f.endsWith(".webm"));
const out = path.join(dir, `../kitty-${name}.webm`);
await rename(path.join(dir, files[0]), out);
console.log(out);
