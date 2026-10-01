/**
 * The Bow Mask (brief 6.4): the twine bow that ties the kitty, drawn so its loops
 * are a mask's eye holes. One source of geometry for the React mark, the seal,
 * the wordmark's dot and the generated brand files.
 *
 * Refined from docs/ref/logo-concept.svg toward the final flat mark
 * (docs/ref/logo-concept.png): upswept loops with a rounded outer corner, almond
 * eyes with pointed ends, a round knot, two tapered twine tails with round ends.
 * Left half only; the right half is its mirror about x = 120, so symmetry is exact.
 *
 * viewBox 0 0 240 140. Butterfly guard: tails (y 80→119) are shorter than the
 * loops (y 18→96), and their spread (x 93→147, 54) is under 4× the knot (4×28).
 */

export const BOW_VIEWBOX = { w: 240, h: 140 } as const;
export const BOW_CENTRE = 120;

/** Left loop outline (without the eye). */
export const LOOP_L = "M113,63 C97,39 62,17 27,18 C12,18.5 6.5,29 10,43 C16,69 42,94 72,96 C89,97 103,90 113,81 Z";
/** Left eye: almond with a pointed outer and inner corner. */
export const EYE_L = "M31,52 C44,37.5 76,35.5 95,56 C77,72.5 47,71 31,52 Z";
/** Left tail centreline (stroked with round caps). */
export const TAIL_L = "M114.5,80 C111.5,95 105,108 94,119";
export const KNOT = { cx: 120, cy: 70, r: 14 } as const;
export const TAIL_WIDTH = 9;

/** Mirror a path about x = 120 (numbers in "x,y" pairs only). */
export function mirror(d: string): string {
  return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x: string, y: string) => `${+(240 - +x).toFixed(2)},${y}`);
}

export const LOOP_R = mirror(LOOP_L);
export const EYE_R = mirror(EYE_L);
export const TAIL_R = mirror(TAIL_L);

/** Both loops with eyes punched out (even-odd), for static files. */
export const LOOPS_EVENODD = `${LOOP_L} ${EYE_L} ${LOOP_R} ${EYE_R}`;

/** Eye centres, for the wink transform origin. */
export const EYE_CENTRES = [
  { x: 63, y: 54 },
  { x: 177, y: 54 },
] as const;

/**
 * Small-size variant (≤ 24 px, brief 6.4): tails 20% thicker, eyes 8% larger.
 */
export function eyeScaledAbout(d: string, cx: number, cy: number, s: number): string {
  return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x: string, y: string) => {
    const nx = cx + (+x - cx) * s;
    const ny = cy + (+y - cy) * s;
    return `${+nx.toFixed(2)},${+ny.toFixed(2)}`;
  });
}

export const SMALL = {
  tailWidth: TAIL_WIDTH * 1.2,
  eyeL: eyeScaledAbout(EYE_L, EYE_CENTRES[0].x, EYE_CENTRES[0].y, 1.08),
  eyeR: eyeScaledAbout(EYE_R, EYE_CENTRES[1].x, EYE_CENTRES[1].y, 1.08),
};

/** Back-layer offset in viewBox units (0.02em, 0.03em of a ~140-unit mark). */
export const BACK_OFFSET = { x: 3, y: 4.5 } as const;

export const BRAND = {
  marigold: "#F4A300",
  plum: "#4E2152",
  twine: "#B8542A",
  gold: "#C8A04A",
  ink: "#22151F",
  moon: "#F6EEDF",
  night: "#170E22",
  wax: "#7A1F3D",
  waxHi: "#A33A5A",
  waxLo: "#4A0F24",
} as const;
