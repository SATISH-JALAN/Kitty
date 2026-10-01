"use client";
/**
 * Rubber stamp (brief 7.17): round (96 px, text on a circular path, centre glyph) or
 * rectangular (180×64, double border, label). Ink: teal (money recorded), ink (neutral),
 * saffron (stats), plum (Farewell), error (system errors only). Always rotated between
 * −8° and +6° (seeded) and pressed through the #ink filter.
 */
import { forwardRef, useId, type CSSProperties, type ReactNode } from "react";
import { hashString } from "@kitty/sdk";

export type StampInk = "teal" | "ink" | "saffron" | "plum" | "error";

const INK: Record<StampInk, string> = {
  teal: "var(--teal)",
  ink: "var(--ink)",
  saffron: "var(--saffron)",
  plum: "var(--plum)",
  error: "var(--error)",
};

export function stampAngle(seed: string): number {
  return -8 + (hashString(seed) % 1400) / 100;
}

export interface StampProps {
  shape?: "round" | "rect";
  ink?: StampInk;
  /** Rect label, or the text around a round stamp. */
  label: string;
  /** Small second line (rect) or centre glyph (round). */
  sub?: ReactNode;
  size?: number;
  width?: number;
  height?: number;
  seed?: string;
  rotate?: number;
  className?: string;
  style?: CSSProperties;
  /** Ink colour override (e.g. teal-night on night). */
  colour?: string;
}

export const Stamp = forwardRef<HTMLDivElement, StampProps>(function Stamp(
  { shape = "rect", ink = "ink", label, sub, size = 96, width = 180, height = 64, seed, rotate, className, style, colour },
  ref,
) {
  const id = useId().replace(/:/g, "");
  const c = colour ?? INK[ink];
  const angle = rotate ?? stampAngle(seed ?? label);
  if (shape === "round") {
    return (
      <div ref={ref} className={`stamp ${className ?? ""}`} role="img" aria-label={label} style={{ width: size, height: size, transform: `rotate(${angle}deg)`, color: c, ...style }}>
        <svg viewBox="0 0 96 96" width={size} height={size} style={{ filter: "url(#ink)", overflow: "visible" }} aria-hidden="true">
          <defs>
            <path id={`${id}-arc`} d="M48,48 m-34,0 a34,34 0 1,1 68,0 a34,34 0 1,1 -68,0" />
          </defs>
          <circle cx="48" cy="48" r="45" fill="none" stroke="currentColor" strokeWidth="2.4" />
          <circle cx="48" cy="48" r="41" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="48" cy="48" r="25" fill="none" stroke="currentColor" strokeWidth="1" />
          <text fill="currentColor" style={{ font: "400 10px var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            <textPath href={`#${id}-arc`} startOffset="0">
              {`${label.toUpperCase()} · ${label.toUpperCase()} · `}
            </textPath>
          </text>
          <g transform="translate(48 48)">{sub ?? <path d="M-9,1 l6,6 l12,-13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}</g>
        </svg>
      </div>
    );
  }
  return (
    <div
      ref={ref}
      className={`stamp ${className ?? ""}`}
      role="img"
      aria-label={typeof sub === "string" ? `${label}. ${sub}` : label}
      style={{ display: "inline-block", transform: `rotate(${angle}deg)`, color: c, ...style }}
    >
      <div
        style={{
          minWidth: width,
          minHeight: height,
          padding: "10px 16px",
          border: "2.4px solid currentColor",
          outline: "1px solid currentColor",
          outlineOffset: -7,
          borderRadius: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          filter: "url(#ink)",
          gap: 2,
        }}
      >
        <span className="type-label" style={{ fontSize: 15, fontWeight: 600, letterSpacing: "0.06em", lineHeight: 1.15 }}>
          {label}
        </span>
        {sub && (
          <span className="type-mono" style={{ fontSize: 11, lineHeight: 1.3, letterSpacing: 0 }}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
});
