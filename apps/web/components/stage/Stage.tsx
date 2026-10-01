"use client";
/**
 * The virtual stage (brief 16.1 rule 3): one coordinate system (2880×1800 by default)
 * scaled with cover logic and anchored on the scene's focal point, so every layer stays
 * aligned whether the container is the arch, the full viewport or a phone crop.
 * Layers are full-stage children; camera moves use transform origins in stage px.
 */
import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface StageInfo {
  w: number;
  h: number;
  scale: number;
  focal: { x: number; y: number };
}
const StageContext = createContext<StageInfo>({ w: 2880, h: 1800, scale: 1, focal: { x: 1440, y: 900 } });
export const useStage = () => useContext(StageContext);

export function Stage({
  w = 2880,
  h = 1800,
  focal = { x: w / 2, y: h / 2 },
  fit = "cover",
  className,
  style,
  children,
  innerRef,
}: {
  w?: number;
  h?: number;
  focal?: { x: number; y: number };
  fit?: "cover" | "contain";
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ s: 0, x: 0, y: 0 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fitNow = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const s = fit === "cover" ? Math.max(cw / w, ch / h) : Math.min(cw / w, ch / h);
      let x = cw / 2 - focal.x * s;
      let y = ch / 2 - focal.y * s;
      if (fit === "cover") {
        x = Math.min(0, Math.max(cw - w * s, x));
        y = Math.min(0, Math.max(ch - h * s, y));
      } else {
        x = (cw - w * s) / 2;
        y = (ch - h * s) / 2;
      }
      setT({ s, x, y });
    };
    fitNow();
    const ro = new ResizeObserver(fitNow);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, focal.x, focal.y, fit]);

  return (
    <StageContext.Provider value={{ w, h, scale: t.s, focal }}>
      <div ref={box} className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
        <div
          ref={innerRef}
          className="stage-inner"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: w,
            height: h,
            transformOrigin: "0 0",
            transform: `translate(${t.x}px, ${t.y}px) scale(${t.s || 0.0001})`,
            visibility: t.s ? "visible" : "hidden",
          }}
        >
          {children}
        </div>
      </div>
    </StageContext.Provider>
  );
}

/**
 * A full-stage layer. `shadow` adds the depth drop shadow (brief 4.2); it is off for layers
 * the camera scales, since a filter on a full-stage raster costs a repaint per frame (8.5).
 */
export function StageLayer({ children, depth = 0, shadow = false, className, style, layerRef }: { children?: ReactNode; depth?: number; shadow?: boolean; className?: string; style?: CSSProperties; layerRef?: React.Ref<HTMLDivElement> }) {
  const n = 2 + depth * 2;
  const m = 4 + depth * 3;
  return (
    <div
      ref={layerRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        filter: shadow && depth ? `drop-shadow(0 ${n * 1.8}px ${m * 1.8}px rgba(7,3,12,.35))` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
