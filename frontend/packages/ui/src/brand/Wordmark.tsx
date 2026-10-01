"use client";
/**
 * "Kitty" with the Bow Mask as the dot of the i (brief 6.4). Glyphs are outlined
 * paths (scripts/brand.ts), so the logo never waits for a font.
 */
import { useId, useRef, type CSSProperties } from "react";
import { BowGlyph, useWink, type BowTone } from "./BowMask";
import { WORDMARK } from "./wordmark.generated";

const BOW_W = 360;
const S = BOW_W / 227;

export function Wordmark({
  height = 28,
  ink = "currentColor",
  bowTone = "colour",
  interactive = false,
  className,
  style,
  title = "Kitty",
}: {
  /** Height of the whole mark box (bow top to descender), px. */
  height?: number;
  ink?: string;
  bowTone?: BowTone;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const { wink, tighten } = useWink(ref);
  const [, top, w, h] = WORDMARK.viewBox.split(" ").map(Number);
  const width = (height * w) / h;
  const dx = WORDMARK.dot.x - 120 * S;
  const dy = WORDMARK.dot.y - 57 * S;
  return (
    <svg
      ref={ref}
      viewBox={`-10 ${top} ${w} ${h}`}
      width={width}
      height={height}
      className={className}
      style={{ overflow: "visible", ...style }}
      role="img"
      aria-label={title}
      onPointerEnter={interactive ? wink : undefined}
      onPointerDown={interactive ? tighten : undefined}
    >
      <path d={WORDMARK.d} fill={ink} />
      <g transform={`translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${S.toFixed(4)})`}>
        <BowGlyph idBase={id} tone={bowTone} colour={ink} back={height > 20} small={height < 24} />
      </g>
    </svg>
  );
}

/** Wordmark + "savings parties" in label style, baseline-aligned, gap 0.6em (brief 6.4). */
export function Lockup({
  height = 28,
  stacked = false,
  ink = "currentColor",
  interactive = false,
  className,
}: {
  height?: number;
  stacked?: boolean;
  ink?: string;
  interactive?: boolean;
  className?: string;
}) {
  // The wordmark's em in px, from its box: box = ascent+60 above baseline + descent+20 below.
  const [, , , h] = WORDMARK.viewBox.split(" ").map(Number);
  const em = (height * 1000) / h;
  const baselineFromTop = (height * (WORDMARK.ascent + 60)) / h;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "center" : "flex-start",
        gap: stacked ? 6 : 0.6 * em * 0.62,
        color: ink,
      }}
    >
      <Wordmark height={height} interactive={interactive} title="Kitty — savings parties" />
      <span
        aria-hidden="true"
        className="type-label"
        style={{
          fontSize: Math.max(11, Math.round(em * 0.42)),
          lineHeight: 1,
          marginTop: stacked ? 0 : baselineFromTop - Math.max(11, Math.round(em * 0.42)) * 0.78,
          whiteSpace: "nowrap",
          color: "inherit",
        }}
      >
        savings parties
      </span>
    </span>
  );
}
