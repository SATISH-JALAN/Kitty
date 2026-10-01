# Kitty — web (`apps/web`)

The landing film and the app for **Kitty — savings parties**, built from `docs/FRONTEND_BRIEF.md` (*The Paper Masquerade*). Decisions, deviations and open issues are in `docs/STORYBOARD.md`.

Devnet only · test funds · test identities.

## Run

```bash
pnpm install          # also fetches Boska + Switzer (ITF licence: not committed)
pnpm art              # once: keys, splits and encodes the painted art into public/art
pnpm dev              # http://localhost:3100
```

`pnpm art` reads the source PNGs from `~/Downloads/kitty visuals` (set `ART_SRC` to change it). If a file is missing, `<Art>` renders a placeholder at the final size.

## Checks

| Command | What it checks |
| --- | --- |
| `pnpm check` | Contrast (AA on every text pair), copy compliance (banned words, brief 0.4), typecheck, SDK tests (Act 4 numbers) |
| `node apps/web/scripts/shot.mjs <route> [--steps …] [--reduced] [--nojs]` | Screenshots and scroll captures for the review loop (brief 17.3) → `review/` |
| `node apps/web/scripts/overlap.mjs [--landing]` | Colliding text and controls at 1440 and 390 |
| `pnpm brand` | Regenerates the logo files in `public/brand` from the Bow Mask geometry |

## Routes

| Route | World | Notes |
| --- | --- | --- |
| `/` | Night ↔ Paper | Acts 0–7, Finale, footer. The wax seal travels through every act |
| `/pass` | Night | Guest Pass: sign-in, test QR envelope, lantern stepper, never-stored slip |
| `/invite/[id]` | Night → Paper | Invite card, rules sheet, RSVP stepper. Try `/invite/susu` (a forming party) |
| `/tonight` | Paper | Home: due chip-ins, next Draw, keepsafe, grace hours |
| `/parties`, `/parties/new` | Paper | Invite cards; the host wizard |
| `/p/[id]`, `/p/[id]/draw` | Paper / Night | Party table; the Draw ceremony (`/p/asha/draw`) |
| `/diary`, `/diary/show` | Paper | The booklet; Show a page |
| `/house`, `/settings` | Paper | House Fund; recovery and faucet |
| `/lab/masks`, `/lab/components`, `/lab/motion` | — | Dev showcases (404 in production unless `NEXT_PUBLIC_LAB=1`) |

Append `?demo=loading|empty|error` to app routes to see the designed states; `/diary?demo=onhold` shows the settle-up slip; `/pass?demo=prooffail|registered` shows the proof errors.

## Environment

| Variable | Effect |
| --- | --- |
| `NEXT_PUBLIC_KITTY_API` | Indexer API base. Unset: screens use labelled devnet sample data (`data/sample.ts`) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy email login. Unset: a demo sign-in |
| `NEXT_PUBLIC_KITTY_PROGRAM_ID` | Shown (with copy → stamp) in the footer |
| `NEXT_PUBLIC_GITHUB_URL`, `NEXT_PUBLIC_DOCS_URL` | Footer links (hidden when unset) |
| `NEXT_PUBLIC_SITE_URL` | Metadata base for OG tags |

## Layout

```
apps/web/app/(marketing)   landing: _acts/Act0…Act7, Finale, Footer, landing.css
apps/web/app/(app)         the app shell and Paper screens
apps/web/app/(ceremony)    Night screens without app chrome
apps/web/components        chrome (header, cursor, seal director, transitions), stage (table, door, booklet…)
apps/web/data              the data layer (TanStack Query) + sample data
apps/web/webgl             LanternSky.ts — the only three.js file
packages/ui                tokens, components, motion primitives, generators (masks, emblems, patterns), brand
packages/sdk               fee maths (tested), formatting, party names, traditions
```
