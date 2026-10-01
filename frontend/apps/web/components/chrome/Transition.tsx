"use client";
/**
 * Route transitions for the app (brief 10.4). Internal link clicks close a paper curtain
 * (primitive 3: two 50vw panels with torn inner edges, 380 ms fold), navigate, wait for
 * the new route (or 800 ms), then part (380 ms paper). Links into ceremonies hand off to
 * a lantern iris from the clicked point instead. Never blocks navigation > 900 ms.
 */
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { gsap } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { TornEdgeSvg } from "@kitty/ui/paper/TornEdgeSvg";

const CEREMONY = /^\/(pass|invite\/|p\/[^/]+\/draw)/;
export const IRIS_KEY = "kitty:iris";

const Ctx = createContext<{ go: (href: string) => void }>({ go: () => {} });
export const useTransitionNav = () => useContext(Ctx);

export function TransitionProvider({ children, world = "paper" }: { children: ReactNode; world?: "paper" | "night" }) {
  const router = useRouter();
  const pathname = usePathname();
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const pending = useRef<{ resolve: () => void } | null>(null);
  const busy = useRef(false);

  const close = () =>
    new Promise<void>((res) => {
      gsap.set([left.current, right.current], { display: "block" });
      gsap.fromTo(left.current, { xPercent: -100 }, { xPercent: 0, duration: 0.38, ease: "fold" });
      gsap.fromTo(right.current, { xPercent: 100 }, { xPercent: 0, duration: 0.38, ease: "fold", onComplete: () => res() });
    });
  const open = () => {
    gsap.to(left.current, { xPercent: -100, duration: 0.38, ease: "paper", delay: 0.06 });
    gsap.to(right.current, {
      xPercent: 100,
      duration: 0.38,
      ease: "paper",
      delay: 0.06,
      onComplete: () => {
        gsap.set([left.current, right.current], { display: "none" });
        busy.current = false;
      },
    });
  };

  const go = async (href: string, from?: { x: number; y: number }) => {
    if (busy.current) return;
    const target = new URL(href, window.location.href);
    if (target.pathname === window.location.pathname) {
      router.push(href);
      return;
    }
    if (prefersReducedMotion()) {
      router.push(href);
      return;
    }
    if (CEREMONY.test(target.pathname)) {
      try {
        sessionStorage.setItem(IRIS_KEY, JSON.stringify(from ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 }));
      } catch {
        /* the ceremony opens without the iris */
      }
      router.push(href);
      return;
    }
    busy.current = true;
    await close();
    const arrived = new Promise<void>((resolve) => (pending.current = { resolve }));
    router.push(href);
    await Promise.race([arrived, new Promise((r) => setTimeout(r, 800))]);
    open();
  };

  // The new route has rendered.
  useEffect(() => {
    pending.current?.resolve();
    pending.current = null;
  }, [pathname]);

  // Intercept internal link clicks.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.dataset.noTransition != null) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || /^https?:/.test(href)) return;
      e.preventDefault();
      go(href, { x: e.clientX, y: e.clientY });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const panel = (side: "l" | "r") => (
    <div
      ref={side === "l" ? left : right}
      aria-hidden="true"
      data-world={world}
      style={{
        display: "none",
        position: "fixed",
        top: 0,
        bottom: 0,
        [side === "l" ? "left" : "right"]: 0,
        width: "50.5vw",
        zIndex: "var(--z-curtain)" as unknown as number,
        background: world === "night" ? "var(--night-raised)" : "var(--paper-deep)",
        boxShadow: "var(--d4)",
      }}
    >
      <div style={{ position: "absolute", top: 0, bottom: 0, [side === "l" ? "right" : "left"]: -9, width: 18 }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", width: "100vh", height: 18, translate: "-50% -50%", rotate: side === "l" ? "90deg" : "-90deg" }}>
          <TornEdgeSvg depth={18} seed={side === "l" ? 11 : 12} width={1600} fill={world === "night" ? "var(--night-raised)" : "var(--paper-deep)"} />
        </div>
      </div>
    </div>
  );

  return (
    <Ctx.Provider value={{ go: (href) => go(href) }}>
      {children}
      {panel("l")}
      {panel("r")}
    </Ctx.Provider>
  );
}

/** Ceremony pages call this on mount: open with a lantern iris from where the user clicked. */
export function useIrisEntry(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    let from: { x: number; y: number } | null = null;
    try {
      const raw = sessionStorage.getItem(IRIS_KEY);
      if (raw) from = JSON.parse(raw);
      sessionStorage.removeItem(IRIS_KEY);
    } catch {
      /* no iris */
    }
    const el = ref.current;
    if (!el || !from || prefersReducedMotion()) return;
    const r = Math.hypot(Math.max(from.x, window.innerWidth - from.x), Math.max(from.y, window.innerHeight - from.y));
    gsap.fromTo(el, { clipPath: `circle(0px at ${from.x}px ${from.y}px)` }, { clipPath: `circle(${r}px at ${from.x}px ${from.y}px)`, duration: 0.9, ease: "ink", clearProps: "clipPath" });
  }, [ref]);
}
