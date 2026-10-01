"use client";
/**
 * Act 0 · Preloader (brief 11, Act 0). First visit per session only; 1.6–6 s; any key or
 * click skips. A twine string draws across the night, then seven lanterns drop, swing and
 * ignite centre-outwards on REAL progress (fonts, hero layers decoded). At 100 the centre
 * lantern swells and a lantern iris opens onto the hero, already rendered underneath.
 * The lanterns are then released and drift up into the sky. Return visits get a 300 ms
 * iris; reduced motion gets none. The overlay is server-rendered but only shown when
 * boot.js flagged html[data-preload], so there's no flash either way.
 */
import { useEffect, useRef, useState } from "react";
import { gsap, swing } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { Wordmark } from "@kitty/ui/brand/Wordmark";
import { Lantern, type LanternHandle } from "@kitty/ui/components/Lantern";
import { LedgerRoll } from "@kitty/ui/components/Ledger";
import { copy } from "@/copy/en";
import { announceReveal } from "@/lib/reveal";

const DESKTOP = { xs: [11, 23, 36, 50, 64, 77, 89], lines: [32, 56, 24, 72, 40, 60, 28], y0: 20, sag: 9 };
const MOBILE = { xs: [14, 32, 50, 68, 86], lines: [28, 44, 56, 40, 24], y0: 24, sag: 7 };
/** Ignite order: centre outwards (4, 3, 5, 2, 6, 1, 7). */
const ORDER_7 = [3, 2, 4, 1, 5, 0, 6];
const ORDER_5 = [2, 1, 3, 0, 4];

function stringY(x: number, y0: number, sag: number) {
  const t = (x + 2) / 104;
  return y0 + 4 * sag * t * (1 - t);
}

