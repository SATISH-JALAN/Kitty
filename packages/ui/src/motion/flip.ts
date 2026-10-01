"use client";
/**
 * Flip only runs after an interaction (a chip-in settles, a filter re-deals, a seat is
 * added), so it stays out of the first load: importing this module fetches it when the
 * browser is idle after load. `getFlip()` is null until then, and callers skip the
 * animation (the DOM still updates) in that rare case.
 */
import type { Flip as FlipPlugin } from "gsap/Flip";
import { gsap } from "./gsap";

export type FlipState = ReturnType<typeof FlipPlugin.getState>;

let flip: typeof FlipPlugin | null = null;
let loading: Promise<typeof FlipPlugin> | null = null;

export function loadFlip(): Promise<typeof FlipPlugin> {
  loading ??= import("gsap/Flip").then(({ Flip }) => {
    gsap.registerPlugin(Flip);
    flip = Flip;
    return Flip;
  });
  return loading;
}

export function getFlip(): typeof FlipPlugin | null {
  return flip;
}

if (typeof window !== "undefined") {
  const start = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => void loadFlip(), { timeout: 2000 });
    else setTimeout(() => void loadFlip(), 800);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
