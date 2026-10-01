/**
 * Generates the brand files (brief 6.4) into apps/web/public/brand:
 *   kitty-mark / -night / -mono (+ -mono-moon), kitty-wordmark…, kitty-lockup…,
 *   kitty-lockup-stacked…, kitty-seal…, favicon.svg, safari-pinned-tab.svg,
 *   icon-180.png, icon-512.png
 * and packages/ui/src/brand/wordmark.generated.ts (outlined glyph paths for <Wordmark>).
 *
 * The wordmark is outlined from Boska 500 so the logo never loads the font.
 * Fontshare's TTFs are cached in node_modules/.cache (licence: outlining a logo is
 * normal use; the font files are not redistributed).
 *
 * Run: pnpm brand
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
// @ts-expect-error fontkit ships no types
import * as fontkit from "fontkit";
import sharp from "sharp";
import {
  BACK_OFFSET,
  BRAND,
  EYE_L,
  EYE_R,
  KNOT,
  LOOP_L,
  LOOP_R,
  SMALL,
  TAIL_L,
  TAIL_R,
  TAIL_WIDTH,
} from "../packages/ui/src/brand/bowGeometry";
import { sealBlob } from "../packages/ui/src/brand/seal";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "apps/web/public/brand");
const CACHE = path.join(ROOT, "node_modules/.cache/kitty-fonts");

async function exists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function ttf(family: "boska" | "switzer"): Promise<string> {
  const file = path.join(CACHE, `${family}.ttf`);
  if (await exists(file)) return file;
  await mkdir(CACHE, { recursive: true });
  const css = await (await fetch(`https://api.fontshare.com/v2/css?f[]=${family}@1&display=swap`)).text();
  const url = /url\('([^']+\.ttf)'\)/.exec(css)?.[1];
  if (!url) throw new Error(`No TTF for ${family}`);
  const res = await fetch(url.startsWith("//") ? `https:${url}` : url);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

/* ------------------------------ The mark ------------------------------ */

type Variant = "paper" | "night" | "mono" | "mono-moon";

function markGroup(v: Variant, opts: { small?: boolean; noBack?: boolean; trim?: boolean } = {}) {
  const eyeL = opts.small ? SMALL.eyeL : EYE_L;
  const eyeR = opts.small ? SMALL.eyeR : EYE_R;
  const tw = opts.small ? SMALL.tailWidth : TAIL_WIDTH;
  const loops = `${LOOP_L} ${eyeL} ${LOOP_R} ${eyeR}`;
  const tails = `<path d="${TAIL_L}"/><path d="${TAIL_R}"/>`;
  const knot = `<circle cx="${KNOT.cx}" cy="${KNOT.cy}" r="${KNOT.r}"/>`;
  if (v === "mono" || v === "mono-moon") {
    const c = v === "mono" ? BRAND.ink : BRAND.moon;
    return `<g fill="${c}"><path fill-rule="evenodd" d="${loops}"/>${knot}</g><g fill="none" stroke="${c}" stroke-width="${tw}" stroke-linecap="round">${tails}</g>`;
  }
  const back = opts.noBack
    ? ""
    : `<g transform="translate(${BACK_OFFSET.x} ${BACK_OFFSET.y})" fill="${BRAND.plum}"><path fill-rule="evenodd" d="${loops}"/>${knot}<g fill="none" stroke="${BRAND.plum}" stroke-width="${tw}" stroke-linecap="round">${tails}</g></g>`;
  const trim = opts.trim
    ? `<g fill="none" stroke="${BRAND.gold}" stroke-width="1" opacity=".9"><path d="${EYE_L}"/><path d="${EYE_R}"/></g>`
    : "";
  return `${back}<path fill="${BRAND.marigold}" fill-rule="evenodd" d="${loops}"/>${trim}<g fill="none" stroke="${BRAND.twine}" stroke-width="${tw}" stroke-linecap="round">${tails}</g><circle cx="${KNOT.cx}" cy="${KNOT.cy}" r="${KNOT.r}" fill="${BRAND.twine}"/>`;
}

const MARK_VB = "4 12 236 118";

function svg(viewBox: string, body: string, title = "Kitty") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;
}

/* ---------------------------- The wordmark ---------------------------- */

interface Outlined {
  d: string;
  glyphs: { d: string; x0: number; x1: number }[];
  width: number;
  ascent: number;
  descent: number;
  dot: { x: number; y: number };
}

