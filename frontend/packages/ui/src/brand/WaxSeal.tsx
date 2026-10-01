"use client";
/**
 * Wax seal (brief 7.18): seeded lumpy blob, wax gradient, debossed ring and Bow Mask.
 * `cracked` 0–3 reveals hairline cracks (DrawSVG-able: `.seal-crack`), for the
 * keepsafe opening slice by slice.
 */
import { forwardRef, useId, useMemo, type CSSProperties } from "react";
import { BRAND, EYE_L, EYE_R, KNOT, LOOP_L, LOOP_R, TAIL_L, TAIL_R, TAIL_WIDTH } from "./bowGeometry";
import { sealBlob, sealCracks } from "./seal";

export interface WaxSealProps {
  size?: 24 | 32 | 48 | 56 | 64 | 72 | 96 | 160 | number;
  seed?: number;
  cracked?: 0 | 1 | 2 | 3;
  /** Draw all crack paths (hidden with DrawSVG 0%) so they can be animated in. */
  crackable?: boolean;
  shadow?: boolean;
  className?: string;
  style?: CSSProperties;
  label?: string;
}

function Bow({ fill, dx = 0, dy = 0, opacity = 1 }: { fill: string; dx?: number; dy?: number; opacity?: number }) {
  const s = 0.34;
  return (
    <g transform={`translate(${(-120 * s + dx).toFixed(2)} ${(-62 * s + dy).toFixed(2)}) scale(${s})`} opacity={opacity}>
      <path fill={fill} fillRule="evenodd" d={`${LOOP_L} ${EYE_L} ${LOOP_R} ${EYE_R}`} />
      <circle cx={KNOT.cx} cy={KNOT.cy} r={KNOT.r} fill={fill} />
      <g fill="none" stroke={fill} strokeWidth={TAIL_WIDTH * 1.15} strokeLinecap="round">
        <path d={TAIL_L} />
        <path d={TAIL_R} />
      </g>
    </g>
  );
}

export const WaxSeal = forwardRef<SVGSVGElement, WaxSealProps>(function WaxSeal(
  { size = 48, seed = 21, cracked = 0, crackable = false, shadow = true, className, style, label },
  ref,
) {
  const id = useId().replace(/:/g, "");
  const shape = useMemo(() => sealBlob(50, seed), [seed]);
  const cracks = useMemo(() => sealCracks(50, seed + 3), [seed]);
  const small = size <= 32;
  return (
    <svg
      ref={ref}
      viewBox="-60 -60 120 120"
      width={size}
      height={size}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        overflow: "visible",
        filter: shadow ? "drop-shadow(0 1px 1px rgba(7,3,12,.28)) drop-shadow(0 5px 7px rgba(7,3,12,.26))" : undefined,
        ...style,
      }}
    >
      <defs>
        <radialGradient id={`${id}-wax`} cx="36%" cy="30%" r="80%">
          <stop offset="0" stopColor={BRAND.waxHi} />
          <stop offset=".55" stopColor={BRAND.wax} />
          <stop offset="1" stopColor={BRAND.waxLo} />
        </radialGradient>
      </defs>
      <g className="seal-body">
        <path d={shape.blob} fill={`url(#${id}-wax)`} />
        {!small && (
          <>
            <circle r={shape.ringR} fill="none" stroke={BRAND.waxLo} strokeOpacity=".7" strokeWidth="2.2" />
            <circle r={shape.ringR} fill="none" stroke={BRAND.waxHi} strokeOpacity=".55" strokeWidth="1" transform="translate(-.6 -.8)" />
          </>
        )}
        <Bow fill={BRAND.waxLo} dx={0.8} dy={1.1} opacity={0.75} />
        <Bow fill="#8E2A4A" opacity={0.95} />
        <Bow fill={BRAND.waxHi} dx={-0.5} dy={-0.7} opacity={0.35} />
      </g>
      {(crackable || cracked > 0) && (
        <g className="seal-cracks" fill="none" stroke={BRAND.waxLo} strokeWidth="1.1" strokeLinecap="round">
          {cracks.map((d, i) => (
            <path key={i} className="seal-crack" d={d} style={{ visibility: crackable || i < cracked ? "visible" : "hidden" }} />
          ))}
        </g>
      )}
    </svg>
  );
});
