/**
 * Geometry for the hero arch (brief 5.6, Act 1): straight sides with a semicircular top
 * (arc height = 0.5 × width), a scalloped outer frame (24 scallops across the top, 14 on
 * phones), and the cover transform that fits the 2880×1800 stage into any box.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpBox = (a: Box, b: Box, t: number): Box => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

/** Arch outline; `arc` is the height of the top curve (w/2 for the full arch, 0 for a rectangle). */
export function archPath(b: Box, arc = b.w / 2): string {
  const a = Math.max(0.01, Math.min(arc, b.h));
  const { x, y, w, h } = b;
  return `M${x},${y + h} L${x},${y + a} A${w / 2} ${a} 0 0 1 ${x + w},${y + a} L${x + w},${y + h} Z`;
}

/** Scalloped outer edge around an arch, `band` px outside it. */
export function scallopedArch(b: Box, band: number, scallops: number): string {
  const o: Box = { x: b.x - band, y: b.y - band, w: b.w + band * 2, h: b.h + band };
  const rx = o.w / 2;
  const ry = b.w / 2 + band;
  const cx = o.x + rx;
  const cy = o.y + ry;
  const r = Math.max(4, o.w / 40);
  let d = `M${o.x},${o.y + o.h} L${o.x},${cy}`;
  for (let i = 0; i < scallops; i++) {
    const a1 = Math.PI + (i / scallops) * Math.PI;
    const a2 = Math.PI + ((i + 1) / scallops) * Math.PI;
    const x2 = cx + Math.cos(a2) * rx;
    const y2 = cy + Math.sin(a2) * ry;
    void a1;
    d += ` A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  d += ` L${o.x + o.w},${o.y + o.h} Z`;
  return d;
}

export interface Cover {
  s: number;
  x: number;
  y: number;
}

/** Cover-fit the stage into a box, anchored on the focal point and clamped to the stage edges. */
export function cover(b: Box, stage = { w: 2880, h: 1800 }, focal = { x: 1506, y: 878 }): Cover {
  const s = Math.max(b.w / stage.w, b.h / stage.h);
  let x = b.x + b.w / 2 - focal.x * s;
  let y = b.y + b.h / 2 - focal.y * s;
  x = Math.min(b.x, Math.max(b.x + b.w - stage.w * s, x));
  y = Math.min(b.y, Math.max(b.y + b.h - stage.h * s, y));
  return { s, x, y };
}
