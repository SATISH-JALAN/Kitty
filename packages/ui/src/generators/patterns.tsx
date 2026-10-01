/**
 * Tradition pattern library (brief 2.2). Original, abstract, geometric tiles inspired
 * by textile structure. No sacred symbols, flags or copied cloths.
 *
 * Each tile is an SVG string so the same art can be a <pattern> fill (masks, chips,
 * emblems at 100%) or a CSS background (pages at 6–10%).
 */
import { between, rng, type TraditionKey } from "@kitty/sdk";

export interface Tile {
  w: number;
  h: number;
  /** SVG markup inside the tile (no wrapper). */
  body: string;
}

const f = (n: number) => +n.toFixed(2);

/** kitty · India/Pakistan: 4-petal florets on a half-drop grid, block-print wobble (3 variants). */
function kitty(c: string): Tile {
  const r = rng(48);
  const floret = (cx: number, cy: number) => {
    const rot = between(r, -4, 4);
    // Round, overlapping petals on the diagonals read as a flower (a quatrefoil), never a cross.
    const petals = [45, 135, 225, 315]
      .map((a) => `<ellipse cx="${cx}" cy="${cy - 4.4}" rx="3.9" ry="5" transform="rotate(${f(a + rot)} ${cx} ${cy})"/>`)
      .join("");
    return `${petals}<circle cx="${cx}" cy="${cy}" r="1.6" fill="#fff" fill-opacity=".55"/>`;
  };
  let body = "";
  for (let v = 0; v < 3; v++) {
    const ox = v * 48;
    body += floret(ox + 12, 12) + floret(ox + 36, 36);
    body += `<circle cx="${ox + 36}" cy="12" r="1"/><circle cx="${ox + 12}" cy="36" r="1"/>`;
  }
  return { w: 144, h: 48, body: `<g fill="${c}">${body}</g>` };
}

/** tanda · Mexico: papel-picado band; the diamond and scallops are cut out, fold line through the middle. */
function tanda(c: string, cut = "none"): Tile {
  const d =
    "M0,0 H64 V40 H0 Z " + // the sheet
    "M32,13 L39,20 L32,27 L25,20 Z " + // 14 px diamond
    "M20,14 A6,6 0 0 0 20,26 Z " + // semicircle scallops, flat sides facing the diamond
    "M44,14 A6,6 0 0 1 44,26 Z " +
    "M2,5 h8 v2 h-8 Z M54,33 h8 v2 h-8 Z"; // small punched slits
  return {
    w: 64,
    h: 40,
    body: `<path fill="${c}" fill-rule="evenodd" d="${d}"/><path d="M0,20.5 H64" stroke="${cut === "none" ? c : cut}" stroke-opacity=".5" stroke-width="1"/>`,
  };
}

/** susu · Ghana: strip-woven blocks (24×8, 12×8, 36×8) across two rows, with a warp line. */
function susu(c: string, c2: string): Tile {
  const row = (y: number, order: [number, string][], x0: number) => {
    let x = x0;
    return order
      .map(([w, col]) => {
        const s = `<rect x="${x}" y="${y}" width="${w}" height="8" fill="${col}"/>`;
        x += w;
        return s;
      })
      .join("");
  };
  const body =
    row(2, [[24, c], [12, c2], [36, c]], 0) +
    row(14, [[36, c2], [24, c], [12, c2]], 0) +
    `<rect x="0" y="11" width="72" height="2" fill="${c2}" fill-opacity=".6"/>`;
  return { w: 72, h: 24, body };
}

/** paluwagan · Philippines: diagonal over-under weave of 6 px strips at 45°. */
function paluwagan(c: string): Tile {
  // Two strip directions; each crossing alternates which one is on top by leaving a gap.
  const body =
    `<g fill="${c}">` +
    `<path d="M-4,4 L4,-4 L10,2 L2,10 Z M12,20 L20,12 L26,18 L18,26 Z M28,36 L36,28 L42,34 L34,42 Z M-4,36 L4,28 L10,34 L2,42 Z M28,4 L36,-4 L42,2 L34,10 Z"/>` +
    `<path d="M14,2 L22,10 L16,16 L8,8 Z M30,18 L38,26 L32,32 L24,24 Z M-2,18 L6,26 L0,32 L-8,24 Z M14,34 L22,42 L16,48 L8,40 Z" fill-opacity=".6"/>` +
    `</g>`;
  return { w: 32, h: 32, body };
}

