/**
 * Torn paper edge generator (brief 4.3). Pure and seeded, so edges are stable
 * between server and client renders.
 *
 * The edge runs along the top of a band `width` × `depth`. Points every 10–14 px,
 * y-jitter ±5 px, a thin 12–20 px fibre tail roughly every 120 px, and a second
 * "core" path offset by 2 px that shows the paper's white core where it tore.
 */
import { between, rng } from "@kitty/sdk";

export interface TornEdgeOptions {
  width?: number;
  /** Height of the band the edge sits in; the edge's mean line is at `depth / 2`. */
  depth?: number;
  seed?: number;
  jitter?: number;
  stepMin?: number;
  stepMax?: number;
  fibreEvery?: number;
}

export interface TornEdge {
  width: number;
  depth: number;
  /** Closed path: the paper below the tear (fill with the sheet colour). */
  fill: string;
  /** Closed path: the white core showing 2 px above the tear. */
  core: string;
  /** Open paths: 1 px fibre tails (stroke at 30%). */
  fibres: string[];
  /** Points of the tear line, for clip-path polygons. */
  points: [number, number][];
}

export function tornEdge(opts: TornEdgeOptions = {}): TornEdge {
  const width = opts.width ?? 1600;
  const depth = opts.depth ?? 20;
  const jitter = opts.jitter ?? 5;
  const r = rng(opts.seed ?? 7);
  const mid = depth / 2;
  const pts: [number, number][] = [];
  let x = 0;
  let y = mid;
  while (x < width) {
    // Correlated jitter reads as torn fibre; pure white noise reads as a zigzag.
    y = Math.max(mid - jitter, Math.min(mid + jitter, y * 0.45 + (mid + between(r, -jitter, jitter)) * 0.55));
    pts.push([x, +y.toFixed(2)]);
    x += between(r, opts.stepMin ?? 10, opts.stepMax ?? 14);
  }
  pts.push([width, +(mid + between(r, -jitter, jitter) * 0.5).toFixed(2)]);

  const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py}`).join(" ");
  const fill = `${line} L${width},${depth} L0,${depth} Z`;
  const coreLine = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${(py - 2).toFixed(2)}`).join(" ");
  const core = `${coreLine} L${width},${depth} L0,${depth} Z`;

  const fibres: string[] = [];
  const every = opts.fibreEvery ?? 120;
  for (let fx = between(r, 30, every); fx < width - 20; fx += between(r, every * 0.7, every * 1.3)) {
    const i = pts.findIndex(([px]) => px >= fx);
    const base = pts[Math.max(0, i)];
    const len = between(r, 12, 20);
    const lean = between(r, -6, 6);
    fibres.push(`M${base[0].toFixed(1)},${(base[1] - 1).toFixed(1)} q${(lean / 2).toFixed(1)},${(-len / 2).toFixed(1)} ${lean.toFixed(1)},${(-len).toFixed(1)}`);
  }
  return { width, depth, fill, core, fibres, points: pts };
}

/** CSS polygon for clipping a full-width element's top edge with a tear. */
export function tornClipPolygon(edge: TornEdge, heightPx: number): string {
  const pts = edge.points.map(([x, y]) => `${((x / edge.width) * 100).toFixed(2)}% ${y.toFixed(1)}px`);
  return `polygon(${pts.join(", ")}, 100% ${heightPx}px, 0% ${heightPx}px)`;
}
