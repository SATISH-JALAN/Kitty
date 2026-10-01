/**
 * Wax seal geometry (brief 7.18): an irregular round blob of 14–18 seeded lumps,
 * an inner debossed ring and the Bow Mask pressed into the centre. Pure, seeded,
 * and shared by <WaxSeal> and the generated brand files.
 */
import { between, rng } from "@kitty/sdk";

export interface SealShape {
  blob: string;
  ringR: number;
  lumps: number;
}

/** Lumpy circle centred at (0,0) with outer radius ≈ r. */
export function sealBlob(r = 50, seed = 21): SealShape {
  const rand = rng(seed);
  const lumps = 14 + Math.floor(rand() * 5);
  const pts: [number, number][] = [];
  const phase = rand() * Math.PI * 2;
  for (let i = 0; i < lumps; i++) {
    const a = phase + (i / lumps) * Math.PI * 2 + between(rand, -0.06, 0.06);
    const rr = r * between(rand, 0.9, 0.97);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  // Each lump is a quadratic bulge between neighbouring valley points.
  let d = "";
  for (let i = 0; i < lumps; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % lumps];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const ml = Math.hypot(mx, my);
    const bulge = r * between(rand, 1.03, 1.1);
    const cx = (mx / ml) * bulge;
    const cy = (my / ml) * bulge;
    d += `${i === 0 ? `M${x0.toFixed(2)},${y0.toFixed(2)}` : ""} Q${cx.toFixed(2)},${cy.toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return { blob: `${d} Z`, ringR: r * 0.72, lumps };
}

/** Three hairline cracks from the edge toward the centre, for the cracked state. */
export function sealCracks(r = 50, seed = 5): string[] {
  const rand = rng(seed);
  const out: string[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + between(rand, -0.5, 0.5);
    let x = Math.cos(a) * r * 0.98;
    let y = Math.sin(a) * r * 0.98;
    let d = `M${x.toFixed(1)},${y.toFixed(1)}`;
    const steps = 4;
    for (let s = 1; s <= steps; s++) {
      const t = 1 - (s / steps) * between(rand, 0.55, 0.75);
      const aa = a + between(rand, -0.35, 0.35);
      x = Math.cos(aa) * r * t;
      y = Math.sin(aa) * r * t;
      d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
    }
    out.push(d);
  }
  return out;
}
