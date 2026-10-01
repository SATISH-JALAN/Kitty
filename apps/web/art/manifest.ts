/**
 * Art manifest (brief 16.1). Sizes, tones and available widths come from
 * `manifest.generated.json` (scripts/art-pipeline.mjs); focal points, quiet zones and
 * overlay anchors are measured on the delivered art (docs/STORYBOARD.md C7–C9).
 * A missing file renders the placeholder at the same box.
 */
import generated from "./manifest.generated.json";

export type ArtId =
  | "H-1" | "H-2" | "H-3L" | "H-3R" | "H-4" | "H-4Z" | "H-5"
  | "V-1" | "V-2" | "V-3" | "V-4" | "V-5" | "V-6" | "V-7"
  | "S-1" | "D-1" | "T-1" | "B-1" | "P-1" | "P-2" | "P-3";

export interface ArtEntry {
  id: ArtId;
  width: number;
  height: number;
  /** Focal point, % of the image. */
  focal: { x: number; y: number };
  quiet?: { x: number; y: number; w: number; h: number };
  depth: number;
  tone: string;
  alpha: boolean;
  widths: number[];
  available: boolean;
  decorative: true;
}

type Gen = Record<string, { width: number; height: number; alpha: boolean; tone: string; widths: number[] }>;
const G = generated as Gen;

const AUTHORED: Record<ArtId, { focal: { x: number; y: number }; depth: number; quiet?: ArtEntry["quiet"]; fallback: { w: number; h: number; tone: string } }> = {
  "H-1": { focal: { x: 70, y: 30 }, depth: 0, fallback: { w: 2880, h: 1800, tone: "#241634" } },
  "H-2": { focal: { x: 52.3, y: 48.8 }, depth: 2, quiet: { x: 18, y: 0, w: 22, h: 65 }, fallback: { w: 2880, h: 1800, tone: "#241634" } },
  "H-3L": { focal: { x: 52.3, y: 48.8 }, depth: 3, fallback: { w: 2880, h: 1800, tone: "#241634" } },
  "H-3R": { focal: { x: 52.3, y: 48.8 }, depth: 3, fallback: { w: 2880, h: 1800, tone: "#241634" } },
  "H-4": { focal: { x: 52.3, y: 48.8 }, depth: 4, fallback: { w: 2880, h: 1800, tone: "#241634" } },
  "H-4Z": { focal: { x: 50.8, y: 43 }, depth: 4, fallback: { w: 2048, h: 2048, tone: "#C9A57A" } },
  "H-5": { focal: { x: 52.3, y: 48.8 }, depth: 5, fallback: { w: 2880, h: 1800, tone: "#241634" } },
  "V-1": { focal: { x: 50, y: 65 }, depth: 1, fallback: { w: 1200, h: 1680, tone: "#E6D6BD" } },
  "V-2": { focal: { x: 50, y: 65 }, depth: 1, fallback: { w: 1200, h: 1680, tone: "#E6D6BD" } },
  "V-3": { focal: { x: 50, y: 65 }, depth: 1, fallback: { w: 1200, h: 1680, tone: "#E6D6BD" } },
  "V-4": { focal: { x: 50, y: 65 }, depth: 1, fallback: { w: 1200, h: 1680, tone: "#E6D6BD" } },
  "V-5": { focal: { x: 50, y: 65 }, depth: 1, fallback: { w: 1200, h: 1680, tone: "#E6D6BD" } },
  "V-6": { focal: { x: 50, y: 65 }, depth: 1, fallback: { w: 1200, h: 1680, tone: "#E6D6BD" } },
  "V-7": { focal: { x: 50, y: 65 }, depth: 1, fallback: { w: 1200, h: 1680, tone: "#E6D6BD" } },
  "S-1": { focal: { x: 50, y: 50 }, depth: 0, fallback: { w: 2880, h: 1800, tone: "#E6D6BD" } },
  "D-1": { focal: { x: 50, y: 50 }, depth: 2, fallback: { w: 1400, h: 2200, tone: "#241634" } },
  "T-1": { focal: { x: 50, y: 50 }, depth: 1, fallback: { w: 2400, h: 2400, tone: "#E6D6BD" } },
  "B-1": { focal: { x: 50, y: 50 }, depth: 1, fallback: { w: 1600, h: 2240, tone: "#4E2152" } },
  "P-1": { focal: { x: 50, y: 50 }, depth: 0, fallback: { w: 1024, h: 1024, tone: "#F3EADB" } },
  "P-2": { focal: { x: 50, y: 50 }, depth: 0, fallback: { w: 1024, h: 1024, tone: "#241634" } },
  "P-3": { focal: { x: 50, y: 50 }, depth: 0, fallback: { w: 1024, h: 1024, tone: "#C9A57A" } },
};

export function art(id: ArtId): ArtEntry {
  const a = AUTHORED[id];
  const g = G[id];
  return {
    id,
    width: g?.width ?? a.fallback.w,
    height: g?.height ?? a.fallback.h,
    focal: a.focal,
    quiet: a.quiet,
    depth: a.depth,
    tone: g?.tone ?? a.fallback.tone,
    alpha: g?.alpha ?? false,
    widths: g?.widths ?? [],
    available: !!g,
    decorative: true,
  };
}

/** Door overlay anchors, % of D-1 (measured; STORYBOARD C8). */
export const DOOR = {
  slot: { x: 38, y: 53.6, w: 24, h: 2 },
  medallion: { cx: 50, cy: 16, d: 13.5 },
  glow: { x: 25, y: 9, w: 50, h: 77 },
} as const;

/** Act 3 proscenium opening in S-1, % of the image. */
export const PROSCENIUM = { x: 18, y: 17, w: 64, h: 55 } as const;

/** Act 1 virtual stage (brief 16.1 rule 3). */
export const STAGE = { w: 2880, h: 1800, focal: { x: 1506, y: 878 } } as const;

export function srcSet(entry: ArtEntry, format: "avif" | "webp") {
  return entry.widths.map((w) => `/art/${entry.id}-${w}.${format} ${w}w`).join(", ");
}

export function largest(entry: ArtEntry, format: "avif" | "webp" = "webp") {
  const w = entry.widths[entry.widths.length - 1];
  return `/art/${entry.id}-${w}.${format}`;
}