/** "Kıtty" at Boska 500, tracking −0.02em, custom kerning; returns y-down paths in font units. */
async function outlineWordmark(): Promise<Outlined> {
  const font = fontkit.openSync(await ttf("boska")).getVariation({ wght: 500 });
  const upm = font.unitsPerEm as number;
  const tracking = -0.02 * upm;
  // Hand-tuned pair adjustments (units of 1/1000 em), checked at 96 px.
  const kern: Record<string, number> = { "Kı": 6, "ıt": 4, tt: -10, ty: -18 };
  const text = "Kıtty";
  let x = 0;
  const parts: string[] = [];
  const glyphs: { d: string; x0: number; x1: number }[] = [];
  let dot = { x: 0, y: 0 };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const g = font.glyphForCodePoint(ch.codePointAt(0)!);
    const d = g.path.translate(x, 0).scale(1, -1).toSVG();
    parts.push(d);
    glyphs.push({ d, x0: x, x1: x + (g.advanceWidth as number) });
    if (ch === "ı") {
      // Where the i's dot would be: its centre from the dotted glyph.
      const gi = font.glyphForCodePoint(105);
      const bb = gi.path.bbox;
      // Optical centre sits a little above the dot so the loops clear the K serif (−14% size, see STORYBOARD).
      dot = { x: x + (gi.advanceWidth as number) / 2, y: -(bb.maxY - 53) - 48 };
    }
    const pair = text.slice(i, i + 2);
    x += (g.advanceWidth as number) + (i < text.length - 1 ? tracking + (kern[pair] ?? 0) : 0);
  }
  return { d: parts.join(" "), glyphs, width: x, ascent: 715, descent: 220, dot };
}

/** "SAVINGS PARTIES" in Switzer 500, tracking 0.08em, outlined. */
async function outlineLabel(): Promise<{ d: string; width: number; capHeight: number }> {
  const font = fontkit.openSync(await ttf("switzer")).getVariation({ wght: 500 });
  const upm = font.unitsPerEm as number;
  const run = font.layout("SAVINGS PARTIES");
  let x = 0;
  const parts: string[] = [];
  run.glyphs.forEach((g: { path: { translate: (x: number, y: number) => { scale: (a: number, b: number) => { toSVG: () => string } } } }, i: number) => {
    parts.push(g.path.translate(x, 0).scale(1, -1).toSVG());
    x += run.positions[i].xAdvance + (i < run.glyphs.length - 1 ? 0.08 * upm : 0);
  });
  return { d: parts.join(" "), width: x, capHeight: font.capHeight as number };
}

function bowPlaced(v: Variant, cx: number, cy: number, widthUnits: number) {
  // Mark spans x 6.5→233.5 (227 wide); its visual centre sits at the loops' middle (120, 57).
  const s = widthUnits / 227;
  return `<g transform="translate(${(cx - 120 * s).toFixed(2)} ${(cy - 57 * s).toFixed(2)}) scale(${s.toFixed(4)})">${markGroup(v)}</g>`;
}

/* ------------------------------ The seal ------------------------------ */

function sealSvg(v: "paper" | "night" | "mono", opts: { bg?: string; size?: number } = {}) {
  const { blob, ringR } = sealBlob(50, 21);
  const s = 0.34;
  const bowT = `translate(${(-120 * s).toFixed(2)} ${(-62 * s).toFixed(2)}) scale(${s})`;
  const bow = (fill: string) =>
    `<g transform="${bowT}"><path fill="${fill}" fill-rule="evenodd" d="${LOOP_L} ${EYE_L} ${LOOP_R} ${EYE_R}"/><circle cx="${KNOT.cx}" cy="${KNOT.cy}" r="${KNOT.r}" fill="${fill}"/><g fill="none" stroke="${fill}" stroke-width="${TAIL_WIDTH * 1.15}" stroke-linecap="round"><path d="${TAIL_L}"/><path d="${TAIL_R}"/></g></g>`;
  if (v === "mono") {
    return `<g transform="translate(60 60)"><path d="${blob}" fill="${BRAND.ink}"/><circle r="${ringR}" fill="none" stroke="${BRAND.moon}" stroke-opacity=".35" stroke-width="1.2"/>${bow(BRAND.moon)}</g>`;
  }
  const bg = opts.bg ? `<rect width="120" height="120" fill="${opts.bg}"/>` : "";
  return `${bg}<defs><radialGradient id="wax" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="${BRAND.waxHi}"/><stop offset=".55" stop-color="${BRAND.wax}"/><stop offset="1" stop-color="${BRAND.waxLo}"/></radialGradient></defs>
<g transform="translate(60 60)"><path d="${blob}" fill="url(#wax)"/>
<circle r="${ringR}" fill="none" stroke="${BRAND.waxLo}" stroke-opacity=".7" stroke-width="2.2"/>
<circle r="${ringR}" fill="none" stroke="${BRAND.waxHi}" stroke-opacity=".55" stroke-width="1" transform="translate(-.6 -.8)"/>
<g transform="translate(.8 1.1)" opacity=".75">${bow(BRAND.waxLo)}</g>
<g opacity=".95">${bow("#8E2A4A")}</g>
<g transform="translate(-.5 -.7)" opacity=".35">${bow(BRAND.waxHi)}</g></g>`;
}

/* ------------------------------ Write all ----------------------------- */

