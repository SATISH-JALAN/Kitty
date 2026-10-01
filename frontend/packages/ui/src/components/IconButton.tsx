"use client";
/**
 * Icon button (brief 7.2): a 44×44 hit area, the glyph at 20. Hover draws a 36 px stitched
 * circle behind the glyph (240 ms); a paper-tag tooltip after 500 ms. Always labelled.
 */
import { forwardRef, useId, useRef } from "react";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { Icon, type IconName } from "./Icon";
import { Tooltip } from "./Tooltip";

export const IconButton = forwardRef<HTMLButtonElement, { icon: IconName; label: string; onClick?: () => void; tooltip?: boolean; className?: string; style?: React.CSSProperties; size?: number }>(
  function IconButton({ icon, label, onClick, tooltip = true, className, style, size = 20 }, ref) {
    const circle = useRef<SVGCircleElement>(null);
    const mid = `ib-${useId().replace(/:/g, "")}`;
    const over = () => {
      if (!circle.current || prefersReducedMotion()) return;
      gsap.fromTo(circle.current, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.24, ease: "ink", overwrite: true });
    };
    const out = () => {
      if (circle.current) gsap.to(circle.current, { drawSVG: "100% 100%", duration: 0.2, ease: "ink", overwrite: true });
    };
    const btn = (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        onClick={onClick}
        onPointerEnter={over}
        onPointerLeave={out}
        data-focus-ring=""
        className={className}
        style={{ position: "relative", width: 44, height: 44, display: "grid", placeItems: "center", color: "var(--fg)", borderRadius: "50%", ...style }}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: "absolute", transform: "rotate(-90deg)" }} aria-hidden="true">
          <mask id={mid}>
            <circle ref={circle} cx="18" cy="18" r="17" fill="none" stroke="#fff" strokeWidth="3" style={{ strokeDasharray: "0 200" }} />
          </mask>
          <circle cx="18" cy="18" r="17" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1" strokeDasharray="4 3" mask={`url(#${mid})`} />
        </svg>
        <Icon name={icon} size={size} />
      </button>
    );
    return tooltip ? <Tooltip content={label}>{btn}</Tooltip> : btn;
  },
);
