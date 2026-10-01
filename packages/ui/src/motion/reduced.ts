"use client";
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Reactive reduced-motion flag. Server render assumes full motion; the client corrects it before paint of motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

/** Media contexts for gsap.matchMedia (brief 8.1). */
export const MQ = {
  desktop: "(min-width: 1024px)",
  mobile: "(max-width: 1023px)",
  reduce: QUERY,
  motion: "(prefers-reduced-motion: no-preference)",
  fine: "(hover: hover) and (pointer: fine)",
} as const;

/** Coarse pointer / touch device. */
export function isTouch(): boolean {
  if (typeof window === "undefined") return false;
  return !window.matchMedia(MQ.fine).matches;
}

/** `?nosnap` turns off chapter snapping (review tooling only: frame captures jump to exact positions). */
export function snapOff(): boolean {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nosnap");
}
