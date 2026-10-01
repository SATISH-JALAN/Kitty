"use client";
/**
 * Twine rail with beads (brief 7.20) and the bead on a string (primitive 23): the string
 * is a quadratic with 6–14 px of sag; beads are 10 px; the active bead is 14 px marigold
 * and slides along the sag (480 ms paper) while the string wobbles (sag +3 px, damped).
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";

export interface TwineRailProps {
  count: number;
  /** Index of the active bead, or null for none. */
  active?: number | null;
  /** Beads before `active` (or all `done` indices) are "stamped". */
  done?: number[];
  sag?: number;
  height?: number;
  /** Free positions (0–1) instead of evenly spaced beads. */
  positions?: number[];
  labels?: ReactNode[];
  className?: string;
  style?: CSSProperties;
  beadSize?: number;
  /** Hide the passive beads (nav rails show only the moving bead). */
  onlyActive?: boolean;
  ariaHidden?: boolean;
}

function point(t: number, w: number, y0: number, sag: number) {
  return { x: w * t, y: y0 + 4 * sag * t * (1 - t) };
}

export function TwineRail({
  count,
  active = null,
  done = [],
  sag = 10,
  height = 28,
  positions,
  labels,
  className,
  style,
  beadSize = 10,
  onlyActive = false,
  ariaHidden = true,
}: TwineRailProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const bead = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(0);
  const state = useRef({ t: 0, sag });
  const y0 = 6;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const tFor = (i: number) => (positions ? positions[i] : count === 1 ? 0.5 : (i + 0.5) / count);

  const draw = () => {
    if (!path.current || !bead.current || !w) return;
    const s = state.current;
    path.current.setAttribute("d", `M0,${y0} Q${w / 2},${y0 + 2 * s.sag} ${w},${y0}`);
    const p = point(s.t, w, y0, s.sag);
    bead.current.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
  };

  useEffect(() => {
    if (!w) return;
    const s = state.current;
    if (active == null) {
      draw();
      return;
    }
    const target = tFor(active);
    if (prefersReducedMotion() || s.t === 0) {
      s.t = target;
      draw();
      return;
    }
    gsap.to(s, { t: target, duration: 0.48, ease: "paper", onUpdate: draw, overwrite: true });
    const wob = { p: 0 };
    gsap.to(wob, {
      p: 1,
      duration: 0.4,
      ease: "none",
      onUpdate: () => {
        s.sag = sag + 3 * Math.exp(-wob.p * 4) * Math.cos(wob.p * Math.PI * 3);
        draw();
      },
      onComplete: () => {
        s.sag = sag;
        draw();
      },
    });
  }, [active, w]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={wrap} className={className} aria-hidden={ariaHidden || undefined} style={{ position: "relative", height, ...style }}>
      <svg width="100%" height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path ref={path} d={`M0,${y0} Q${w / 2},${y0 + 2 * sag} ${w},${y0}`} fill="none" stroke="var(--twine)" strokeWidth="1.25" />
      </svg>
      {!onlyActive &&
        Array.from({ length: count }, (_, i) => {
          const p = point(tFor(i), w, y0, sag);
          const isDone = done.includes(i);
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: beadSize,
                height: beadSize,
                borderRadius: "50%",
                transform: `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`,
                background: isDone ? "var(--twine)" : "var(--bg-raised)",
                boxShadow: isDone ? "none" : "inset 0 0 0 1px color-mix(in srgb, var(--twine) 70%, transparent)",
              }}
              data-bead={i}
            >
              {labels?.[i] != null && (
                <span className="type-mono" style={{ position: "absolute", top: beadSize + 6, left: "50%", transform: "translateX(-50%)", fontSize: 11, whiteSpace: "nowrap", color: "var(--fg-soft)" }}>
                  {labels[i]}
                </span>
              )}
            </span>
          );
        })}
      <span
        ref={bead}
        className="rail-active"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "var(--marigold)",
          boxShadow: "var(--d1), inset -2px -2px 0 rgba(0,0,0,.12)",
          transform: `translate(${point(active == null ? 0.5 : tFor(active), w, y0, sag).x}px, ${point(active == null ? 0.5 : tFor(active), w, y0, sag).y}px) translate(-50%, -50%)`,
          display: active == null ? "none" : "block",
        }}
      />
    </div>
  );
}
