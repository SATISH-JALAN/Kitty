"use client";
/**
 * Finale · RSVP (brief 11, Finale). Paper, 100svh pinned 60vh.
 * An invite card arrives face-down (kraft, emblem debossed), flips face-up (0–0.4), the
 * seal lands at its foot (D8) and opens into the call to action: Get your Guest Pass.
 * The tradition word on the card cycles through the seven words while in view.
 */
import { useEffect, useRef, useState } from "react";
import { TRADITIONS } from "@kitty/sdk";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { magnetic } from "@kitty/ui/motion/primitives/physical";
import { Button, TextLink } from "@kitty/ui/components/Button";
import { Emblem } from "@kitty/ui/generators/emblem";
import { SealDock, flightTween, useSealDirector } from "@/components/chrome/SealDirector";
import { copy } from "@/copy/en";
import { LINKS } from "@/lib/links";

const WORDS = TRADITIONS.map((t) => t.word);

/** Label roll through the seven words every 2.2 s, only while the card is in view. */
function CyclingWord() {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (prefersReducedMotion() || !ref.current) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting && !timer) timer = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2200);
      if (!e?.isIntersecting && timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    io.observe(ref.current);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const cur = ref.current.querySelector(".cw-cur");
    const prev = ref.current.querySelector(".cw-prev");
    gsap.fromTo(cur, { yPercent: 100 }, { yPercent: 0, duration: 0.32, ease: "paper" });
    gsap.fromTo(prev, { yPercent: 0 }, { yPercent: -100, duration: 0.32, ease: "paper" });
  }, [i]);
  const prevWord = WORDS[(i - 1 + WORDS.length) % WORDS.length];
  return (
    <span ref={ref} className="type-word" style={{ position: "relative", display: "inline-grid", overflow: "clip", fontSize: 40, lineHeight: 1.15, height: "1.2em" }} aria-live="off">
      {/* Starts above the slot, so only the current word shows until the first roll (and always, with reduced motion or no JS). */}
      <span className="cw-prev" aria-hidden="true" style={{ gridArea: "1 / 1", textAlign: "center", transform: "translateY(-100%)" }}>
        {prevWord}
      </span>
      <span className="cw-cur" style={{ gridArea: "1 / 1", textAlign: "center" }}>
        {WORDS[i]}
      </span>
    </span>
  );
}

export function Finale() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const director = useSealDirector();

  useGSAP(
    () => {
      const q = gsap.utils.selector(section);
      if (prefersReducedMotion()) {
        director.set("D7", "D8", 1);
        gsap.set(q(".fin-cta"), { clipPath: "none" });
        gsap.set(q(".fin-dock"), { autoAlpha: 0 });
        return;
      }
      gsap.set(q(".fin-card-inner"), { rotationY: 180 });
      gsap.set(q(".fin-cta"), { clipPath: "circle(24px at 50% 50%)", autoAlpha: 0 });
      gsap.set(q(".fin-cta-label"), { yPercent: 110 });
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: section.current, start: "top top", end: "+=60%", pin: pin.current, scrub: 1, anticipatePin: 1, invalidateOnRefresh: true },
      });
      tl.to(q(".fin-card-inner"), { rotationY: 0, duration: 0.4, ease: "fold" }, 0)
        .to(q(".fin-card"), { keyframes: { boxShadow: ["var(--d1)", "var(--d3)", "var(--d2)"] }, duration: 0.4 }, 0)
        .add(flightTween(director, "D7", "D8", 0.15), 0.4)
        .to(q(".fin-dock"), { scale: 0.5, autoAlpha: 0, duration: 0.06, ease: "fold" }, 0.56)
        .to(q(".fin-cta"), { autoAlpha: 1, duration: 0.01 }, 0.56)
        .to(q(".fin-cta"), { clipPath: "circle(160% at 50% 50%)", duration: 0.12, ease: "ink" }, 0.57)
        .to(q(".fin-cta-label"), { yPercent: 0, duration: 0.08, ease: "paper" }, 0.63)
        .to(q(".fin-link"), { autoAlpha: 1, y: 0, duration: 0.08, ease: "paper" }, 0.66);
    },
    { scope: section },
  );

  const cta = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = cta.current?.querySelector<HTMLElement>(".btn");
    return b ? magnetic(b, b.querySelector<HTMLElement>(".btn-label")) : undefined;
  }, []);

  return (
    <section ref={section} id="rsvp" data-section-world="paper" data-world="paper" className="finale" aria-labelledby="fin-title">
      <div ref={pin} className="finale-pin">
        <div className="fin-card">
          <div className="fin-card-inner">
            <div className="fin-face paper-fibre foil-frame">
              <span className="type-label" style={{ color: "var(--ink-soft)" }}>
                {copy.finale.invited}
              </span>
              <h2 id="fin-title" className="type-h2">
                {copy.finale.to}
              </h2>
              <Emblem partyId="finale" guests={10} tradition="tanda" size={120} />
              <CyclingWord />
              <span className="stitch-b" style={{ width: "72%", height: 1 }} aria-hidden="true" />
              <p className="type-mono" style={{ fontSize: 14, textAlign: "center", lineHeight: 1.6 }}>
                {copy.finale.fees[0]}
                <br />
                {copy.finale.fees[1]}
              </p>
            </div>
            <div className="fin-back" aria-hidden="true">
              <div className="fin-deboss">
                <Emblem partyId="finale" guests={10} tradition="tanda" size={160} />
              </div>
            </div>
          </div>
          {/* Outside the flipping layer so 3D sorting never slices the seal. */}
          <div className="fin-foot">
            <SealDock id="D8" size={96} className="fin-dock" />
          </div>
        </div>
        <div className="fin-actions">
          <div ref={cta} className="fin-cta">
            <Button href="/pass" size="L">
              <span className="fin-cta-slot">
                <span className="fin-cta-label">{copy.cta.pass}</span>
              </span>
            </Button>
          </div>
          <div className="fin-link">
            <TextLink href={LINKS.docs} external={LINKS.docs.startsWith("http")}>
              {copy.cta.readDocs}
            </TextLink>
          </div>
        </div>
      </div>
    </section>
  );
}
