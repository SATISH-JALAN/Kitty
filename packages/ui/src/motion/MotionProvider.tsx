"use client";
/**
 * Lenis driven by gsap.ticker, feeding ScrollTrigger (brief 8.1).
 * Smooth scroll runs only where `smooth` is true (the landing page and the Diary);
 * forms and money screens keep native scrolling. Lenis is fetched only when it's
 * switched on, so routes with native scrolling don't ship it.
 */
import type Lenis from "lenis";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { gsap, ScrollTrigger } from "./gsap";
import { prefersReducedMotion } from "./reduced";

const LenisContext = createContext<Lenis | null>(null);

export function useLenis(): Lenis | null {
  return useContext(LenisContext);
}

/** Scroll to a target with Lenis when available, natively otherwise. */
export function scrollToTarget(lenis: Lenis | null, target: string | HTMLElement | number, duration = 1.6) {
  if (lenis) {
    lenis.scrollTo(target, { duration, easing: (t) => gsap.parseEase("camera")(t) });
    return;
  }
  const el = typeof target === "string" ? document.querySelector(target) : target;
  if (typeof el === "number") window.scrollTo({ top: el, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  else (el as HTMLElement | null)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function MotionProvider({ smooth, children }: { smooth: boolean; children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const tickRef = useRef<((t: number) => void) | null>(null);

  useEffect(() => {
    // Refresh triggers once real metrics are known.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!smooth || prefersReducedMotion()) {
      setLenis(null);
      return;
    }
    let instance: Lenis | null = null;
    let tick: ((t: number) => void) | null = null;
    let cancelled = false;
    void import("lenis").then(({ default: LenisCtor }) => {
      if (cancelled) return;
      const lenis = new LenisCtor({ autoRaf: false, lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.2 });
      instance = lenis;
      tick = (t: number) => lenis.raf(t * 1000);
      tickRef.current = tick;
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      lenis.on("scroll", ScrollTrigger.update);
      document.documentElement.classList.add("lenis");
      setLenis(lenis);
    });
    return () => {
      cancelled = true;
      if (tick) gsap.ticker.remove(tick);
      instance?.destroy();
      document.documentElement.classList.remove("lenis");
      setLenis(null);
    };
  }, [smooth]);

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>;
}
