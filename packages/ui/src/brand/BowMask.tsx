"use client";
/**
 * The Bow Mask mark (brief 6.4) with the winking-bow hover (primitive 24).
 * Eye holes are cut with an SVG mask so they can blink while staying see-through.
 */
import { useId, useRef, type CSSProperties } from "react";
import { gsap, swing, useGSAP } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { BACK_OFFSET, BRAND, EYE_CENTRES, EYE_L, EYE_R, KNOT, LOOP_L, LOOP_R, SMALL, TAIL_L, TAIL_R, TAIL_WIDTH } from "./bowGeometry";

export type BowTone = "colour" | "mono";

export interface BowGlyphProps {
  tone?: BowTone;
  /** Mono colour; defaults to currentColor. */
  colour?: string;
  small?: boolean;
  back?: boolean;
  trim?: boolean;
  idBase: string;
}

/** Mark content in its 240×140 coordinate space (for nesting inside other SVGs). */
export function BowGlyph({ tone = "colour", colour = "currentColor", small, back = true, trim, idBase }: BowGlyphProps) {
  const eyeL = small ? SMALL.eyeL : EYE_L;
  const eyeR = small ? SMALL.eyeR : EYE_R;
  const tw = small ? SMALL.tailWidth : TAIL_WIDTH;
  const mono = tone === "mono";
  const loopFill = mono ? colour : BRAND.marigold;
  const tieFill = mono ? colour : BRAND.twine;
  const maskId = `${idBase}-eyes`;
  const body = (fillLoops: string, fillTie: string, cls: string) => (
    <g className={cls}>
      <g mask={`url(#${maskId})`}>
        <path d={`${LOOP_L} ${LOOP_R}`} fill={fillLoops} />
      </g>
      <g fill="none" stroke={fillTie} strokeWidth={tw} strokeLinecap="round">
        <path className="bow-tail bow-tail-l" d={TAIL_L} />
        <path className="bow-tail bow-tail-r" d={TAIL_R} />
      </g>
      <circle cx={KNOT.cx} cy={KNOT.cy} r={KNOT.r} fill={fillTie} />
    </g>
  );
  return (
    <>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="140">
          <rect x="0" y="0" width="240" height="140" fill="#fff" />
          <path className="bow-eye bow-eye-l" d={eyeL} fill="#000" />
          <path className="bow-eye bow-eye-r" d={eyeR} fill="#000" />
        </mask>
      </defs>
      {back && !mono && (
        <g transform={`translate(${BACK_OFFSET.x} ${BACK_OFFSET.y})`}>{body(BRAND.plum, BRAND.plum, "bow-back")}</g>
      )}
      {body(loopFill, tieFill, "bow-front")}
      {trim && !mono && (
        <g fill="none" stroke={BRAND.gold} strokeWidth="1" opacity="0.9" pointerEvents="none">
          <path d={eyeL} />
          <path d={eyeR} />
        </g>
      )}
    </>
  );
}

/** Wink + tail swing (primitive 24). Returns handlers to attach to the hover target. */
export function useWink(scope: React.RefObject<Element | null>) {
  const { contextSafe } = useGSAP({ scope });
  const wink = contextSafe(() => {
    if (prefersReducedMotion() || !scope.current) return;
    const eye = scope.current.querySelectorAll(".bow-eye-r");
    const [c] = [EYE_CENTRES[1]];
    gsap.timeline()
      .to(eye, { scaleY: 0.15, svgOrigin: `${c.x} ${c.y}`, duration: 0.09, ease: "power2.in" })
      .to(eye, { scaleY: 1, svgOrigin: `${c.x} ${c.y}`, duration: 0.13, ease: "paper" });
    scope.current.querySelectorAll(".bow-tail-l").forEach((t) => {
      gsap.set(t, { svgOrigin: `${KNOT.cx - 5} ${KNOT.cy + 8}` });
      swing(t, 8, 0.6);
    });
    scope.current.querySelectorAll(".bow-tail-r").forEach((t) => {
      gsap.set(t, { svgOrigin: `${KNOT.cx + 5} ${KNOT.cy + 8}` });
      swing(t, -8, 0.6, { delay: 0.04 });
    });
  });
  const tighten = contextSafe(() => {
    if (prefersReducedMotion() || !scope.current) return;
    const loops = scope.current.querySelectorAll(".bow-front > g:first-child, .bow-back > g:first-child");
    gsap.timeline()
      .to(loops, { scaleX: 0.92, svgOrigin: `${KNOT.cx} ${KNOT.cy}`, duration: 0.12, ease: "power2.in" })
      .to(loops, { scaleX: 1, svgOrigin: `${KNOT.cx} ${KNOT.cy}`, duration: 0.45, ease: "paper" });
  });
  return { wink, tighten };
}

export function BowMask({
  width = 48,
  tone = "colour",
  colour,
  interactive = false,
  className,
  style,
  label,
}: {
  width?: number;
  tone?: BowTone;
  colour?: string;
  interactive?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const { wink } = useWink(ref);
  const small = width <= 24;
  const height = (width * 118) / 236;
  return (
    <svg
      ref={ref}
      viewBox="4 12 236 118"
      width={width}
      height={height}
      className={className}
      style={{ overflow: "visible", ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      onPointerEnter={interactive ? wink : undefined}
    >
      <BowGlyph idBase={id} tone={tone} colour={colour} small={small} back={width > 16} trim={width >= 64} />
    </svg>
  );
}
