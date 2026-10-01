# Kitty frontend: progress log

This is the running record of the frontend build: what's done, what's left, and what changed in each session. Update it at the end of every session.

- **Spec:** `docs/FRONTEND_BRIEF.md` ("The Paper Masquerade")
- **Decisions, tuned values, per-act storyboards, review log:** `docs/STORYBOARD.md`
- **Deadline:** Oct 12, 2026 (P0 Oct 4 · P1 Oct 8 · P2 Oct 10 · polish Oct 11)
- **Backend:** not built yet. It's next. The frontend runs on labelled devnet sample data until then.

---

## Status at a glance (verified Sep 30, 2026, evening)

The frontend is **complete for P0, P1 and P2**. The one piece of polish still open is the Lighthouse mobile performance pass, deferred until after the backend (below). Wiring the real backend is the other open item, and it's blocked until the backend exists.

| Area | State |
| --- | --- |
| Foundations (tokens, fonts, grain, paper filters, torn edges, motion, icons, `<Art>`, generators, brand SVGs) | ✅ Done |
| `/lab/components`, `/lab/motion` (34 primitives), `/lab/masks` (48 masks) | ✅ Done (404 in prod unless `NEXT_PUBLIC_LAB=1`) |
| Landing: Acts 0–7, Finale, footer, WebGL lantern sky | ✅ Done, fix pass + polish pass |
| App screens: `/pass`, `/invite/[id]`, `/tonight`, `/parties`, `/parties/new`, `/p/[id]`, `/p/[id]/draw`, `/diary`, `/diary/show`, `/house`, `/settings` | ✅ Done, fix pass + polish pass |
| Mobile tab bar, route transitions, cursor, header world switch | ✅ Done |
| OG image, favicon, meta, text cylinder | ✅ Done |
| Share card as image (P2, `/parties/new`) | ✅ Done (`apps/web/lib/shareCard.ts`) |
| Sound (P2) | ✂️ Cut by owner decision (STORYBOARD C20) |
| No-JS page | ✅ Every act shows a designed end state |
| Reduced motion | ✅ Every act has static panels with art |
| Keyboard-only | ✅ Every route, no traps, focus ring visible |
| 1280×800 and 390×844 layouts | ✅ Zero overlaps on app routes (phones: only content scrolling under the tab bar, as designed) |
| JS size budgets (15.2) | ✅ App screens under 250 KB · ⚠️ landing 263 KB vs 180 KB (not reachable, see below) |
| **Lighthouse mobile performance** | ⏳ **Deferred until after the backend** |
| **Real backend / Privy / ZK prover** | ⏳ Blocked: backend not built yet |

### Checks run on Sep 30 (evening)

| Check | Result |
| --- | --- |
| `pnpm contrast` | ✅ All pairs pass AA |
| `pnpm lint:copy` | ✅ No banned words |
| SDK tests (`vitest`) | ✅ 13/13 |
| Typecheck (`turbo run typecheck`) | ✅ 3/3 |
| `next build` | ✅ All routes |
| Landing before/after screenshots (24 scroll positions) | ✅ Identical at matching positions, same pin lengths, 0 console errors |
| Overlap audit, app routes at 1280×800 | ✅ 0 |
| Overlap audit, app routes at 390×844 | ✅ Only content under the fixed tab bar (expected) + two ≤24 px² seat-label touches |
| Keyboard audit (all routes) | ✅ (the one flag is a visually hidden checkbox whose box shows the focus outline) |

### Measured JS (gzip, initial scripts, `noModule` polyfill excluded)

| Route | Start of day | Now | Budget |
| --- | --- | --- | --- |
| `/` (landing) | 284 KB | **263 KB** | 180 KB |
| `/tonight` | 263 KB | **244 KB** | 250 KB |
| `/parties` | 261 KB | **242 KB** | 250 KB |
| `/parties/new` | 254 KB | **235 KB** | 250 KB |
| `/diary` | 259 KB | **240 KB** | 250 KB |
| `/house` | 256 KB | **236 KB** | 250 KB |
| `/settings` | 244 KB | **224 KB** | 250 KB |
| `/pass` | 250 KB | **230 KB** | 250 KB |

Why 180 KB isn't reachable on the landing: Next 16 + React 19 are ≈134 KB on their own, and GSAP core + ScrollTrigger (which the whole page runs on) add ≈45 KB. (Deferring Acts 3–7 got it to 235 KB, but React dropped their server HTML before they loaded, so it was reverted on Oct 1. Don't retry it without solving that.)

