"use client";
/**
 * Act 2 · Everyone already throws this party (brief 11, Act 2). Paper. A horizontal track
 * of seven traditions: each arch window opens between the words as it arrives (word
 * insertion), its image counter-scales, the caption lines in, and the page's pattern
 * wipes diagonally to that tradition. The words gather on a turning cylinder, which
 * folds into the stat line. The seal rides the string above as a bead (D2).
 * It starts exactly where Act 1 lands: the intro unit already in place.
 */
import { useRef, useState } from "react";
import { TRADITIONS } from "@kitty/sdk";
import { gsap, ScrollTrigger, useGSAP } from "@kitty/ui/motion/gsap";
import { MQ, prefersReducedMotion, useReducedMotion } from "@kitty/ui/motion/reduced";
import { LedgerRoll } from "@kitty/ui/components/Ledger";
import { Mask } from "@kitty/ui/generators/mask";
import { patternCss } from "@kitty/ui/generators/patterns";
import { Art } from "@/components/Art";
import { SealDock, useSealDirector } from "@/components/chrome/SealDirector";
import { copy } from "@/copy/en";

const V = ["V-1", "V-2", "V-3", "V-4", "V-5", "V-6", "V-7"] as const;

function ArchWindow({ i }: { i: number }) {
  return (
    <div className="a2-window" data-cursor="media">
      <div className="a2-window-clip">
        <div className="a2-window-img">
          <Art id={V[i]} sizes="(min-width:1024px) 22vw, 70vw" world="paper" tradition={TRADITIONS[i].key} />
        </div>
      </div>
      <svg className="a2-window-rule" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
        <path d="M2,138 L2,50 A48 48 0 0 1 98,50 L98,138 Z" fill="none" stroke="var(--gold)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d="M5,135 L5,50 A45 45 0 0 1 95,50 L95,135 Z" fill="none" stroke="var(--gold)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

/** Papel-picado bunting ticker (primitive 31). */
function Bunting() {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion()) return;
      const row = el.querySelector<HTMLElement>(".bt-row")!;
      const half = row.scrollWidth / 2;
      let x = 0;
      let dir = -1;
      const flags = Array.from(el.querySelectorAll<HTMLElement>(".bt-flag"));
      const tick = (_t: number, dt: number) => {
        const v = (ScrollTrigger.getAll()[0]?.getVelocity() ?? 0);
        if (Math.abs(v) > 40) dir = v > 0 ? -1 : 1;
        const speed = 40 + Math.min(600, Math.abs(v) * 0.15);
        x += (dir * speed * dt) / 1000;
        if (x < -half) x += half;
        if (x > 0) x -= half;
        gsap.set(row, { x });
        const t = performance.now() / 1000;
        flags.forEach((f, i) => gsap.set(f, { rotation: Math.sin(t * 1.4 + i * 0.6) * 2 }));
      };
      let on = false;
      const io = new IntersectionObserver(([e]) => {
        if (e?.isIntersecting && !on) {
          gsap.ticker.add(tick);
          on = true;
        } else if (!e?.isIntersecting && on) {
          gsap.ticker.remove(tick);
          on = false;
        }
      });
      io.observe(el);
      return () => {
        io.disconnect();
        gsap.ticker.remove(tick);
      };
    },
    { scope: ref },
  );
  const items = [...TRADITIONS, ...TRADITIONS];
  return (
    <div ref={ref} className="bunting" aria-hidden="true">
      <svg className="bt-string" viewBox="0 0 100 10" preserveAspectRatio="none">
        <path d="M0,2 Q50,6 100,2" fill="none" stroke="var(--twine)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="bt-row">
        {[...items, ...items].map((t, i) => (
          <div key={i} className="bt-flag" style={{ background: ["var(--saffron)", "var(--marigold)", "var(--plum)", "var(--teal-night)", "#C75B7A", "var(--marigold)", "var(--plum)"][i % 7] }}>
            <span className="bt-cut" style={{ backgroundImage: patternCss(t.key, "#F3EADB", "#F3EADB", 0.7) }} />
            {i % 2 === 0 ? <span className="type-word bt-word">{t.word}</span> : <Mask colour={(i * 5) % 16} animal={i % 12} width={48} tradition={t.key} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reduced motion, and (inside <noscript>) no JS: the seven traditions as a plain grid. */
function Act2StaticBody() {
  return (
    <div className="grid-page" style={{ paddingBlock: "clamp(96px, 12vw, 192px)", rowGap: 64 }}>
      <p className="type-display-l" style={{ gridColumn: "1 / -1" }}>
        {copy.act2.intro[0]} {copy.act2.intro[1]}
      </p>
      {TRADITIONS.map((t, i) => (
        <div key={t.key} style={{ gridColumn: "span 4", display: "flex", flexDirection: "column", gap: 12 }}>
          <ArchWindow i={i} />
          <span className="type-word" style={{ fontSize: 56 }}>
            {t.word}
          </span>
          <span className="type-mono">{t.place}</span>
        </div>
      ))}
      <div style={{ gridColumn: "1 / -1" }}>
        <p className="type-display-l">{copy.act2.stat}</p>
        <p className="type-h2" style={{ marginTop: 16 }}>
          {copy.act2.flows}
          <sup>
            <a href="#fn-3">3</a>
          </sup>
        </p>
        <p className="type-mono" style={{ fontSize: 12, marginTop: 8 }}>
          ³ {copy.act2.footnote}
        </p>
      </div>
    </div>
  );
}

function Act2Static() {
  return (
    <section id="act-2" data-section-world="paper" data-world="paper" className="act2-static">
      <Act2StaticBody />
    </section>
  );
}

export function Act2Traditions() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const director = useSealDirector();
  const [current, setCurrent] = useState(-1);
  const [rolled, setRolled] = useState(false);
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(section);
      const tr = track.current!;
      const mobile = window.matchMedia(MQ.mobile).matches;
      const dist = () => tr.scrollWidth - window.innerWidth;
      const vh = () => window.innerHeight;

      // Hide Act 1's frame once we're underneath it (it lands on exactly this frame).
      const act1 = document.querySelector<HTMLElement>("#act-1");

      gsap.set(q(".a2-window-clip"), { scale: 0.2, autoAlpha: 0, transformOrigin: "50% 100%" });
      gsap.set(q(".a2-window-img"), { scale: 1.3 });
      gsap.set(q(".a2-caption"), { yPercent: 110 });
      gsap.set(q(".a2-bg"), { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)" });
      gsap.set(q(".a2-cyl, .a2-stat, .a2-flows, .a2-foot"), { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: () => `+=${dist() * 1.34 + vh() * 1.1}`,
          pin: pin.current,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // Act 1 hides once Act 2 covers it. Layout does the covering (not the scrub), so the
          // scroll position alone decides; a step inside the scrubbed timeline would replay
          // late on the way back up and hide the hero again.
          onEnter: () => act1 && gsap.set(act1, { visibility: "hidden" }),
          onLeaveBack: () => act1 && gsap.set(act1, { visibility: "visible" }),
          onRefresh: (self) => act1 && gsap.set(act1, { visibility: self.progress > 0 ? "hidden" : "visible" }),
          onUpdate: (self) => {
            // D2: the seal is a bead on the string, x tied to progress.
            const bead = document.querySelector<HTMLElement>(".a2-bead");
            if (bead) bead.style.transform = `translateX(${self.progress * (window.innerWidth - 2 * parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--margin") || "48"))}px)`;
            director.schedule();
          },
        },
      });
      tl.addLabel("rest", 0).to({}, { duration: 0.05 });
      tl.addLabel("track", 0.05).to(tr, { x: () => -dist(), duration: 0.75 }, 0.05);

      // Per unit: word insertion, counter-scale, caption, pattern wipe.
      q<HTMLElement>(".a2-unit").forEach((u, i) => {
        const clip = u.querySelector(".a2-window-clip");
        const img = u.querySelector(".a2-window-img");
        const cap = u.querySelector(".a2-caption");
        const word = u.querySelector(".a2-word");
        const rule = u.querySelector(".a2-window-rule");
        const W = () => (u.querySelector<HTMLElement>(".a2-window")?.offsetWidth ?? 300) / 2;
        const ut = gsap.timeline({
          scrollTrigger: { trigger: u, containerAnimation: tl.getTweensOf(tr)[0] as gsap.core.Tween, start: mobile ? "left 95%" : "left 88%", end: mobile ? "left 30%" : "left 38%", scrub: true },
        });
        // The window grows up from its sill, an arch opening between the words.
        ut.fromTo(clip, { scale: 0.2, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, ease: "camera" }, 0)
          .fromTo(img, { scale: 1.3 }, { scale: 1, ease: "camera" }, 0)
          .fromTo(word, { x: () => (mobile ? 0 : -W() * 1.2), y: () => (mobile ? 30 : 0) }, { x: 0, y: 0, ease: "camera" }, 0)
          .fromTo(rule, { autoAlpha: 0 }, { autoAlpha: 1, ease: "ink" }, 0.3)
          .fromTo(cap, { yPercent: 110 }, { yPercent: 0, ease: "paper" }, 0.5);
        // Inner parallax while on screen.
        gsap.fromTo(img, { xPercent: -5 }, { xPercent: 5, ease: "none", scrollTrigger: { trigger: u, containerAnimation: tl.getTweensOf(tr)[0] as gsap.core.Tween, start: "left right", end: "right left", scrub: true } });
        ScrollTrigger.create({
          trigger: word,
          containerAnimation: tl.getTweensOf(tr)[0] as gsap.core.Tween,
          start: "center 62%",
          onEnter: () => {
            setCurrent(i);
            gsap.to(q(".a2-bg")[i], { clipPath: "polygon(0% 0%, 220% 0%, 0% 220%)", duration: 0.5, ease: "ink" });
          },
          onLeaveBack: () => {
            setCurrent(i - 1);
            gsap.to(q(".a2-bg")[i], { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)", duration: 0.5, ease: "ink" });
          },
        });
      });

      // The words gather on a turning cylinder (primitive 34), then fold into the stat.
      // Back-facing words dim to 30% (brief 9 · 34).
      const cyl = { a: 0 };
      const drum = q(".a2-cyl-drum")[0];
      const words = q<HTMLElement>(".a2-cyl-word");
      const turnCylinder = () => {
        gsap.set(drum, { rotationX: cyl.a });
        words.forEach((wd, i) => {
          const ang = ((i * 360) / 7 + cyl.a) * (Math.PI / 180);
          wd.style.opacity = String(0.3 + 0.7 * Math.max(0, Math.cos(ang)) ** 2);
        });
      };
      turnCylinder();
      tl.addLabel("cylinder", 0.8)
        .to(tr, { autoAlpha: 0, duration: 0.012 }, 0.8)
        .to(q(".a2-cyl"), { autoAlpha: 1, duration: 0.012 }, 0.814)
        .fromTo(cyl, { a: 0 }, { a: 360, duration: 0.09, onUpdate: turnCylinder }, 0.81)
        .to(q(".a2-cyl"), { scaleY: 0, duration: 0.03, ease: "fold" }, 0.9)
        .set(q(".a2-cyl"), { autoAlpha: 0 }, 0.93)
        .to(q(".a2-stat"), { autoAlpha: 1, duration: 0.01 }, 0.935)
        .fromTo(q(".a2-stat-line"), { y: 0, yPercent: 105 }, { y: 0, yPercent: 0, duration: 0.025, ease: "paper", onComplete: () => setRolled(true), onReverseComplete: () => setRolled(false) }, 0.935)
        .to(q(".a2-flows, .a2-foot"), { autoAlpha: 1, duration: 0.01 }, 0.955)
        .fromTo(q(".a2-flows-line"), { y: 0, yPercent: 105 }, { y: 0, yPercent: 0, duration: 0.03, ease: "paper" }, 0.955)
        .addLabel("stat", 1);
    },
    { scope: section },
  );

  if (reduce) return <Act2Static />;

  const cur = current >= 0 ? TRADITIONS[current] : null;
  return (
    <>
      <section ref={section} id="act-2" data-section-world="paper" data-world="paper" className="act2" aria-labelledby="act2-title">
        <div ref={pin} className="act2-pin">
          <div className="a2-bg-base" aria-hidden="true" />
          {TRADITIONS.map((t) => (
            <div key={t.key} className="a2-bg" aria-hidden="true" style={{ backgroundImage: `${patternCss(t.key, "rgba(34,21,31,0.075)", "rgba(34,21,31,0.075)")}, url(/art/P-1-1024.webp)` }} />
          ))}

          <div className="a2-string" aria-hidden="true">
            <svg viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0,2 Q50,8 100,2" fill="none" stroke="var(--twine)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="a2-bead">
              <SealDock id="D2" size={24} />
            </span>
          </div>

          <div ref={track} className="a2-track">
            <div className="a2-intro">
              <h2 id="act2-title" className="type-display-l a2-intro-text">
                {copy.act2.intro[0]}
                <br />
                {copy.act2.intro[1]}
              </h2>
            </div>
            {TRADITIONS.map((t, i) => (
              <div key={t.key} className="a2-unit">
                <ArchWindow i={i} />
                <div className="a2-label">
                  <span className="a2-word type-word">{t.word}</span>
                  <span className="a2-cap-slot">
                    <span className="a2-caption type-mono">{t.place}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="a2-cyl" aria-hidden="true">
            <div className="a2-cyl-drum">
              {TRADITIONS.map((t, i) => (
                <span key={t.key} className="a2-cyl-word type-word" style={{ transform: `rotateX(${(i * 360) / 7}deg) translateZ(var(--cyl-r))` }}>
                  {t.word}
                </span>
              ))}
            </div>
          </div>

          <div className="a2-stat">
            <p className="type-display-l a2-stat-slot">
              <span className="a2-stat-line">
                About <LedgerRoll value={copy.act2.statPeople} play={rolled} /> people save this way.
              </span>
            </p>
            <p className="type-h2 a2-flows a2-stat-slot">
              <span className="a2-flows-line">
                {copy.act2.flows}
                <sup>
                  <a href="#fn-3">3</a>
                </sup>
              </span>
            </p>
            <p className="type-mono a2-foot" style={{ fontSize: 12 }}>
              ³ {copy.act2.footnote}
            </p>
          </div>

          <div className="a2-progress" aria-live="off">
            <span className="type-mono">{String(Math.max(0, current) + 1).padStart(2, "0")} / 07</span>
            <span className="type-word" style={{ fontSize: 17 }}>
              {cur?.word ?? ""}
            </span>
          </div>
          <a className="a2-fn type-mono" href="#fn-3" aria-label="Footnote 3: sources">
            ³
          </a>
        </div>
        {/* No JS: the reduced-motion grid instead of the unplayed track. */}
        <noscript>
          <div className="act2-static">
            <Act2StaticBody />
          </div>
        </noscript>
      </section>
      <section className="a2-bridge" data-section-world="paper" data-world="paper" aria-hidden="true">
        <Bunting />
      </section>
    </>
  );
}
