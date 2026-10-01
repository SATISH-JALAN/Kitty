"use client";
/**
 * MorphSVG only drives the text-link dot → arrow hover, so it stays out of the first
 * load: it's fetched when the browser is idle after load, long before a pointer
 * usually reaches a link. A hover that beats it just waits for the chunk.
 */
import { gsap } from "./gsap";

let ready = false;
let loading: Promise<void> | null = null;

export function loadMorph(): Promise<void> {
  loading ??= import("gsap/MorphSVGPlugin").then(({ MorphSVGPlugin }) => {
    gsap.registerPlugin(MorphSVGPlugin);
    ready = true;
  });
  return loading;
}

/** Runs `fn` now if MorphSVG is registered, otherwise as soon as it is. */
export function withMorph(fn: () => void) {
  if (ready) fn();
  else void loadMorph().then(fn);
}

if (typeof window !== "undefined") {
  const start = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => void loadMorph(), { timeout: 3000 });
    else setTimeout(() => void loadMorph(), 1200);
  };
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}
