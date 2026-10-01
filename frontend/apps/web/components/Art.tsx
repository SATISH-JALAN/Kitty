/**
 * <Art id> (brief 16.1 rule 2): one component for all painted art. AVIF + WebP srcsets,
 * explicit size, `sizes`, async decode, object-position from the focal point, decorative
 * (alt="" + aria-hidden), and the tone as background until decoded. A missing file
 * renders the placeholder at the same box: paper-deep / night-raised, the tradition
 * pattern at 10% and the asset id in mono.
 */
import type { CSSProperties } from "react";
import type { TraditionKey } from "@kitty/sdk";
import { patternCss } from "@kitty/ui/generators/patterns";
import { art, srcSet, type ArtId } from "@/art/manifest";

export interface ArtProps {
  id: ArtId;
  sizes?: string;
  fit?: "cover" | "contain" | "fill";
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
  imgStyle?: CSSProperties;
  /** Placeholder world and pattern. */
  world?: "paper" | "night";
  tradition?: TraditionKey;
  /** Fill the parent (absolute inset 0). */
  fill?: boolean;
  /** Show the tone behind while decoding (off for transparent layers). */
  toneBg?: boolean;
}

export function Art({ id, sizes = "100vw", fit = "cover", priority, className, style, imgStyle, world = "night", tradition = "kitty", fill = true, toneBg }: ArtProps) {
  const a = art(id);
  const box: CSSProperties = fill ? { position: "absolute", inset: 0, width: "100%", height: "100%" } : { position: "relative", width: "100%", aspectRatio: `${a.width} / ${a.height}` };
  if (!a.available) {
    return (
      <div
        aria-hidden="true"
        className={className}
        style={{
          ...box,
          background: world === "night" ? "var(--night-raised)" : "var(--paper-deep)",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
          ...style,
        }}
        data-art-placeholder={id}
      >
        <span style={{ position: "absolute", inset: 0, backgroundImage: patternCss(tradition), opacity: 0.1 }} />
        <span className="type-mono" style={{ position: "relative", fontSize: 14, color: "var(--fg-soft)" }}>
          {id}
        </span>
      </div>
    );
  }
  const largestW = a.widths[a.widths.length - 1];
  return (
    <picture className={className} style={{ ...box, display: "block", ...style }} data-art={id}>
      <source type="image/avif" srcSet={srcSet(a, "avif")} sizes={sizes} />
      <img
        src={`/art/${id}-${largestW}.webp`}
        srcSet={srcSet(a, "webp")}
        sizes={sizes}
        width={a.width}
        height={a.height}
        alt=""
        aria-hidden="true"
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: fit,
          objectPosition: `${a.focal.x}% ${a.focal.y}%`,
          background: toneBg ? a.tone : undefined,
          userSelect: "none",
          ...imgStyle,
        }}
      />
    </picture>
  );
}

/** Decode images before a scene reveals them (no pop-ins, never a fade-on-load). */
export async function decodeArt(root: ParentNode | null): Promise<void> {
  if (!root) return;
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(async (img) => {
      img.loading = "eager";
      try {
        await img.decode();
      } catch {
        /* broken image: the tone stays */
      }
    }),
  );
}
