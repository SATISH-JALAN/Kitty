#!/usr/bin/env node
/**
 * Overlap audit (self-review, brief 17.3): loads routes at desktop and phone sizes and
 * reports visible text / controls whose boxes collide with other visible text / controls.
 *
 *   node scripts/overlap.mjs [--w 1440 --h 900] [--routes "/tonight,/pass"] [--landing]
 *
 * Elements can opt out with [data-overlap-ok] (intended overlaps, e.g. the hero headline
 * over the arch). Fixed chrome (header, Devnet tag, tab bar) is checked against content
 * only at its real viewport position.
 */
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? d : args[i + 1];
};
const base = process.env.BASE ?? "http://localhost:3100";
const sizes = opt("w", null) ? [[+opt("w"), +opt("h", 900)]] : [[1440, 900], [390, 844]];
const routes = (opt("routes", "/tonight,/parties,/parties/new,/p/asha,/p/susu,/p/office,/diary,/diary/show,/house,/settings,/pass,/invite/susu,/p/asha/draw")).split(",");
const landing = args.includes("--landing");

const b = await chromium.launch();
let total = 0;

async function audit(page, label, { checkFixed = true } = {}) {
  const hits = await page.evaluate((checkFixed) => {
    const vis = (el) => {
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || +s.opacity < 0.05) return false;
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (+ps.opacity < 0.05 || ps.visibility === "hidden") return false;
        if (p.hasAttribute("aria-hidden") && p.getAttribute("aria-hidden") === "true" && !p.closest("[data-overlap-check]")) return false;
      }
      return true;
    };
    const ok = (el) => el.closest("[data-overlap-ok], .sr-only, .k-cursor-ring, .k-cursor-dot, .focus-ring, .preloader");
    // Leaf text blocks + controls.
    const all = Array.from(document.querySelectorAll("body *")).filter((el) => {
      if (ok(el)) return false;
      const isCtrl = el.matches("a, button, input, [role=button], [role=tab], [role=radio]");
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
      return (isCtrl || hasText) && vis(el);
    });
    const boxes = [];
    for (const el of all) {
      // Text box: use a range over direct text for text nodes, the element box for controls.
      let r;
      if (el.matches("a, button, input, [role=button], [role=tab], [role=radio]")) r = el.getBoundingClientRect();
      else {
        const range = document.createRange();
        range.selectNodeContents(el);
        r = range.getBoundingClientRect();
      }
      if (r.width < 4 || r.height < 4) continue;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      const clip = el.closest("[style*='overflow'], .hero-slot, .ch-slot, .cap-slot");
      boxes.push({ el, r, name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40), fixed: !!el.closest(".devnet-tag, .tabbar, .dock-action, .draw-close"), sticky: !!el.closest(".site-header, .app-header") });
      void clip;
    }
    const out = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const c = boxes[j];
        if (a.el.contains(c.el) || c.el.contains(a.el)) continue;
        // Content scrolling under the sticky header is normal; only header-vs-header matters.
        if (a.sticky !== c.sticky) continue;
        const ix = Math.min(a.r.right, c.r.right) - Math.max(a.r.left, c.r.left);
        const iy = Math.min(a.r.bottom, c.r.bottom) - Math.max(a.r.top, c.r.top);
        if (ix > 3 && iy > 3) {
          // Is one actually painted over the other? (hit-test the overlap centre)
          const cx = Math.max(a.r.left, c.r.left) + ix / 2;
          const cy = Math.max(a.r.top, c.r.top) + iy / 2;
          const top = document.elementFromPoint(cx, cy);
          if ((a.fixed || c.fixed) && !checkFixed) continue;
          if (a.fixed && c.fixed) continue;
          out.push({ a: a.name, b: c.name, area: Math.round(ix * iy), fixed: a.fixed || c.fixed, top: top ? (top.textContent || top.tagName).trim().slice(0, 30) : "" });
        }
      }
    return out.sort((x, y) => y.area - x.area).slice(0, 25);
  }, checkFixed);
  if (hits.length) {
    total += hits.length;
    console.log(`\n■ ${label} — ${hits.length}`);
    for (const h of hits) console.log(`   ${h.fixed ? "[fixed] " : ""}"${h.a}"  ×  "${h.b}"  (${h.area}px²)`);
  } else console.log(`✓ ${label}`);
}

for (const [w, h] of sizes) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 800, isMobile: w < 800 });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("kitty:preloaded", "1");
    } catch {}
  });
  const page = await ctx.newPage();
  for (const r of routes) {
    await page.goto(base + r, { waitUntil: "networkidle" });
    await page.waitForTimeout(r.includes("draw") ? 9500 : 2200);
    await audit(page, `${w} ${r}`);
    if (!r.includes("draw")) {
      const hgt = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = h; y < hgt - 100; y += h) {
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(500);
        await audit(page, `${w} ${r} @${y}`, { checkFixed: false });
      }
      // At the very end nothing may stay hidden under fixed chrome.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      await audit(page, `${w} ${r} @end`);
    }
  }
  if (landing) {
    await page.goto(base + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(3500);
    const hgt = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < hgt; y += Math.round(h * 0.8)) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(1400);
      await audit(page, `${w} / @${y}`);
    }
  }
  await ctx.close();
}
await b.close();
console.log(`\n${total} overlaps`);