export function Act0Preloader() {
  const root = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const string = useRef<SVGPathElement>(null);
  const lanterns = useRef<(LanternHandle | null)[]>([]);
  const hangers = useRef<(HTMLSpanElement | null)[]>([]);
  const [pct, setPct] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const mode = html.dataset.preload;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    setMobile(isMobile);
    if (!mode || prefersReducedMotion()) {
      setGone(true);
      announceReveal();
      return;
    }
    const el = root.current!;
    const v = veil.current!;
    const setHole = (x: number, y: number, r: number) => {
      const m = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, #000 ${r + 1}px)`;
      v.style.maskImage = m;
      v.style.webkitMaskImage = m;
    };
    const finish = () => {
      try {
        sessionStorage.setItem("kitty:preloaded", "1");
      } catch {
        /* private mode: the preloader simply shows again */
      }
      delete html.dataset.preload;
      setGone(true);
    };

    if (mode === "return") {
      const s = { r: 0 };
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      announceReveal();
      gsap.to(s, { r: Math.hypot(cx, cy) * 1.1, duration: 0.3, ease: "ink", onUpdate: () => setHole(cx, cy, s.r), onComplete: finish });
      return;
    }

    // --- First visit ---
    const cfg = isMobile ? MOBILE : DESKTOP;
    const order = isMobile ? ORDER_5 : ORDER_7;
    const centre = order[0];
    const start = performance.now();
    let progress = 0;
    let lit = 0;
    let done = false;

    // The string draws in left to right (a clip: DrawSVG can't measure a non-scaling stroke).
    gsap.fromTo(string.current?.ownerSVGElement ?? null, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.6, ease: "ink" });
    hangers.current.forEach((h) => h && gsap.set(h, { y: -40, autoAlpha: 0 }));

    const light = (k: number) => {
      const i = order[k];
      const hanger = hangers.current[i];
      const glow = lanterns.current[i]?.glow;
      if (!hanger) return;
      gsap.to(hanger, { y: 0, autoAlpha: 1, duration: 0.5, ease: "paper", delay: 0.6 });
      gsap.delayedCall(0.8, () => {
        gsap.set(hanger, { transformOrigin: "50% 0%" });
        swing(hanger, 6, 1.6, { fromAmp: true });
      });
      if (glow) gsap.fromTo(glow, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "lantern", delay: 1.0 });
    };
    const report = (p: number) => {
      progress = Math.max(progress, p);
      setPct(Math.round(progress * 100));
      const target = Math.floor(progress * order.length + 1e-6);
      while (lit < Math.min(target, order.length)) light(lit++);
      if (progress >= 1) end();
    };

    const end = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, 1600 - (performance.now() - start));
      gsap.delayedCall(wait / 1000 + 0.2 + 0.9, open);
      while (lit < order.length) light(lit++);
    };

    const open = () => {
      const centreEl = lanterns.current[centre]?.root;
      const glow = lanterns.current[centre]?.glow;
      const r = centreEl?.getBoundingClientRect();
      const cx = r ? r.left + r.width / 2 : window.innerWidth / 2;
      const cy = r ? r.top + r.height / 2 : window.innerHeight / 3;
      const tl = gsap.timeline({ onComplete: finish });
      if (glow) tl.to(glow, { scale: 1.6, duration: 0.3, ease: "lantern" }, 0);
      const s = { r: 0 };
      tl.add(() => announceReveal(), 0.2);
      tl.to(s, { r: Math.hypot(window.innerWidth, window.innerHeight) * 1.05, duration: 0.9, ease: "ink", onUpdate: () => setHole(cx, cy, s.r) }, 0.2);
      // Release the lanterns: they drift up into the sky as the party begins.
      hangers.current.forEach((h, i) => {
        if (!h) return;
        tl.to(h, { y: -window.innerHeight * (0.35 + (i % 3) * 0.1), x: (i - 3) * 6, autoAlpha: 0, duration: 1.8 + (i % 2) * 0.4, ease: "lantern" }, 0.5 + Math.abs(i - centre) * 0.08);
      });
      tl.to(string.current, { autoAlpha: 0, duration: 0.6 }, 0.6);
      tl.to(el.querySelectorAll(".pl-chrome"), { autoAlpha: 0, duration: 0.3 }, 0.2);
    };

    // Real progress: fonts 20%, hero layers decoded 80% (H-2…H-5).
    let fontsDone = 0;
    let imgsDone = 0;
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img[data-preload]"));
    const total = Math.max(1, imgs.length);
    const recompute = () => report(fontsDone * 0.2 + (imgsDone / total) * 0.8);
    document.fonts?.ready.then(() => {
      fontsDone = 1;
      recompute();
    });
    if (!imgs.length) {
      imgsDone = 1;
      recompute();
    }
    imgs.forEach((img) => {
      img.loading = "eager";
      img
        .decode()
        .catch(() => undefined)
        .then(() => {
          imgsDone++;
          recompute();
        });
    });
    const max = setTimeout(() => report(1), 6000);
    const skip = () => report(1);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("pointerdown", skip, { once: true });
    return () => {
      clearTimeout(max);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, []);

  if (gone) return null;
  const cfg = mobile ? MOBILE : DESKTOP;
  return (
    <div ref={root} className="preloader" data-world="night" aria-hidden="true">
      <div ref={veil} className="pl-veil" />
      <svg className="pl-string" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          ref={string}
          d={`M-2,${cfg.y0} Q50,${cfg.y0 + 2 * cfg.sag} 102,${cfg.y0}`}
          fill="none"
          stroke="var(--twine)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {cfg.xs.map((x, i) => {
        const isCentre = i === (mobile ? 2 : 3);
        const w = mobile ? (isCentre ? 52 : 28) : isCentre ? 72 : 40;
        return (
          <span
            key={x}
            ref={(n) => {
              hangers.current[i] = n;
            }}
            className="pl-hanger"
            style={{ left: `${x}vw`, top: `${stringY(x, cfg.y0, cfg.sag)}svh` }}
          >
            <span style={{ display: "block", width: 1, height: cfg.lines[i], background: "var(--twine)", margin: "0 auto" }} />
            <Lantern
              ref={(h) => {
                lanterns.current[i] = h;
              }}
              width={w}
              lit={0}
              flicker
            />
          </span>
        );
      })}
      <div className="pl-chrome pl-wordmark">
        <Wordmark height={24} ink="var(--moon)" />
      </div>
      <div className="pl-chrome pl-counter type-mono" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        {copy.preloader.counter} · <LedgerRoll value={String(pct).padStart(3, "0")} />
      </div>
    </div>
  );
}
