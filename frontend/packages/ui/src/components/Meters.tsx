"use client";
/**
 * Keepsafe meter (brief 7.9) and grace ring (7.10).
 * Keepsafe: a sealed envelope, the plain line, and an 8 px bar that advances on each
 * chip-in (480 ms paper) while the seal cracks one step (4 states).
 * Grace ring: a 3 px track with the grace stroke; a lantern whose glow scales with the
 * hours left. No red, no pulsing.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { WaxSeal } from "../brand/WaxSeal";
import { Lantern } from "./Lantern";

export function KeepsafeMeter({ total, back, line, className }: { total: number; back: number; line: ReactNode; className?: string }) {
  const fill = useRef<HTMLSpanElement>(null);
  const ratio = total > 0 ? Math.min(1, back / total) : 0;
  const cracked = Math.min(3, Math.floor(ratio * 4)) as 0 | 1 | 2 | 3;
  const first = useRef(true);
  useEffect(() => {
    if (!fill.current) return;
    if (first.current || prefersReducedMotion()) {
      gsap.set(fill.current, { scaleX: ratio });
      first.current = false;
      return;
    }
    gsap.to(fill.current, { scaleX: ratio, duration: 0.48, ease: "paper" });
  }, [ratio]);
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ position: "relative", width: 48, height: 36, flex: "none" }} aria-hidden="true">
          <svg viewBox="0 0 48 36" width="48" height="36">
            <rect x="1" y="3" width="46" height="31" rx="1.5" fill="var(--kraft)" />
            <path d="M1.5,4 L24,21 L46.5,4" fill="none" stroke="#8C6A45" strokeWidth="1" />
            <path d="M1,33.5 L18,19 M47,33.5 L30,19" stroke="#A9845A" strokeWidth=".8" />
          </svg>
          <WaxSeal size={24} cracked={cracked} shadow={false} style={{ position: "absolute", left: 12, top: 9 }} />
        </span>
        <span className="type-money" style={{ lineHeight: 1.4 }}>
          {line}
        </span>
      </div>
      <span style={{ position: "relative", height: 8, borderRadius: 2, background: "var(--paper-deep)", overflow: "hidden", boxShadow: "inset 0 1px 1px rgba(34,21,31,.12)" }} role="presentation">
        <span ref={fill} style={{ position: "absolute", inset: 0, background: "var(--ink)", transformOrigin: "0% 50%", transform: `scaleX(${ratio})` }} />
      </span>
    </div>
  );
}

export function GraceRing({ hoursLeft, total = 72, size = 64 }: { hoursLeft: number; total?: number; size?: number }) {
  const arc = useRef<SVGCircleElement>(null);
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, hoursLeft / total));
  useEffect(() => {
    if (!arc.current) return;
    if (prefersReducedMotion()) {
      gsap.set(arc.current, { strokeDashoffset: c * (1 - frac) });
      return;
    }
    gsap.fromTo(arc.current, { strokeDashoffset: c }, { strokeDashoffset: c * (1 - frac), duration: 0.9, ease: "lantern" });
  }, [frac, c]);
  return (
    <span style={{ position: "relative", width: size, height: size, display: "inline-grid", placeItems: "center", flex: "none" }} aria-hidden="true">
      <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth="3" />
        <circle ref={arc} cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--grace)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <Lantern width={size * 0.36} lit={0.25 + frac * 0.75} flicker />
    </span>
  );
}
