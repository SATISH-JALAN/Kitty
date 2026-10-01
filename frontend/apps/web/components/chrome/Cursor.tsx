"use client";
/**
 * Lantern cursor + aperture (brief 10.3, primitive 21). Desktop fine pointers only.
 * A dot (ink on paper, moon on night) and a 28 px ring that lags (350 ms paper).
 *   link/button → dot hidden, ring 44 stitched
 *   [data-cursor="media"] → aperture 140 px, "Look closer"; the element receives
 *     --ax/--ay (px) so it can show its next depth layer through a clip-path circle
 *   [data-cursor="drag"] → ring 64, "Drag"
 *   text input → a 2×18 caret, ring hidden
 *   disabled → dot at 40%, dashed ring
 * The native cursor hides only once this mounts; touch and reduced motion keep it.
 * All pointer work runs in one gsap.ticker callback.
 */
import { useEffect, useRef } from "react";
import { gsap } from "@kitty/ui/motion/gsap";
import { MQ, prefersReducedMotion } from "@kitty/ui/motion/reduced";

type Mode = "default" | "link" | "media" | "drag" | "text" | "disabled";

export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !window.matchMedia(MQ.fine).matches) return;
    const d = dot.current!;
    const r = ring.current!;
    const l = label.current!;
    const html = document.documentElement;
    html.dataset.cursor = "on";
    d.style.display = r.style.display = "block";

    const dx = gsap.quickSetter(d, "x", "px");
    const dy = gsap.quickSetter(d, "y", "px");
    const rx = gsap.quickTo(r, "x", { duration: 0.35, ease: "paper" });
    const ry = gsap.quickTo(r, "y", { duration: 0.35, ease: "paper" });
    const pos = { x: -100, y: -100, dirty: false };
    let mode: Mode = "default";
    let media: HTMLElement | null = null;
    let world = "paper";

    const setMode = (m: Mode, text = "") => {
      if (m === mode) return;
      mode = m;
      const size = m === "link" ? 44 : m === "media" ? 140 : m === "drag" ? 64 : 28;
      gsap.to(r, { width: size, height: size, duration: 0.3, ease: "paper", overwrite: "auto" });
      r.dataset.mode = m;
      d.dataset.mode = m;
      l.textContent = text;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pos.x = e.clientX;
      pos.y = e.clientY;
      pos.dirty = true;
      const t = e.target as Element | null;
      if (!t?.closest) return;
      const w = (t.closest("[data-world]") as HTMLElement | null)?.dataset.world ?? "paper";
      if (w !== world) {
        world = w;
        d.dataset.world = r.dataset.world = w;
      }
      const m = t.closest<HTMLElement>("[data-cursor]");
      const cm = m?.dataset.cursor;
      if (media && media !== m) media.removeAttribute("data-aperture");
      media = cm === "media" ? m : null;
      if (media) media.setAttribute("data-aperture", "on");
      if (t.closest("input:not([type=file]):not([type=range]), textarea, [contenteditable]")) setMode("text");
      else if (t.closest("[aria-disabled=true], :disabled")) setMode("disabled");
      else if (cm === "media") setMode("media", "Look closer");
      else if (cm === "drag") setMode("drag", "Drag");
      else if (t.closest("a, button, [role=button], [role=radio], [role=switch], label, summary")) setMode("link");
      else setMode("default");
    };
    const tick = () => {
      if (!pos.dirty) return;
      pos.dirty = false;
      dx(pos.x);
      dy(pos.y);
      rx(pos.x);
      ry(pos.y);
      if (media) {
        const b = media.getBoundingClientRect();
        media.style.setProperty("--ax", `${pos.x - b.left}px`);
        media.style.setProperty("--ay", `${pos.y - b.top}px`);
      }
    };
    const leave = () => {
      d.style.opacity = r.style.opacity = "0";
      delete html.dataset.cursor;
    };
    const enter = () => {
      d.style.opacity = r.style.opacity = "1";
      html.dataset.cursor = "on";
    };
    const touch = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") leave();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", touch, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    document.documentElement.addEventListener("pointerenter", enter);
    gsap.ticker.add(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", touch);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.documentElement.removeEventListener("pointerenter", enter);
      gsap.ticker.remove(tick);
      delete html.dataset.cursor;
    };
  }, []);

  return (
    <>
      <div ref={ring} className="k-cursor-ring" aria-hidden="true" data-mode="default" data-world="paper">
        <span ref={label} className="k-cursor-label type-mono" />
      </div>
      <div ref={dot} className="k-cursor-dot" aria-hidden="true" data-mode="default" data-world="paper" />
    </>
  );
}
