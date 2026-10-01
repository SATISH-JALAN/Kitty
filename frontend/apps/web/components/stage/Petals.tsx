"use client";
/**
 * Marigold petals and paper scraps (brief 13.7): a one-off canvas shower for the Draw's
 * reveal, 2.5 s, ≤ 80 particles, gravity + sway, only marigold, saffron, cream and kraft.
 * Never confetti colours, never a loop.
 */
import { forwardRef, useImperativeHandle, useRef } from "react";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";

const COLOURS = ["#F4A300", "#E4572E", "#F6EEDF", "#C9A57A"];

export interface PetalsHandle {
  burst: (origin?: { x: number; y: number }) => void;
}

export const Petals = forwardRef<PetalsHandle>(function Petals(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => ({
    burst(origin) {
      const c = canvas.current;
      if (!c || prefersReducedMotion()) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = (c.width = window.innerWidth * dpr);
      const h = (c.height = window.innerHeight * dpr);
      c.style.width = `${window.innerWidth}px`;
      c.style.height = `${window.innerHeight}px`;
      const ctx = c.getContext("2d")!;
      const ox = (origin?.x ?? window.innerWidth / 2) * dpr;
      const oy = (origin?.y ?? window.innerHeight * 0.35) * dpr;
      const parts = Array.from({ length: 78 }, (_, i) => {
        const petal = i % 3 !== 0;
        return {
          x: ox + (Math.random() - 0.5) * w * 0.5,
          y: oy - Math.random() * h * 0.5,
          vx: (Math.random() - 0.5) * 0.6 * dpr,
          vy: (0.4 + Math.random() * 0.8) * dpr,
          r: (petal ? 5 + Math.random() * 5 : 4 + Math.random() * 6) * dpr,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.12,
          sway: 0.6 + Math.random() * 1.4,
          phase: Math.random() * Math.PI * 2,
          colour: COLOURS[petal ? i % 2 : 2 + (i % 2)],
          petal,
        };
      });
      const start = performance.now();
      const step = (now: number) => {
        const t = (now - start) / 1000;
        ctx.clearRect(0, 0, w, h);
        const fade = t > 2 ? Math.max(0, 1 - (t - 2) / 0.5) : 1;
        for (const p of parts) {
          p.vy += 0.035 * dpr;
          p.x += p.vx + Math.sin(t * p.sway * 3 + p.phase) * 0.7 * dpr;
          p.y += p.vy;
          p.rot += p.vr;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.colour;
          ctx.beginPath();
          if (p.petal) ctx.ellipse(0, 0, p.r * 0.45, p.r, 0, 0, Math.PI * 2);
          else ctx.rect(-p.r / 2, -p.r / 3, p.r, p.r * 0.66);
          ctx.fill();
          ctx.restore();
        }
        if (t < 2.5) requestAnimationFrame(step);
        else ctx.clearRect(0, 0, w, h);
      };
      requestAnimationFrame(step);
    },
  }));
  return <canvas ref={canvas} aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 30 }} />;
});
