"use client";
/**
 * Stage props drawn in code (brief 16: everything that animates is code-built), matched
 * to docs/ref/R-2-props.png: the kitty parcel (its bow IS the Bow Mask, brief 6.4), the
 * paper bowl of chits, and a masked guest silhouette.
 */
import { forwardRef, type CSSProperties } from "react";
import { BRAND, EYE_L, EYE_R, KNOT, LOOP_L, LOOP_R, TAIL_L, TAIL_R, TAIL_WIDTH } from "@kitty/ui/brand/bowGeometry";
import { Mask } from "@kitty/ui/generators/mask";
import type { TraditionKey } from "@kitty/sdk";
import { patternCss } from "@kitty/ui/generators/patterns";

/** The kitty: a kraft parcel tied with twine, the bow drawn as the logo. */
export const KittyParcel = forwardRef<SVGSVGElement, { size?: number; className?: string; style?: CSSProperties }>(function KittyParcel({ size = 96, className, style }, ref) {
  const s = 0.2;
  return (
    <svg ref={ref} viewBox="0 0 120 110" width={size} height={(size * 110) / 120} className={className} style={{ overflow: "visible", ...style }} aria-hidden="true">
      <defs>
        <pattern id="parcel-kraft" patternUnits="userSpaceOnUse" width="120" height="120">
          <image href="/art/P-3-512.webp" width="120" height="120" />
        </pattern>
      </defs>
      {/* shadow */}
      <ellipse cx="62" cy="100" rx="50" ry="7" fill="rgba(7,3,12,.35)" />
      {/* box: top face and two sides in 3/4 view */}
      <path d="M14,40 L60,24 L106,40 L60,56 Z" fill="#D6B78E" />
      <path d="M14,40 L60,56 L60,98 L14,82 Z" fill="#B8905F" />
      <path d="M60,56 L106,40 L106,82 L60,98 Z" fill="#C9A57A" />
      <path d="M14,40 L60,24 L106,40 L60,56 Z M14,40 L60,56 L60,98 L14,82 Z M60,56 L106,40 L106,82 L60,98 Z" fill="url(#parcel-kraft)" opacity=".35" />
      <path d="M14,40 L60,56 L106,40 M60,56 V98" fill="none" stroke="#8C6A45" strokeWidth=".8" opacity=".7" />
      {/* twine: a cross over the top and down the sides */}
      <g fill="none" stroke={BRAND.twine} strokeWidth="2.2" strokeLinecap="round">
        <path d="M37,32 L83,48 L83,90" />
        <path d="M83,32 L37,48 L37,90" />
      </g>
      <g fill="none" stroke="#F3EADB" strokeWidth=".8" strokeDasharray="1.5 2.5" opacity=".7">
        <path d="M37,32 L83,48 L83,90" />
        <path d="M83,32 L37,48 L37,90" />
      </g>
      {/* the bow is the mark */}
      <g transform={`translate(${60 - 120 * s} ${34 - 64 * s}) scale(${s})`}>
        <g transform="translate(3 4)" fill={BRAND.plum}>
          <path fillRule="evenodd" d={`${LOOP_L} ${EYE_L} ${LOOP_R} ${EYE_R}`} />
        </g>
        <path fill={BRAND.marigold} fillRule="evenodd" d={`${LOOP_L} ${EYE_L} ${LOOP_R} ${EYE_R}`} />
        <g fill="none" stroke={BRAND.twine} strokeWidth={TAIL_WIDTH} strokeLinecap="round">
          <path d={TAIL_L} />
          <path d={TAIL_R} />
        </g>
        <circle cx={KNOT.cx} cy={KNOT.cy} r={KNOT.r} fill={BRAND.twine} />
      </g>
    </svg>
  );
});

