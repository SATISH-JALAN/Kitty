"use client";
/**
 * Bunting chart (brief Act 7, 13.10): the data line is a twine string, the points are
 * 12 px lanterns that light as the string reaches them. Mono axes, stitched gridlines
 * at 20%. Lanterns are focusable; hover or focus hangs a paper tag with the week and the
 * balance. `drawn` (0–1) lets a scene scrub the string; omit it to draw once on view.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatMoney } from "@kitty/sdk";
import { gsap } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";

export interface Point {
  at: string;
  balance: number;
}

export function BuntingChart({ series, height = 360, drawn, label = "Devnet sample data", className }: { series: Point[]; height?: number; drawn?: number; label?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  const [lit, setLit] = useState(drawn == null ? 0 : -1);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pad = { l: 64, r: 16, t: 28, b: 34 };
  const { pts, ticks, d } = useMemo(() => {
    const vals = series.map((p) => p.balance);
    const max = Math.max(...vals) * 1.08;
    const min = Math.min(...vals) * 0.9;
    const x = (i: number) => pad.l + (i / Math.max(1, series.length - 1)) * (w - pad.l - pad.r);
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (height - pad.t - pad.b);
    const pts = series.map((p, i) => ({ x: x(i), y: y(p.balance), p }));
    // A twine sags between the pegs: quadratic segments dipping slightly below the straight line.
    let d = `M${pts[0]?.x ?? 0},${pts[0]?.y ?? 0}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      d += ` Q${(a.x + b.x) / 2},${Math.max(a.y, b.y) + 7} ${b.x},${b.y}`;
    }
    const ticks = Array.from({ length: 4 }, (_, k) => {
      const v = min + ((max - min) * (k + 0.5)) / 4;
      return { y: y(v), v };
    });
    return { pts, ticks, d };
  }, [series, w, height]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scrubbed drawing (Act 7) or a single draw on first view (/house).
  useEffect(() => {
    const p = path.current;
    if (!p || !pts.length) return;
    if (drawn != null) {
      gsap.set(p, { drawSVG: `0% ${Math.max(0, Math.min(1, drawn)) * 100}%` });
      setLit(Math.floor(drawn * (pts.length - 1) + 0.001));
      return;
    }
    if (prefersReducedMotion()) {
      gsap.set(p, { drawSVG: "100%" });
      setLit(pts.length - 1);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      const s = { v: 0 };
      gsap.fromTo(s, { v: 0 }, { v: 1, duration: 1.6, ease: "lantern", onUpdate: () => {
        gsap.set(p, { drawSVG: `0% ${s.v * 100}%` });
        setLit(Math.floor(s.v * (pts.length - 1) + 0.001));
      } });
    });
    io.observe(p);
    return () => io.disconnect();
  }, [drawn, pts.length]);

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div ref={wrap} className={className} style={{ position: "relative", width: "100%", height }}>
      <span className="type-mono" style={{ position: "absolute", right: 0, top: 0, fontSize: 11, color: "var(--fg-soft)" }}>
        {label}
      </span>
      <svg width={w} height={height} role="img" aria-labelledby={`${id}-t`} style={{ overflow: "visible" }}>
        <title id={`${id}-t`}>{`House Fund balance, ${series.length} weeks: from ${formatMoney(series[0]?.balance ?? 0)} to ${formatMoney(series[series.length - 1]?.balance ?? 0)}.`}</title>
        {ticks.map((t) => (
          <g key={t.y}>
            <line x1={pad.l} x2={w - pad.r} y1={t.y} y2={t.y} stroke="var(--fg)" strokeOpacity=".2" strokeDasharray="4 3" />
            <text x={pad.l - 10} y={t.y + 4} textAnchor="end" fill="var(--fg-soft)" style={{ font: "400 11px var(--font-mono)" }}>
              {formatMoney(Math.round(t.v / 1e8) * 1e8)}
            </text>
          </g>
        ))}
        {pts.map((p, i) =>
          i % Math.ceil(pts.length / Math.max(2, Math.floor((w - pad.l) / 110))) === 0 ? (
            <text key={i} x={p.x} y={height - 8} textAnchor="middle" fill="var(--fg-soft)" style={{ font: "400 11px var(--font-mono)" }}>
              {fmtDate(p.p.at)}
            </text>
          ) : null,
        )}
        <path ref={path} d={d} fill="none" stroke="var(--twine)" strokeWidth="1.5" strokeLinecap="round" />
        {pts.map((p, i) => (
          <g
            key={i}
            transform={`translate(${p.x} ${p.y})`}
            tabIndex={i <= lit ? 0 : -1}
            role="img"
            aria-label={`Week of ${fmtDate(p.p.at)}: ${formatMoney(p.p.balance)}`}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            style={{ cursor: "pointer", outline: "none" }}
          >
            <circle r="16" fill="transparent" />
            <circle r="14" fill="rgba(255,210,122,.35)" opacity={i <= lit ? 1 : 0} style={{ transition: "opacity .3s", filter: "blur(4px)" }} />
            <line y1="-9" y2="-6" stroke="var(--twine)" strokeWidth="1" />
            <rect x="-2.5" y="-7" width="5" height="1.6" rx=".4" fill="var(--plum)" />
            <ellipse ry="5.5" rx="4.6" fill={i <= lit ? "#FFD27A" : "transparent"} stroke={i <= lit ? "rgba(122,31,61,.5)" : "var(--fg-soft)"} strokeWidth=".8" strokeDasharray={i <= lit ? undefined : "2 1.5"} style={{ transition: "fill .3s" }} />
            <rect x="-2" y="5.2" width="4" height="1.4" rx=".4" fill="var(--plum)" />
          </g>
        ))}
      </svg>
      {hover != null && pts[hover] && (
        <div className="chart-tag" style={{ left: pts[hover].x, top: pts[hover].y + 10 }} role="tooltip">
          <span className="chart-tag-string" aria-hidden="true" />
          <span className="chart-tag-card" data-world="paper">
            <span className="type-mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              Week of {fmtDate(pts[hover].p.at)}
            </span>
            <span className="type-money">{formatMoney(pts[hover].p.balance)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
