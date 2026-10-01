"use client";
/**
 * Paper lantern (brief 7.19): cap, four ribs, tissue body, tassel, and a glow layer
 * behind it (light through paper, 4.5). `lit` 0–1 drives the glow; `flicker` runs the
 * in-view noise flicker. Sizes: 20 icon · 28 stepper · 40 default · 72 hero · 120 preloader.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, type CSSProperties } from "react";
import { flicker as startFlicker } from "../motion/primitives/physical";

export interface LanternHandle {
  root: HTMLSpanElement | null;
  glow: HTMLSpanElement | null;
  body: SVGPathElement | null;
}

export interface LanternProps {
  width?: number;
  lit?: number;
  flicker?: boolean;
  /** Unlit style: an outline only (stepper). */
  outline?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

export const Lantern = forwardRef<LanternHandle, LanternProps>(function Lantern(
  { width = 40, lit = 1, flicker = false, outline = false, className, style, label },
  ref,
) {
  const root = useRef<HTMLSpanElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const body = useRef<SVGPathElement>(null);
  useImperativeHandle(ref, () => ({ root: root.current, glow: glow.current, body: body.current }));
  const h = (width * 56) / 40;

  useEffect(() => {
    if (!flicker || !glow.current) return;
    return startFlicker(glow.current);
  }, [flicker]);

  const tissue = outline ? "transparent" : `color-mix(in srgb, var(--lantern) ${Math.round(55 + lit * 30)}%, var(--kraft))`;
  return (
    <span
      ref={root}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ position: "relative", display: "inline-block", width, height: h, flex: "none", ...style }}
    >
      <span
        ref={glow}
        className="lantern-glow"
        style={{
          position: "absolute",
          left: "50%",
          top: "46%",
          width: width * 2.4,
          height: width * 2.4,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,210,122,.55) 0%, rgba(255,210,122,.22) 35%, rgba(255,210,122,0) 68%)",
          filter: `blur(${Math.max(4, width * 0.18)}px)`,
          opacity: lit,
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />
      <svg viewBox="0 0 40 56" width={width} height={h} style={{ position: "relative", overflow: "visible" }}>
        <path d="M20,0 V5" stroke="var(--twine)" strokeWidth="1" />
        <rect x="13" y="4.5" width="14" height="4" rx=".8" fill="var(--plum)" />
        <path
          ref={body}
          className="lantern-body"
          d="M13,8.5 C5.5,10.5 3,18 3,26 C3,34 5.5,41.5 13,43.5 L27,43.5 C34.5,41.5 37,34 37,26 C37,18 34.5,10.5 27,8.5 Z"
          fill={tissue}
          stroke={outline ? "var(--fg-soft)" : "color-mix(in srgb, var(--twine) 60%, transparent)"}
          strokeWidth={outline ? 1 : 0.6}
          strokeDasharray={outline ? "2.5 2" : undefined}
        />
        {/* inner core: brighter where the flame sits */}
        {!outline && (
          <ellipse cx="20" cy="27" rx="9" ry="12" fill="#FFF3D6" opacity={0.25 + lit * 0.45} style={{ mixBlendMode: "screen" }} />
        )}
        <g fill="none" stroke={outline ? "var(--fg-soft)" : "rgba(122,31,61,.55)"} strokeWidth=".8" opacity={outline ? 0.6 : 1}>
          <path d="M11,9.5 C7,16 7,36 11,42.5" />
          <path d="M16.5,8.8 C14.5,16 14.5,36 16.5,43.2" />
          <path d="M23.5,8.8 C25.5,16 25.5,36 23.5,43.2" />
          <path d="M29,9.5 C33,16 33,36 29,42.5" />
        </g>
        <rect x="14" y="43.5" width="12" height="3.2" rx=".8" fill="var(--plum)" />
        <path d="M20,46.7 V50" stroke="var(--twine)" strokeWidth="1" />
        <path d="M18.2,50 L21.8,50 L22.6,56 L17.4,56 Z" fill="var(--twine)" />
      </svg>
    </span>
  );
});