---

## What's left (in priority order)

### 1. Backend (next, owner is building it)
When it exists, the frontend swaps are small:

| Swap | Where | How |
| --- | --- | --- |
| Indexer API | `apps/web/data/api.ts` | Set `NEXT_PUBLIC_KITTY_API`. Hooks: `useMe`, `useParties`, `useParty`, `useHouse`, `useDraw`, `useChipIn`. The sample layer switches off automatically (`IS_SAMPLE`) |
| Privy login | `apps/web/data/session.ts` | Set `NEXT_PUBLIC_PRIVY_APP_ID`. Demo email sign-in is the fallback |
| ZK prover | `apps/web/lib/prover.ts` | Replace `runMock` with the `packages/zk` Web Worker (doesn't exist yet). The event shape stays the same |
| Invite creation | `apps/web/app/(app)/parties/new/page.tsx` (`create`) | Currently fakes a 2.2 s create and a sample link |

### 2. Lighthouse mobile performance pass (deferred: do after the backend)
Targets from brief 15.2: Performance ≥ 80, Accessibility ≥ 95, Best Practices ≥ 95.

First run (Sep 30, Lighthouse 12.8, mobile, before the fixes listed under "already applied"):

| Route | Perf | A11y | BP | SEO | LCP | TBT |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 34 | 96 | 100 | 100 | 11.5 s | 2,880 ms |
| `/tonight` | 85 | 94 | 100 | 100 | 4.1 s | 90 ms |
| `/parties/new` | 80 | 90 | 100 | 100 | 4.8 s | 50 ms |
| `/pass` | 52 | 94 | 100 | 100 | 6.0 s | 850 ms |

Already applied after that run, **not yet re-measured**:
- The sky's three.js chunk is only fetched on devices that pass the support check, and only after the hero reveal (`components/stage/SkyCanvas.tsx`, `webgl/support.ts`).
- The Guest Pass door image loads eagerly at high priority (`<Door priority>`).
- A11y: SplitText `aria: "none"`, Devnet button `aria-label`, wizard chips back to plum (contrast).

Next steps for the pass:
- Re-run: `CHROME_PATH=<playwright chromium> npx -y lighthouse@12 http://localhost:3100/<route> --only-categories=performance,accessibility,best-practices,seo` against `next start`. The Windows EPERM at exit is only the temp-folder cleanup; the report is written.
- Landing LCP is dominated by the first-visit preloader (it waits for fonts + hero layers H-2…H-5). Options to discuss (these change the experience, so ask first): gate the preloader on fewer layers, cap it lower than 6 s, or let the headline paint under the veil.
- Remaining landing TBT: React hydration + ScrollTrigger setup for Acts 0–2 under 4× CPU throttling.

### 3. Open questions for others
- **Art:** re-export H-2…H-5 at 2880 px wide (H-4 especially; the dolly is capped at 8× because it pixelates). No code change needed (STORYBOARD C3).
- **Product:** is the late fee charged per missed night or once? The UI currently shows Settle up $260.00 = $250 + 5 × $2. It's one constant in `packages/sdk/src/fees.ts` (STORYBOARD C10).

### 4. Housekeeping
- The project is **not a git repo** yet. Run `git init` and make a first commit. A snapshot of the source from before the Sep 30 evening changes was saved in the Claude session scratchpad (`kitty-src-before.tgz`); it isn't part of the repo.

---

## How to run and verify

```bash
pnpm install          # also fetches Boska/Switzer (licence: not committed)
pnpm art              # rebuild apps/web/public/art from ~/Downloads/kitty visuals
pnpm dev              # http://localhost:3100
pnpm check            # contrast + copy lint + typecheck + tests
cd apps/web && npx next build && npx next start --port 3100
node scripts/overlap.mjs --landing              # overlap audit (server running)
node scripts/keyboard.mjs                       # keyboard-only audit, every route
node scripts/shot.mjs / --steps "0,900,1800"    # screenshots into review/
BASE=http://localhost:3100 node scripts/record.mjs --name desktop   # walkthrough video
```
On Git Bash, prefix commands that take a route (`/pass`, `/p/x`) with `MSYS_NO_PATHCONV=1`.

---

## Changelog

### Oct 1, 2026, session 5 (fixes from the owner's testing)
- **Blank hero after scrolling back up:** Act 2 hid Act 1 twice (a scroll callback and a step in its scrubbed timeline); the scrub replayed late and re-hid the hero. Now only the scroll callbacks decide (`Act2Traditions.tsx`).
- **Late-act deferral reverted:** React discarded the prerendered Acts 3–7 before they loaded (page height jumped). `page.tsx` and `Header.tsx` are back to their originals; `LateActs.tsx` removed. Landing is 263 KB.
- **Devnet tag over the hero CTA:** on desktop the floating tag now shows only while the header (which has its own tag) is tucked away.
- **Act 3 title chopped by a line:** waiting title cards peeked over their slot padding; they now wait a full card height + 40 px away.
- **Hero CTAs cut off on wide-but-short windows:** the headline is now also capped by height (`min(9.6vw, 15.5svh)`, identical at 1440×900), and short desktop windows (≤ 780 px tall) get less top padding. CTAs fit from 1536×730 up to 1920×1030.
- **Hero half-gone during the first scroll + light header over the hero:** the header built its world triggers before the acts pinned, when Act 2 (pulled up under the hero) was at the top, so it switched to Paper; it now builds them a frame later and always reads the world from the live layout (`Header.tsx`). The hero text column (headline, sub, CTAs) now leaves together in the first 8% of the scroll, before the arch opens, instead of the headline vanishing while the sub and CTAs lingered (`Act1Invitation.tsx`).
- **Act 4 felt like it skipped nights:** chapter snapping held the page on a chapter, then jumped ahead. Snapping is removed from Act 4 (owner decision); the story now follows the scroll exactly. Verified at a steady scroll: all 8 chapters appear in order (chip-in → Draw → takes the kitty, N4 → keepsafe, N5 → misses, N6 → still finishes, N7–10 → Farewell). Acts 3, 5 and 6 still snap.
- **Act 4 glowing lines:** removed the House Fund net, its glowing stream and the dashed plus-ones line + label (owner: keep it simple). The waterfall chapter now shows only the short keepsafe stream; the ledger slip carries From plus-ones $0 / From the House Fund $250. The unused `Net` component was deleted from `components/stage/Props.tsx`.

### Sep 30, 2026, session 4 (size, share card, polish)
- **Bundle size:** landing 284 → 235 KB (263 KB after the Oct 1 revert), app screens down 10–20 KB each (all under 250). TanStack Query moved to `components/QueryProvider.tsx` (app + ceremony layouts only); Lenis loaded dynamically in `MotionProvider`; Flip and MorphSVG fetched on idle (`packages/ui/src/motion/flip.ts`, `morph.ts`); MotionPath opt-in (`motionPath.ts`, `primitives/chits.ts`); Acts 3–7 + Finale + footer hydrated late via `_acts/LateActs.tsx` (reverted Oct 1, see session 5).
- **Sound:** removed (unused copy string), recorded as STORYBOARD C20.
- **Share card as image:** `lib/shareCard.ts` + button and note in the wizard's share row.
- **No JS:** CSS-geometry hero frame, static panels for Acts 2–6 via `<noscript>`, one seal, the finale seal hidden, outlined React boundaries shown in place.
- **Reduced motion:** Act 3 stamps, Act 5 door/masks/notice, Act 6 booklet + page, finale word fix.
- **Layout:** wizard guest stepper on phones, sticky invite card (`overflow: clip`), fee lines keep items together, ceremony Devnet tag scrolls on phones.
- **Lighthouse fixes (not re-measured):** reveal-gated sky and late acts (`lib/reveal.ts`), door priority on `/pass`, SplitText aria, Devnet button label, wizard chip contrast.
- **Tooling:** added `apps/web/scripts/keyboard.mjs`; removed the dead `review` script from `apps/web/package.json`.
- **Video:** re-recorded `review/video/kitty-desktop.*` and `kitty-phone.*` on the final build.

### Sep 30, 2026, session 3 (status check)
- Audited the build against brief 17.2 / 17.4 and re-ran every check.
- Fixed the `@kitty/ui` typecheck (`declare const process` in `packages/ui/src/motion/gsap.ts`).
- Created this file.

### Sep 30, 2026, session 2 (fix pass)
- Reviewed every screen and act frame by frame at 1440×900 and 390×844 and fixed the layout issues (STORYBOARD §7, "Fix pass").

### Sep 29–30, 2026, session 1 (build)
- Wrote `docs/STORYBOARD.md`. Built foundations, labs, the full landing page, every app screen, and the SDK fee maths with tests.