/** arisan · Indonesia: wax-resist dots along gentle S-curves, one ring per tile. */
function arisan(c: string): Tile {
  let dots = "";
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 9; i++) {
      const x = i * 7 + 1;
      const y = 8 + row * 19 + Math.sin((i / 9) * Math.PI * 2) * 4;
      dots += `<circle cx="${f(x)}" cy="${f(y)}" r="1.5"/>`;
    }
  }
  return { w: 56, h: 56, body: `<g fill="${c}">${dots}</g><circle cx="42" cy="44" r="5" fill="none" stroke="${c}" stroke-width="1.6"/>` };
}

/** chama · Kenya: a framed field — a band of small triangles around offset 4 px squares. */
function chama(c: string): Tile {
  let tri = "";
  for (let i = 0; i < 10; i++) {
    const x = i * 8;
    tri += `M${x},0 L${x + 4},6 L${x + 8},0 Z M${x},80 L${x + 4},74 L${x + 8},80 Z M0,${x} L6,${x + 4} L0,${x + 8} Z M80,${x} L74,${x + 4} L80,${x + 8} Z `;
  }
  let sq = "";
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++) {
      const ox = 12 + x * 10 + (y % 2 ? 5 : 0);
      if (ox > 66) continue;
      sq += `<rect x="${ox}" y="${12 + y * 10}" width="4" height="4"/>`;
    }
  return { w: 80, h: 80, body: `<g fill="${c}"><path d="${tri}"/>${sq}</g>` };
}

/** ajo · Nigeria: resist-dyed grid, 20 px squares on 4 px lines, a dot in each, every third left blank. */
function ajo(c: string, c2: string): Tile {
  // Grid lines and dots in the dye colour; squares take the resist colour when it differs.
  let body = "";
  for (let i = 0; i < 3; i++) body += `<rect x="${i * 24 - 2}" y="0" width="4" height="72" fill="${c}"/><rect x="0" y="${i * 24 - 2}" width="72" height="4" fill="${c}"/>`;
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++) {
      const sx = 2 + x * 24;
      const sy = 2 + y * 24;
      if (c2 !== c) body += `<rect x="${sx}" y="${sy}" width="20" height="20" fill="${c2}" fill-opacity=".92"/>`;
      if ((x + y) % 3 !== 2) body += `<circle cx="${sx + 10}" cy="${sy + 10}" r="2.5" fill="${c}"/>`;
    }
  return { w: 72, h: 72, body };
}

export function tile(kind: TraditionKey, colour: string, colour2?: string): Tile {
  switch (kind) {
    case "kitty":
      return kitty(colour);
    case "tanda":
      return tanda(colour);
    case "susu":
      return susu(colour, colour2 ?? "#4E2152");
    case "paluwagan":
      return paluwagan(colour);
    case "arisan":
      return arisan(colour);
    case "chama":
      return chama(colour);
    case "ajo":
      return ajo(colour, colour2 ?? "#F6EEDF");
  }
}

/** Accent pairs per tradition (brief 2.2). */
export const PATTERN_ACCENT: Record<TraditionKey, [string, string?]> = {
  kitty: ["#E4572E"],
  tanda: ["#F4A300"],
  susu: ["#F4A300", "#4E2152"],
  paluwagan: ["#45C2B1"],
  arisan: ["#E4572E"],
  chama: ["#F4A300"],
  ajo: ["#4E2152", "#F6EEDF"],
};

/** A CSS `background-image` value for page backgrounds (use with opacity 0.06–0.10). */
export function patternCss(kind: TraditionKey, colour?: string, colour2?: string, scale = 1): string {
  const [c1, c2] = PATTERN_ACCENT[kind];
  const t = tile(kind, colour ?? c1, colour2 ?? c2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.w * scale}" height="${t.h * scale}" viewBox="0 0 ${t.w} ${t.h}">${t.body}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** <pattern> element for fills inside an SVG (masks, emblems, chips). */
export function PatternDef({
  id,
  kind,
  colour,
  colour2,
  scale = 1,
  rotate = 0,
}: {
  id: string;
  kind: TraditionKey;
  colour?: string;
  colour2?: string;
  scale?: number;
  rotate?: number;
}) {
  const [c1, c2] = PATTERN_ACCENT[kind];
  const t = tile(kind, colour ?? c1, colour2 ?? c2);
  return (
    <pattern
      id={id}
      patternUnits="userSpaceOnUse"
      width={t.w}
      height={t.h}
      patternTransform={`scale(${scale}) rotate(${rotate})`}
    >
      <g dangerouslySetInnerHTML={{ __html: t.body }} />
    </pattern>
  );
}
