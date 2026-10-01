/**
 * Party emblem (brief 6.3). viewBox 0 0 200 200:
 *  - outer ring with N scallops, one per guest (the emblem counts the seats)
 *  - double gold rule at r = 84 / 80
 *  - rosette of the tradition pattern clipped to r = 72
 *  - a small kitty parcel at the centre, tied with the Bow Mask
 * Colour comes from the party id; the ring is always gold.
 */
import { memo, useId, type CSSProperties } from "react";
import { emblemColour, type TraditionKey } from "@kitty/sdk";
import { BRAND, KNOT, LOOP_L, LOOP_R, EYE_L, EYE_R } from "../brand/bowGeometry";
import { PatternDef, PATTERN_ACCENT } from "./patterns";
import { shade } from "./colour";

function scallopRing(n: number, rOuter: number, rInner: number): string {
  // n bumps around the circle; each bump is an arc between two points on rInner.
  let d = "";
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const x0 = 100 + Math.cos(a0) * rInner;
    const y0 = 100 + Math.sin(a0) * rInner;
    const x1 = 100 + Math.cos(a1) * rInner;
    const y1 = 100 + Math.sin(a1) * rInner;
    // Arc through both points with a sagitta of (rOuter − rInner): R = (c²/4 + h²) / 2h.
    const chord = Math.hypot(x1 - x0, y1 - y0);
    const h = rOuter - rInner;
    const bump = (chord * chord) / 4 / (2 * h) + h / 2;
    d += `${i === 0 ? `M${x0.toFixed(2)},${y0.toFixed(2)}` : ""} A${bump.toFixed(2)},${bump.toFixed(2)} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return `${d} Z`;
}

/** 24 px kitty parcel glyph: kraft box, twine cross, the Bow Mask on top. */
export function ParcelGlyph({ x = 88, y = 88, size = 24 }: { x?: number; y?: number; size?: number }) {
  const s = size / 24;
  const bs = 0.075 * s;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={2 * s} y={6 * s} width={20 * s} height={16 * s} rx={0.8 * s} fill="#C9A57A" stroke="#8C6A45" strokeWidth={0.6 * s} />
      <rect x={2 * s} y={6 * s} width={20 * s} height={3.2 * s} fill="#B8905F" />
      <path d={`M${12 * s},${6 * s} V${22 * s} M${2 * s},${14 * s} H${22 * s}`} stroke={BRAND.twine} strokeWidth={1.4 * s} />
      <g transform={`translate(${12 * s - 120 * bs} ${6.5 * s - 62 * bs}) scale(${bs})`}>
        <path fill={BRAND.marigold} fillRule="evenodd" d={`${LOOP_L} ${EYE_L} ${LOOP_R} ${EYE_R}`} />
        <circle cx={KNOT.cx} cy={KNOT.cy} r={KNOT.r * 1.2} fill={BRAND.twine} />
      </g>
    </g>
  );
}

export interface EmblemProps {
  partyId: string | number;
  guests: number;
  tradition: TraditionKey;
  size?: 40 | 64 | 120 | 240 | number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export const Emblem = memo(function Emblem({ partyId, guests, tradition, size = 64, className, style, title }: EmblemProps) {
  const uid = useId().replace(/:/g, "");
  const colour = emblemColour(partyId);
  const n = Math.max(4, Math.min(20, guests));
  const small = size < 56;
  const ringFill = "#C8A04A";
  const [accent, accent2] = PATTERN_ACCENT[tradition];
  // The pattern needs contrast on the field: lighten dark fields, darken light ones.
  const field = colour.hex;
  const patColour = parseInt(field.slice(1, 3), 16) + parseInt(field.slice(3, 5), 16) + parseInt(field.slice(5, 7), 16) > 420 ? shade(field, -0.35) : shade(accent, 0.1);
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      style={style}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={`${uid}-r`}>
          <circle cx="100" cy="100" r="72" />
        </clipPath>
        <PatternDef id={`${uid}-p`} kind={tradition} colour={patColour} colour2={accent2 ? shade(accent2, 0.2) : undefined} scale={small ? 1.3 : 0.8} />
      </defs>
      {/* back layer: paper depth */}
      <path d={scallopRing(n, 99, 85)} transform="translate(2 3)" fill={shade(field, -0.35)} opacity=".6" />
      {/* scalloped ring: one scallop per guest */}
      <path d={scallopRing(n, 99, 85)} fill={ringFill} />
      <circle cx="100" cy="100" r="88" fill={shade(ringFill, -0.18)} />
      <circle cx="100" cy="100" r="86" fill={field} />
      {/* double gold rule */}
      <circle cx="100" cy="100" r="84" fill="none" stroke={ringFill} strokeWidth="1.6" />
      <circle cx="100" cy="100" r="80" fill="none" stroke={ringFill} strokeWidth="1.2" />
      {/* rosette */}
      <g clipPath={`url(#${uid}-r)`}>
        <circle cx="100" cy="100" r="72" fill={shade(field, 0.08)} />
        <rect x="28" y="28" width="144" height="144" fill={`url(#${uid}-p)`} opacity={small ? 0.7 : 0.85} />
      </g>
      <circle cx="100" cy="100" r="72" fill="none" stroke={shade(field, -0.3)} strokeWidth="1" />
      {/* centre plate for the parcel */}
      <circle cx="100" cy="100" r={small ? 26 : 22} fill={shade(field, -0.25)} />
      <circle cx="100" cy="100" r={small ? 24 : 20} fill="#F3EADB" />
      <ParcelGlyph x={small ? 82 : 86} y={small ? 80 : 84} size={small ? 36 : 28} />
    </svg>
  );
});
