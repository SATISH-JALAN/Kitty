"use client";
/**
 * Physical primitives (brief 9): lantern iris (1), rubber stamp (12), press (17),
 * magnetic pull (19), chit assembly (11), torn seam (4), page turn (5),
 * flicker (4.5). Each respects reduced motion by jumping to the end state.
 */
import { gsap } from "../gsap";
import { prefersReducedMotion } from "../reduced";

/* ------------------------------ 1 · lantern iris ------------------------------ */

/**
 * Reveal `el` through a circle growing from (x, y) in viewport px: clip-path
 * circle(0) → circle(150%), 900 ms ink. `glow` (optional) brightens 200 ms before.
 */
export function lanternIris(
  el: HTMLElement,
  at: { x: number; y: number },
  opts: { duration?: number; glow?: Element | null; reverse?: boolean; onComplete?: () => void } = {},
) {
  const tl = gsap.timeline({ onComplete: opts.onComplete });
  const r = el.getBoundingClientRect();
  const cx = at.x - r.left;
  const cy = at.y - r.top;
  const from = `circle(0% at ${cx}px ${cy}px)`;
  const to = `circle(150% at ${cx}px ${cy}px)`;
  if (prefersReducedMotion()) {
    tl.set(el, { clipPath: opts.reverse ? from : "none" });
    return tl;
  }
  if (opts.glow) tl.to(opts.glow, { scale: 1.6, duration: 0.3, ease: "lantern" }, 0);
  tl.fromTo(
    el,
    { clipPath: opts.reverse ? to : from },
    { clipPath: opts.reverse ? from : to, duration: opts.duration ?? 0.9, ease: "ink", clearProps: opts.reverse ? undefined : "clipPath" },
    opts.glow ? 0.2 : 0,
  );
  return tl;
}

/* ------------------------------ 12 · rubber stamp ------------------------------ */

/**
 * The stamp starts at scale 1.4, rotation θ+6°, opacity 0; lands at scale 1, θ,
 * opacity 1 over 260 ms `stamp`. Ink blur settles 1.5 px → 0 over 200 ms. The
 * surface it lands on shakes x ±2 px, 2 cycles, 120 ms.
 */
export function stamp(el: Element, opts: { theta?: number; surface?: Element | null; delay?: number; scale?: number } = {}) {
  const theta = opts.theta ?? -6;
  const s = opts.scale ?? 1;
  const tl = gsap.timeline({ delay: opts.delay ?? 0 });
  if (prefersReducedMotion()) {
    tl.set(el, { opacity: 1, scale: s, rotation: theta, filter: "none" });
    return tl;
  }
  tl.fromTo(
    el,
    { opacity: 0, scale: 1.4 * s, rotation: theta + 6, filter: "blur(1.5px)" },
    { opacity: 1, scale: s, rotation: theta, duration: 0.26, ease: "stamp" },
  ).to(el, { filter: "blur(0px)", duration: 0.2, ease: "ink", clearProps: "filter" }, 0.18);
  if (opts.surface) {
    tl.to(opts.surface, { keyframes: { x: [0, 2, -2, 2, -2, 0] }, duration: 0.12, ease: "none" }, 0.22);
  }
  return tl;
}

/* ------------------------------ 17 · press ------------------------------ */

/** Pointer handlers for the press: scale .98, y +1 px, one depth level down (90 ms); release 180 ms paper. */
export function pressHandlers(level: 1 | 2 | 3 | 4 = 2) {
  const down = (e: React.PointerEvent<HTMLElement>) => {
    if (prefersReducedMotion()) return;
    gsap.to(e.currentTarget, { scale: 0.98, y: 1, boxShadow: `var(--d${Math.max(0, level - 1)}, none)`, duration: 0.09, ease: "power2.out", overwrite: "auto" });
  };
  const up = (e: React.PointerEvent<HTMLElement>) => {
    gsap.to(e.currentTarget, { scale: 1, y: 0, clearProps: "boxShadow", duration: 0.18, ease: "paper", overwrite: "auto" });
  };
  return { onPointerDown: down, onPointerUp: up, onPointerLeave: up, onPointerCancel: up };
}

/* ------------------------------ 19 · magnetic pull ------------------------------ */

/**
 * Within 80 px the element follows the pointer at 0.3× and its label at 0.15×,
 * quickTo 500 ms paper; released with a 600 ms return. Returns a cleanup.
 */
export function magnetic(el: HTMLElement, label?: HTMLElement | null, radius = 80) {
  if (prefersReducedMotion() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
  const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "paper" });
  const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "paper" });
  const lx = label ? gsap.quickTo(label, "x", { duration: 0.5, ease: "paper" }) : null;
  const ly = label ? gsap.quickTo(label, "y", { duration: 0.5, ease: "paper" }) : null;
  let active = false;
  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const inside = Math.abs(dx) < r.width / 2 + radius && Math.abs(dy) < r.height / 2 + radius;
    if (inside) {
      active = true;
      xTo(dx * 0.3);
      yTo(dy * 0.3);
      lx?.(dx * 0.15);
      ly?.(dy * 0.15);
    } else if (active) {
      active = false;
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "paper" });
      if (label) gsap.to(label, { x: 0, y: 0, duration: 0.6, ease: "paper" });
    }
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  return () => window.removeEventListener("pointermove", onMove);
}

/* ------------------------------ 4.5 · lantern flicker ------------------------------ */

/**
 * Noise-driven opacity .9–1 at 2–4 Hz (a new random target every 250–400 ms) while
 * `el` is in view. Returns a stop function.
 */
export function flicker(el: Element) {
  if (prefersReducedMotion()) return () => {};
  const to = gsap.quickTo(el, "opacity", { duration: 0.22, ease: "sine.inOut" });
  let timer: ReturnType<typeof setTimeout> | null = null;
  let visible = false;
  const step = () => {
    to(0.9 + Math.random() * 0.1);
    timer = setTimeout(step, 250 + Math.random() * 150);
  };
  const io = new IntersectionObserver(([entry]) => {
    const now = entry?.isIntersecting ?? false;
    if (now && !visible) step();
    if (!now && timer) {
      clearTimeout(timer);
      timer = null;
    }
    visible = now;
  });
  io.observe(el);
  return () => {
    io.disconnect();
    if (timer) clearTimeout(timer);
  };
}
