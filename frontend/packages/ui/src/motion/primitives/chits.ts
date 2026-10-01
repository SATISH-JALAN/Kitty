"use client";
/** Chit assembly (primitive 11), kept apart from ./physical because it needs MotionPath. */
import { gsap } from "../gsap";
import "../motionPath";
import { prefersReducedMotion } from "../reduced";

/**
 * Chits fly from where they are to `targets` (viewport points) along one-control-point
 * curves, 900–1300 ms camera, then land with a 60 ms squash.
 */
export function chitAssembly(chits: HTMLElement[], targets: { x: number; y: number }[], seed = 1) {
  const tl = gsap.timeline();
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  chits.forEach((c, i) => {
    const r = c.getBoundingClientRect();
    const sx = r.left + r.width / 2;
    const sy = r.top + r.height / 2;
    const t = targets[i % targets.length];
    const dx = t.x - sx;
    const dy = t.y - sy;
    const arc = (rand() - 0.5) * window.innerWidth * 0.2;
    const path = [
      { x: 0, y: 0 },
      { x: dx / 2 + arc, y: dy / 2 - Math.abs(arc) * 0.6 },
      { x: dx, y: dy },
    ];
    if (prefersReducedMotion()) {
      tl.set(c, { x: dx, y: dy }, 0);
      return;
    }
    tl.to(c, { motionPath: { path, curviness: 1.2 }, duration: 0.9 + rand() * 0.4, ease: "camera" }, i * 0.04);
    tl.to(c, { keyframes: { scaleY: [1, 0.86, 1], scaleX: [1, 1.08, 1] }, duration: 0.06, ease: "none" }, ">-0.01");
  });
  return tl;
}
