"use client";
/**
 * Mounts the WebGL lantern sky over the static H-1 once the page has painted, only where
 * supported (15.4); otherwise the painted sky underneath is the fallback. The three.js
 * chunk is fetched only on devices that can run it, and only after the hero is revealed
 * and the browser is idle, so it never competes with the preloader or the hero intro.
 */
import { useEffect, useRef } from "react";
import { afterReveal } from "@/lib/reveal";
import { skySupported } from "@/webgl/support";

export function SkyCanvas({ onReady }: { onReady?: (h: { setBoost: (v: number) => void }) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let handle: { destroy: () => void; setBoost: (v: number) => void } | null = null;
    let cancelled = false;
    const start = async () => {
      if (cancelled || !skySupported()) return;
      const mod = await import("@/webgl/LanternSky");
      if (cancelled || !ref.current) return;
      handle = mod.mountLanternSky(ref.current);
      if (handle) onReady?.(handle);
    };
    const idle = () => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(() => void start(), { timeout: 2000 });
      else setTimeout(() => void start(), 600);
    };
    const cancelReveal = afterReveal(idle);
    return () => {
      cancelled = true;
      cancelReveal();
      handle?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />;
}