async function main() {
  await mkdir(OUT, { recursive: true });
  const w = await outlineWordmark();
  const label = await outlineLabel();

  // Mark
  const variants: [string, Variant][] = [["", "paper"], ["-night", "night"], ["-mono", "mono"], ["-mono-moon", "mono-moon"]];
  for (const [suffix, v] of variants) await writeFile(path.join(OUT, `kitty-mark${suffix}.svg`), svg(MARK_VB, markGroup(v)));

  // Favicon: one layer + eye holes, small-size tails/eyes, no plum.
  await writeFile(
    path.join(OUT, "favicon.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VB}"><style>@media (prefers-color-scheme: dark){.b{fill:${BRAND.marigold}}}</style>${markGroup("paper", { small: true, noBack: true })}</svg>\n`,
  );
  await writeFile(path.join(OUT, "safari-pinned-tab.svg"), svg(MARK_VB, markGroup("mono", { small: true })));

  // Wordmark
  const inkFor = (v: Variant) => (v === "night" || v === "mono-moon" ? BRAND.moon : BRAND.ink);
  const bowW = 360; // 0.36em: the brief's 0.42em crowded the K arm at 96 px
  const top = -(w.ascent + 60);
  const wmVB = `-10 ${top} ${Math.ceil(w.width + 20)} ${Math.ceil(w.ascent + 60 + w.descent + 20)}`;
  const wordBody = (v: Variant) => `<path fill="${inkFor(v)}" d="${w.d}"/>${bowPlaced(v, w.dot.x, w.dot.y, bowW)}`;
  for (const [suffix, v] of variants) await writeFile(path.join(OUT, `kitty-wordmark${suffix}.svg`), svg(wmVB, wordBody(v)));

  // Lockup: wordmark + SAVINGS PARTIES (13/1000 of the wordmark's em ≈ label style), baseline aligned, gap 0.6em.
  const labelScale = 0.24; // label cap height ≈ 0.17 em of the wordmark at 28 px lockup height
  const gap = 0.6 * 1000;
  const lockW = w.width + gap + label.width * labelScale;
  const lockVB = `-10 ${top} ${Math.ceil(lockW + 20)} ${Math.ceil(w.ascent + 60 + w.descent + 20)}`;
  const lockBody = (v: Variant) =>
    `${wordBody(v)}<path fill="${inkFor(v)}" transform="translate(${(w.width + gap).toFixed(1)} 0) scale(${labelScale})" d="${label.d}"/>`;
  for (const [suffix, v] of variants) await writeFile(path.join(OUT, `kitty-lockup${suffix}.svg`), svg(lockVB, lockBody(v), "Kitty — savings parties"));

  // Stacked lockup: label centred under the wordmark.
  const stackLabelScale = 0.3;
  const lw = label.width * stackLabelScale;
  const stackH = w.ascent + 60 + w.descent + 260;
  const stackVB = `-10 ${top} ${Math.ceil(Math.max(w.width, lw) + 20)} ${Math.ceil(stackH)}`;
  const stackBody = (v: Variant) =>
    `${wordBody(v)}<path fill="${inkFor(v)}" transform="translate(${((w.width - lw) / 2).toFixed(1)} ${w.descent + 200}) scale(${stackLabelScale})" d="${label.d}"/>`;
  for (const [suffix, v] of variants) await writeFile(path.join(OUT, `kitty-lockup-stacked${suffix}.svg`), svg(stackVB, stackBody(v), "Kitty — savings parties"));

  // Seal
  await writeFile(path.join(OUT, "kitty-seal.svg"), svg("0 0 120 120", sealSvg("paper"), "Kitty seal"));
  await writeFile(path.join(OUT, "kitty-seal-night.svg"), svg("0 0 120 120", sealSvg("night"), "Kitty seal"));
  await writeFile(path.join(OUT, "kitty-seal-mono.svg"), svg("0 0 120 120", sealSvg("mono"), "Kitty seal"));

  // App icons: the seal with the mark on --night.
  const iconSvg = Buffer.from(svg("-14 -14 148 148", `<rect x="-14" y="-14" width="148" height="148" fill="${BRAND.night}"/>${sealSvg("night")}`));
  for (const size of [180, 512]) await sharp(iconSvg, { density: 600 }).resize(size, size).png().toFile(path.join(OUT, `icon-${size}.png`));

  // Outlined wordmark for the React component (no font needed to draw the logo).
  const gen = `// Generated by scripts/brand.ts — do not edit.
export const WORDMARK = ${JSON.stringify({ d: w.d, glyphs: w.glyphs, width: w.width, ascent: w.ascent, descent: w.descent, dot: w.dot, top, viewBox: wmVB })} as const;
export const LABEL = ${JSON.stringify({ d: label.d, width: label.width, capHeight: label.capHeight })} as const;
`;
  await writeFile(path.join(ROOT, "packages/ui/src/brand/wordmark.generated.ts"), gen);
  console.log(`brand → ${path.relative(ROOT, OUT)} (wordmark ${Math.round(w.width)}u, dot at ${Math.round(w.dot.x)},${Math.round(w.dot.y)})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
