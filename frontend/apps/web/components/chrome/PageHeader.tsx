"use client";
/**
 * App page header (brief 12.2) + the screen-enter motion (12.4): the title lines in from
 * its slot, then content blocks marked `data-enter` slide out from behind the header's
 * bottom edge (yPercent −8 → 0 in a clip, 420 ms paper), 60 ms apart in reading order.
 * Total ≤ 700 ms. Nothing idles.
 */
import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";

export function PageHeader({ title, context, actions, eyebrow }: { title: ReactNode; context?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const root = ref.current!;
      gsap.fromTo(root.querySelectorAll(".ph-title"), { yPercent: 105, rotate: 1.5 }, { yPercent: 0, rotate: 0, duration: 0.5, ease: "paper" });
      const subs = root.querySelectorAll(".ph-sub");
      if (subs.length) gsap.fromTo(subs, { yPercent: 105 }, { yPercent: 0, duration: 0.45, ease: "paper", delay: 0.06 });
      const main = root.closest("main");
      const blocks = main ? Array.from(main.querySelectorAll<HTMLElement>("[data-enter]")).slice(0, 6) : [];
      if (blocks.length) gsap.fromTo(blocks, { yPercent: -8, clipPath: "inset(0 0 100% 0)" }, { yPercent: 0, clipPath: "inset(0 0 0% 0)", duration: 0.42, ease: "paper", stagger: 0.06, delay: 0.12, clearProps: "clipPath,transform" });
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className="page-header">
      <div className="page-header-text">
        {eyebrow && (
          <div style={{ overflow: "clip" }}>
            <div className="ph-sub type-label" style={{ color: "var(--fg-soft)", marginBottom: 8 }}>
              {eyebrow}
            </div>
          </div>
        )}
        <div style={{ overflow: "clip", paddingBottom: "0.08em" }}>
          <h1 className="ph-title type-h1">{title}</h1>
        </div>
        {context && (
          <div style={{ overflow: "clip" }}>
            <p className="ph-sub type-small" style={{ color: "var(--fg-soft)", marginTop: 8 }}>
              {context}
            </p>
          </div>
        )}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}