/** Paper bowl with a scalloped rim and the tradition's band, seen from slightly above. */
export function Bowl({ size = 120, tradition = "kitty", children, className, style }: { size?: number; tradition?: TraditionKey; children?: React.ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={className} style={{ position: "relative", width: size, height: size, ...style }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <clipPath id="bowl-inner">
            <ellipse cx="50" cy="50" rx="41" ry="41" />
          </clipPath>
        </defs>
        <circle cx="51" cy="53" r="47" fill="rgba(7,3,12,.28)" />
        {/* scalloped rim */}
        <path
          d={Array.from({ length: 18 }, (_, i) => {
            const a0 = (i / 18) * Math.PI * 2;
            const a1 = ((i + 1) / 18) * Math.PI * 2;
            const r = 45;
            const x0 = 50 + Math.cos(a0) * r;
            const y0 = 50 + Math.sin(a0) * r;
            const x1 = 50 + Math.cos(a1) * r;
            const y1 = 50 + Math.sin(a1) * r;
            return `${i === 0 ? `M${x0.toFixed(1)},${y0.toFixed(1)}` : ""} A8 8 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}`;
          }).join(" ") + " Z"}
          fill="#E9A21E"
        />
        <circle cx="50" cy="50" r="44" fill="#7A1F3D" />
        <circle cx="50" cy="50" r="41" fill="#5A1530" />
        <g clipPath="url(#bowl-inner)">
          <circle cx="50" cy="44" r="41" fill="#4A0F24" opacity=".6" />
        </g>
        <circle cx="50" cy="50" r="44" fill="none" stroke="#C8A04A" strokeWidth=".8" />
      </svg>
      <span aria-hidden="true" style={{ position: "absolute", inset: "4%", borderRadius: "50%", backgroundImage: patternCss(tradition, "#F4A300", "#F4A300", 0.35), opacity: 0.18, mixBlendMode: "screen", pointerEvents: "none" }} />
      <div className="bowl-inside" style={{ position: "absolute", inset: "12%", borderRadius: "50%" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * A guest: a masked bust silhouette (brief 4.7) — no face, ever; the mask covers the upper
 * face, the lower face is the silhouette colour; a clothing band in the tradition pattern.
 */
export function Guest({ width, colour, animal, tradition, glow = 0, className, style }: { width: number; colour: number; animal: number; tradition: TraditionKey; glow?: number; className?: string; style?: CSSProperties }) {
  const h = width * 1.25;
  return (
    <div className={className} style={{ position: "relative", width, height: h, ...style }}>
      <svg viewBox="0 0 80 100" width={width} height={h} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs>
          <clipPath id={`band-${colour}-${animal}`}>
            <path d="M8,100 C8,78 20,68 40,66 C60,68 72,78 72,100 Z" />
          </clipPath>
        </defs>
        {/* rim light from the table's lantern glow */}
        <path d="M8,100 C8,78 20,68 40,66 C60,68 72,78 72,100 Z" fill="var(--silhouette)" />
        <path d="M31,60 C31,54 35,52 40,52 C45,52 49,54 49,60 L48,68 L32,68 Z" fill="var(--silhouette)" />
        <ellipse cx="40" cy="38" rx="15" ry="18" fill="var(--silhouette)" />
        <path d="M25,34 C25,20 33,14 41,14 C51,14 57,22 55,34 C52,26 46,23 40,23 C34,23 28,27 25,34 Z" fill="var(--silhouette-hair)" />
        <g clipPath={`url(#band-${colour}-${animal})`}>
          <rect x="0" y="76" width="80" height="9" fill="#C8A04A" opacity=".3" />
          <rect x="0" y="88" width="80" height="3" fill="#C8A04A" opacity=".22" />
        </g>
        <path d="M8,100 C8,78 20,68 40,66 C60,68 72,78 72,100" fill="none" stroke="rgba(255,210,122,.35)" strokeWidth="1" opacity={0.4 + glow * 0.6} />
      </svg>
      <Mask colour={colour} animal={animal} tradition={tradition} width={width * 0.62} style={{ position: "absolute", left: "19%", top: "24%" }} />
    </div>
  );
}
