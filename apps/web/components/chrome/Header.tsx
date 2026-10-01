"use client";
/**
 * Landing header (brief 10.1). Desktop 72 px on a 12-column grid: lockup (1–3), nav
 * (5–8) with the active item marked by a bead on twine, Devnet tag + Guest Pass (10–12).
 * Mobile 60 px: wordmark + menu → a Night sheet that drops like a curtain.
 *
 * Transparent over the hero; paper/night at 92% + hairline after 120 px; hides on
 * scroll-down past 240 px and returns on any 8 px scroll-up. When the world under its
 * bottom line changes, a duplicate layer cross-wipes in (clip-path, 320 ms ink).
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { lineInSlot } from "@kitty/ui/motion/primitives/text";
import { useLenis, scrollToTarget } from "@kitty/ui/motion/MotionProvider";
import { Lockup, Wordmark } from "@kitty/ui/brand/Wordmark";
import { Button } from "@kitty/ui/components/Button";
import { IconButton } from "@kitty/ui/components/IconButton";
import { Lantern } from "@kitty/ui/components/Lantern";
import { Tag } from "@kitty/ui/components/Tag";
import { TwineRail } from "@kitty/ui/components/TwineRail";
import { copy } from "@/copy/en";

type World = "paper" | "night";

const NAV = [
  { id: "how", label: copy.nav.howItWorks, target: "#act-4" },
  { id: "diary", label: copy.nav.diary, target: "#act-6" },
  { id: "house", label: copy.nav.house, target: "#act-7" },
] as const;

function Bar({ world, active, onNav, onMenu, inert }: { world: World; active: number | null; onNav: (t: string) => void; onMenu: () => void; inert?: boolean }) {
  return (
    <div
      data-world={world}
      className="header-bar"
      aria-hidden={inert || undefined}
      {...(inert ? { inert: true } : {})}
      style={{ position: "absolute", inset: 0, color: "var(--fg)" }}
    >
      <div className="header-bg" style={{ position: "absolute", inset: 0 }} />
      <div className="grid-page" style={{ position: "relative", height: "100%", alignItems: "center" }}>
        <Link href="/" className="header-logo" aria-label="Kitty — savings parties, home" data-focus-ring="" style={{ gridColumn: "1 / span 3", display: "inline-flex", alignItems: "center", width: "max-content" }}>
          <span className="hidden lg:inline-flex">
            <Lockup height={28} interactive />
          </span>
          <span className="lg:hidden inline-flex">
            <Wordmark height={26} interactive />
          </span>
        </Link>
        <nav aria-label="Sections" className="hidden lg:flex" style={{ gridColumn: "5 / span 4", justifySelf: "center", flexDirection: "column", alignItems: "stretch" }}>
          <ul style={{ display: "flex", gap: 36, listStyle: "none", margin: 0, padding: 0 }}>
            {NAV.map((n, i) => (
              <li key={n.id}>
                <a
                  href={n.target}
                  onClick={(e) => {
                    e.preventDefault();
                    onNav(n.target);
                  }}
                  aria-current={active === i ? "true" : undefined}
                  className="type-label"
                  data-focus-ring=""
                  style={{ display: "inline-flex", alignItems: "center", height: 44, color: "var(--fg)" }}
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <TwineRail count={3} active={active} sag={6} height={14} onlyActive style={{ marginTop: -6 }} />
        </nav>
        <div className="hidden lg:flex" style={{ gridColumn: "10 / span 3", justifySelf: "end", alignItems: "center", gap: 16 }}>
          <Tag variant="devnet">Devnet</Tag>
          <Button href="/pass" size="M">
            {copy.cta.pass}
          </Button>
        </div>
        <div className="lg:hidden" style={{ gridColumn: "-2 / -1", justifySelf: "end" }}>
          <IconButton icon="menu" label={copy.nav.menu} onClick={onMenu} tooltip={false} />
        </div>
      </div>
    </div>
  );
}

function MobileMenu({ open, onClose, onNav }: { open: boolean; onClose: () => void; onNav: (t: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = root.current;
    if (open) setShown(true);
    if (!el) return;
    const reduce = prefersReducedMotion();
    if (open) {
      gsap.fromTo(el, { yPercent: -100 }, { yPercent: 0, duration: reduce ? 0 : 0.48, ease: "fold" });
      el.querySelectorAll<HTMLElement>(".menu-link").forEach((l, i) => lineInSlot(l, { delay: 0.25 + i * 0.07 }));
      el.querySelector<HTMLElement>("button")?.focus();
    } else if (shown) {
      gsap.to(el, { yPercent: -100, duration: reduce ? 0 : 0.38, ease: "fold", onComplete: () => setShown(false) });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!shown && !open) return null;
  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={copy.nav.menu}
      data-world="night"
      className="paper-fibre"
      style={{ position: "fixed", inset: 0, zIndex: "var(--z-sheet)" as unknown as number, background: "var(--night)", display: "flex", flexDirection: "column", padding: "0 var(--margin) calc(24px + env(safe-area-inset-bottom))" }}
    >
      <div style={{ position: "relative", height: 96 }} aria-hidden="true">
        <svg width="100%" height="40" preserveAspectRatio="none" viewBox="0 0 100 40" style={{ position: "absolute", left: 0, top: 18 }}>
          <path d="M-2,4 Q50,22 102,4" fill="none" stroke="var(--twine)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
        </svg>
        {[14, 32, 50, 68, 86].map((x, i) => (
          <span key={x} style={{ position: "absolute", left: `${x}%`, top: 20 + Math.sin((x / 100) * Math.PI) * 8, translate: "-50% 0" }}>
            <span style={{ display: "block", width: 1, height: [18, 30, 14, 26, 20][i], background: "var(--twine)", margin: "0 auto" }} />
            <Lantern width={i === 2 ? 30 : 22} flicker />
          </span>
        ))}
      </div>
      <div style={{ position: "absolute", right: "calc(var(--margin) - 12px)", top: 8 }}>
        <IconButton icon="close" label={copy.nav.close} onClick={onClose} tooltip={false} />
      </div>
      <nav aria-label="Sections" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
        {NAV.map((n) => (
          <a
            key={n.id}
            href={n.target}
            className="menu-link type-display-l"
            data-focus-ring=""
            onClick={(e) => {
              e.preventDefault();
              onClose();
              setTimeout(() => onNav(n.target), 360);
            }}
          >
            {n.label}
          </a>
        ))}
      </nav>
      <Button href="/pass" size="L" block>
        {copy.cta.pass}
      </Button>
    </div>
  );
}

export function Header({ initialWorld = "night" }: { initialWorld?: World }) {
  const root = useRef<HTMLElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [world, setWorld] = useState<World>(initialWorld);
  const [next, setNext] = useState<World>(initialWorld);
  const [active, setActive] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const lenis = useLenis();
  const worldRef = useRef(world);

  const onNav = (target: string) => scrollToTarget(lenis, target, 1.6);

  // Solid background after 120 px; hide on scroll-down past 240 px; show on 8 px up.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let lastY = window.scrollY;
    let hidden = false;
    let upAcc = 0;
    const onScroll = () => {
      const y = window.scrollY;
      el.dataset.solid = y > 120 ? "true" : "false";
      const dy = y - lastY;
      lastY = y;
      if (dy > 0) {
        upAcc = 0;
        if (y > 240 && !hidden) {
          hidden = true;
          gsap.to(el, { yPercent: -100, duration: prefersReducedMotion() ? 0 : 0.32, ease: "paper", overwrite: true });
        }
      } else if (dy < 0) {
        upAcc += -dy;
        if (hidden && upAcc >= 8) {
          hidden = false;
          gsap.to(el, { yPercent: 0, duration: prefersReducedMotion() ? 0 : 0.32, ease: "paper", overwrite: true });
        }
      }
      // Read by CSS: the floating Devnet tag steps aside while the header (with its own tag) shows.
      el.dataset.hidden = hidden ? "true" : "false";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // World switch: a trigger per [data-world] section at the header's bottom line.
  // Created one frame after mount, once the acts have pinned: before that, Act 2 (pulled up
  // under the hero) sits at the top of the page and would switch the header to Paper.
  // The world is always read from the live layout (the section under the header line), so a
  // refresh can never leave a stale world behind.
  useGSAP(() => {
    const LINE = 72;
    const apply = (w: World) => {
      document.documentElement.dataset.pageWorld = w;
      if (w !== worldRef.current) {
        worldRef.current = w;
        setNext(w);
      }
    };
    let sections: HTMLElement[] = [];
    const sync = () => {
      let w: World | null = null;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top <= LINE && r.bottom > LINE) w = (s.dataset.sectionWorld as World) ?? "paper";
      }
      if (w) apply(w);
    };
    let triggers: ScrollTrigger[] = [];
    let navTriggers: (ScrollTrigger | null)[] = [];
    document.documentElement.dataset.pageWorld = initialWorld;
    const raf = requestAnimationFrame(() => {
      sections = Array.from(document.querySelectorAll<HTMLElement>("main [data-section-world]"));
      triggers = sections.map((s) => ScrollTrigger.create({ trigger: s, start: `top ${LINE}px`, end: `bottom ${LINE}px`, refreshPriority: -10, onToggle: sync }));
      navTriggers = NAV.map((n, i) => {
        const el = document.querySelector(n.target);
        return el
          ? ScrollTrigger.create({ trigger: el, start: "top 50%", end: "bottom 50%", refreshPriority: -10, onToggle: (self) => setActive((a) => (self.isActive ? i : a === i ? null : a)) })
          : null;
      });
      ScrollTrigger.addEventListener("refresh", sync);
      sync();
    });
    // Acts can flip the world mid-scene (Act 3's torn backdrop): kitty:world { detail: "night" | "paper" }.
    const onWorld = (e: Event) => apply((e as CustomEvent<World>).detail);
    window.addEventListener("kitty:world", onWorld);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("kitty:world", onWorld);
      ScrollTrigger.removeEventListener("refresh", sync);
      triggers.forEach((t) => t.kill());
      navTriggers.forEach((t) => t?.kill());
    };
  }, []);

  // The cross-wipe: the overlay (next world) wipes down over the base, then becomes the base.
  const wipe = useRef<gsap.core.Tween | null>(null);
  useEffect(() => {
    const el = overlay.current;
    wipe.current?.kill();
    if (!el) return;
    if (next === world) {
      gsap.set(el, { clipPath: "inset(0 0 100% 0)" });
      return;
    }
    if (prefersReducedMotion()) {
      setWorld(next);
      return;
    }
    // The wipe always lands on the latest world (a stale tween must never overwrite it).
    wipe.current = gsap.fromTo(el, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.32, ease: "ink", onComplete: () => setWorld(worldRef.current) });
  }, [next, world]);

  return (
    <>
      <header ref={root} className="site-header" data-solid="false" data-hidden="false" style={{ position: "fixed", insetInline: 0, top: 0, zIndex: "var(--z-header)" as unknown as number }}>
        <Bar world={world} active={active} onNav={onNav} onMenu={() => setMenu(true)} />
        <div ref={overlay} style={{ position: "absolute", inset: 0, clipPath: "inset(0 0 100% 0)", pointerEvents: "none" }}>
          {next !== world && <Bar world={next} active={active} onNav={onNav} onMenu={() => {}} inert />}
        </div>
      </header>
      <MobileMenu open={menu} onClose={() => setMenu(false)} onNav={onNav} />
    </>
  );
}
