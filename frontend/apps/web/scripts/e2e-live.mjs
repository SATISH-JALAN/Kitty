// Live rehearsal in a real browser against a running API + chain (local validator or devnet):
// Guest Pass (on-device test QR, real Anon Aadhaar proof) → host a party → three guests RSVP.
//   BASE=http://localhost:3100 API=http://localhost:8787 node scripts/e2e-live.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const API = process.env.API ?? "http://localhost:8787";
const OUT = new URL("../../../review/e2e/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
mkdirSync(OUT, { recursive: true });
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0).padStart(4)}s]`, ...a);

// PROFILE keeps the browser profile between runs, so the 282 MB Anon Aadhaar keys download once.
const opts = { headless: !process.env.HEADED, viewport: { width: 1280, height: 860 } };
const ctx = process.env.PROFILE ? await chromium.launchPersistentContext(process.env.PROFILE, opts) : await (await chromium.launch(opts)).newContext(opts);
const browser = { close: () => ctx.close() };
const page = ctx.pages()[0] ?? (await ctx.newPage());
// Fresh guests every run (one Guest Pass per person).
const RUN = Date.now().toString(36).slice(-5);
page.on("console", (m) => {
  if (m.type() === "error") log("console error:", m.text().slice(0, 200));
});
page.on("pageerror", (e) => log("page error:", e.message.slice(0, 200)));

async function shot(name) {
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false }).catch(() => {});
}

async function signOut() {
  if (!page.url().startsWith(BASE)) await page.goto(`${BASE}/pass`);
  await page.evaluate(() => localStorage.removeItem("kitty:session"));
}

async function getPass(email) {
  await signOut();
  await page.goto(`${BASE}/pass`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /No test QR\? Make one/ }).click();
  await page.getByRole("button", { name: "Make my pass" }).click({ timeout: 30_000 });
  log(`${email}: proving Guest Pass…`);
  await page.getByText("You’re on the guest list.").or(page.getByText("You're on the guest list.")).waitFor({ timeout: 12 * 60_000 });
  log(`${email}: Guest Pass ✓`);
  await shot(`pass-${email.split("@")[0]}`);
}

async function hostParty(title) {
  await page.goto(`${BASE}/parties/new`);
  const cont = () => page.getByRole("button", { name: /^Continue/ }).first().click();
  await cont(); // tradition (default)
  await page.getByLabel(/^Name your/).fill(title);
  await cont();
  // 4 guests
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "One fewer guest" }).click();
  await cont();
  await page.getByRole("radio", { name: "Every 3 minutes (Demo)" }).last().click();
  await cont();
  await page.getByRole("radio", { name: /Seating plan/ }).last().click();
  await cont();
  await cont(); // host fee
  await page.getByRole("button", { name: /Create/ }).click();
  const link = await page.locator(".share-link .type-mono").getAttribute("title", { timeout: 90_000 });
  log(`party created: ${link}`);
  await shot("party-created");
  return link;
}

async function rsvp(link, who) {
  await page.goto(link);
  await page.getByRole("button", { name: /RSVP/ }).first().click({ timeout: 60_000 });
  await page.getByRole("dialog").getByRole("button", { name: /RSVP/ }).click();
  log(`${who}: RSVP…`);
  await page.getByText(/At this party you/).waitFor({ timeout: 6 * 60_000 });
  log(`${who}: RSVP ✓`);
  await shot(`rsvp-${who}`);
}

try {
  await getPass(`asha.${RUN}@kitty.test`);
  const link = await hostParty("Rehearsal party");
  await rsvp(link, "asha");
  for (const g of ["ben", "chen", "dee"]) {
    await getPass(`${g}.${RUN}@kitty.test`);
    await rsvp(link, g);
  }
  const id = link.match(/invite\/(\d+)/)[1];
  const party = await (await fetch(`${API}/v1/parties/${id}`)).json();
  log(`party ${id}: status ${party.status}, ${party.rsvps}/${party.guests} guests, seats: ${party.seats.map((s) => s.name).join(", ")}`);
  if (party.status !== "active") throw new Error("party should be full and active");
  log("rehearsal passed");
} catch (e) {
  await shot("failure");
  log("FAILED:", e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
