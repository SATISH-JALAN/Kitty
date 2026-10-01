"use client";
/**
 * The Seal Director (brief 11.0): one wax seal travels through the whole landing page.
 *
 * Each act renders a <SealDock id size> where the seal rests; docks scroll natively with
 * their content. A flight is a progress value (0–1) the act drives from its own master
 * timeline. While a flight is between 0 and 1, both docks hide and one fixed "flyer"
 * travels a quadratic arc between the docks' live positions (control point 18vh above
 * the midpoint), rotating −10° → +6° and scaling by dock size. Exactly one seal is ever
 * visible. Reduced motion (and no JS): every dock shows its own static seal.
 */
import { createContext, useContext, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { gsap } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { WaxSeal } from "@kitty/ui/brand/WaxSeal";

export type DockId = "D1" | "D1h" | "D2" | "D3" | "D4a" | "D4b" | "D5" | "D6" | "D7" | "D8";
export const DOCK_ORDER: DockId[] = ["D1", "D1h", "D2", "D3", "D4a", "D4b", "D5", "D6", "D7", "D8"];

const FLYER = 96;

class Director {
  docks = new Map<DockId, { el: HTMLElement; size: number }>();
  progress = new Map<string, number>();
  flyer: HTMLElement | null = null;
  enabled = false;
  raf = 0;

  key(from: DockId, to: DockId) {
    return `${from}>${to}`;
  }
  register(id: DockId, el: HTMLElement, size: number) {
    this.docks.set(id, { el, size });
    this.schedule();
  }
  unregister(id: DockId) {
    this.docks.delete(id);
  }
  set(from: DockId, to: DockId, p: number) {
    this.progress.set(this.key(from, to), Math.max(0, Math.min(1, p)));
    this.schedule();
  }
  schedule() {
    if (!this.enabled || this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.update();
    });
  }
  /** Which dock holds the seal, or which flight is carrying it. */
  state(): { holder: DockId } | { flight: [DockId, DockId]; p: number } {
    // The most advanced flight with any progress decides (robust if an act hasn't mounted).
    for (let i = DOCK_ORDER.length - 2; i >= 0; i--) {
      const from = DOCK_ORDER[i];
      const to = DOCK_ORDER[i + 1];
      const p = this.progress.get(this.key(from, to)) ?? 0;
      if (p >= 1) return { holder: to };
      if (p > 0) return { flight: [from, to], p };
    }
    return { holder: DOCK_ORDER[0] };
  }
  update() {
    if (!this.enabled || !this.flyer) return;
    const st = this.state();
    const show = (id: DockId | null) => {
      this.docks.forEach((d, k) => {
        d.el.style.visibility = k === id ? "visible" : "hidden";
      });
    };
    if ("holder" in st) {
      show(st.holder);
      this.flyer.style.visibility = "hidden";
      return;
    }
    show(null);
    const [from, to] = st.flight;
    const a = this.docks.get(from);
    const b = this.docks.get(to);
    if (!a || !b) {
      this.flyer.style.visibility = "hidden";
      return;
    }
    const ra = a.el.getBoundingClientRect();
    const rb = b.el.getBoundingClientRect();
    const ax = ra.left + ra.width / 2;
    const ay = ra.top + ra.height / 2;
    const bx = rb.left + rb.width / 2;
    const by = rb.top + rb.height / 2;
    const t = gsap.parseEase("camera")(st.p);
    const cx = (ax + bx) / 2;
    const cy = Math.min(ay, by) - window.innerHeight * 0.18;
    const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * cx + t * t * bx;
    const y = (1 - t) * (1 - t) * ay + 2 * (1 - t) * t * cy + t * t * by;
    const size = a.size + (b.size - a.size) * t;
    gsap.set(this.flyer, { x, y, xPercent: -50, yPercent: -50, scale: size / FLYER, rotation: -10 + 16 * t, visibility: "visible" });
  }
}

const director = new Director();
const Ctx = createContext(director);
export const useSealDirector = () => useContext(Ctx);

export function SealDirectorProvider({ children }: { children: ReactNode }) {
  const flyer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    director.enabled = true;
    director.flyer = flyer.current;
    director.schedule();
    const onScroll = () => director.schedule();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      director.enabled = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      director.docks.forEach((d) => (d.el.style.visibility = "visible"));
    };
  }, []);
  return (
    <Ctx.Provider value={director}>
      {children}
      <div
        ref={flyer}
        aria-hidden="true"
        style={{ position: "fixed", left: 0, top: 0, zIndex: 35, pointerEvents: "none", visibility: "hidden", willChange: "transform" }}
      >
        <WaxSeal size={FLYER} />
      </div>
    </Ctx.Provider>
  );
}

/** Where the seal rests in an act. Renders its own seal so the page works without JS. */
export function SealDock({ id, size, className, style, cracked, children }: { id: DockId; size: number; className?: string; style?: CSSProperties; cracked?: 0 | 1 | 2 | 3; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const d = useSealDirector();
  useEffect(() => {
    if (!ref.current) return;
    d.register(id, ref.current, size);
    return () => d.unregister(id);
  }, [d, id, size]);
  return (
    <div ref={ref} className={`seal-dock ${className ?? ""}`} data-dock={id} style={{ width: size, height: size, ...style }}>
      <WaxSeal size={size} cracked={cracked} crackable={cracked != null} />
      {children}
    </div>
  );
}

/** Drive a flight from a timeline: `tl.add(flight(director, "D1", "D1h"), at)`. */
export function flightTween(d: Director, from: DockId, to: DockId, duration = 1) {
  const s = { p: 0 };
  return gsap.to(s, { p: 1, duration, ease: "none", onUpdate: () => d.set(from, to, s.p) });
}
