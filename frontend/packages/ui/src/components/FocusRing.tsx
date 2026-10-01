"use client";
/**
 * Stitched focus ring (primitive 20): on :focus-visible a dashed rect, outset 4 px,
 * draws round over 280 ms in --focus. One global element follows focus; the CSS
 * dashed outline stays as the no-JS fallback.
 */
import { useEffect, useRef } from "react";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";

export function FocusRing() {
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    document.documentElement.setAttribute("data-focus-ring", "on");
    const rects = Array.from(el.querySelectorAll<SVGRectElement>(".fr-ring, .fr-draw"));
    let target: HTMLElement | null = null;
    let raf = 0;

    const place = () => {
      if (!target) return;
      const r = target.getBoundingClientRect();
      const pad = 4;
      const w = r.width + pad * 2;
      const h = r.height + pad * 2;
      el.style.left = `${r.left - pad}px`;
      el.style.top = `${r.top - pad}px`;
      el.setAttribute("width", String(w));
      el.setAttribute("height", String(h));
      const radius = parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      for (const rect of rects) {
        rect.setAttribute("width", String(w - 1));
        rect.setAttribute("height", String(h - 1));
        rect.setAttribute("rx", String(Math.min(radius + 3, h / 2)));
      }
    };
    const loop = () => {
      place();
      raf = requestAnimationFrame(loop);
    };
    const onIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (!t.matches?.(":focus-visible") || t.hasAttribute("data-no-ring")) return;
      target = t;
      el.style.color = getComputedStyle(t).getPropertyValue("--focus") || "";
      el.style.display = "block";
      place();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      // Dashes are drawn by growing a mask stroke, so the ring itself keeps its 4/3 stitch.
      const m = el.querySelector(".fr-draw") as SVGRectElement;
      if (prefersReducedMotion()) gsap.set(m, { drawSVG: "0% 100%" });
      else gsap.fromTo(m, { drawSVG: "0% 0%" }, { drawSVG: "0% 100%", duration: 0.28, ease: "ink", overwrite: true });
    };
    const onOut = () => {
      target = null;
      cancelAnimationFrame(raf);
      el.style.display = "none";
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
      cancelAnimationFrame(raf);
      document.documentElement.removeAttribute("data-focus-ring");
    };
  }, []);

  return (
    <svg ref={svg} className="focus-ring" aria-hidden="true" style={{ display: "none" }}>
      <defs>
        <mask id="fr-mask">
          <rect className="fr-draw" x=".5" y=".5" fill="none" stroke="#fff" strokeWidth="4" />
        </mask>
      </defs>
      <rect className="fr-ring" x=".5" y=".5" fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="4 3" mask="url(#fr-mask)" />
    </svg>
  );
}
