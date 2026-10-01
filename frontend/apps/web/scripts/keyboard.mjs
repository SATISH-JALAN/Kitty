#!/usr/bin/env node
/**
 * Keyboard-only audit (brief 15.3 / 17.4): tabs through each route and flags focus stops
 * inside aria-hidden, invisible or zero-size elements, stops not scrolled into view, and
 * focus traps.
 *
 *   node scripts/keyboard.mjs ["/,/tonight"] [w] [h]      (BASE defaults to http://localhost:3100)
 */
import { chromium } from "@playwright/test";
const routes = (process.argv[2] ?? "/,/tonight,/parties,/parties/new,/p/asha,/diary,/diary/show,/house,/settings,/pass,/invite/susu,/p/asha/draw").split(",");
const w = +(process.argv[3] ?? 1440), h = +(process.argv[4] ?? 900);
const b = await chromium.launch();
for (const r of routes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { sessionStorage.setItem("kitty:preloaded", "1"); } catch {} });
  await p.goto((process.env.BASE ?? "http://localhost:3100") + r, { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const seen = new Map();
  const problems = [];
  let stops = 0, repeatRun = 0, last = "";
  for (let i = 0; i < 160; i++) {
    await p.keyboard.press("Tab");
    await p.waitForTimeout(90);
    const f = await p.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      let hiddenAnc = null, invisible = false;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        if (n.getAttribute("aria-hidden") === "true" && !hiddenAnc) hiddenAnc = n.className?.toString().slice(0, 40) || n.tagName;
        const s = getComputedStyle(n);
        if (s.visibility === "hidden" || +s.opacity === 0 || s.display === "none") invisible = true;
      }
      const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
      return { key: `${el.tagName}|${label}|${Math.round(r.left)},${Math.round(r.top + scrollY)}`, label, tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height), hiddenAnc, invisible, inView, outline: cs.outlineStyle };
    });
    if (!f) { if (stops) break; else continue; }
    if (f.key === last) { repeatRun++; if (repeatRun > 3) { problems.push(`TRAP at "${f.label}"`); break; } } else repeatRun = 0;
    last = f.key;
    if (seen.has(f.key)) break; // wrapped around
    seen.set(f.key, f);
    stops++;
    if (f.hiddenAnc) problems.push(`in aria-hidden (${f.hiddenAnc}): ${f.tag} "${f.label}"`);
    if (f.invisible) problems.push(`invisible: ${f.tag} "${f.label}"`);
    if (f.w < 2 || f.h < 2) problems.push(`zero-size: ${f.tag} "${f.label}"`);
    if (!f.inView) problems.push(`not scrolled into view: ${f.tag} "${f.label}"`);
  }
  console.log(`${r.padEnd(14)} ${String(stops).padStart(3)} stops  ${problems.length ? "\n   - " + [...new Set(problems)].join("\n   - ") : "ok"}`);
  await ctx.close();
}
await b.close();
