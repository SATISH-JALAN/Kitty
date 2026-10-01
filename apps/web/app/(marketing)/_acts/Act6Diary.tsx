"use client";
/**
 * Act 6 · The Party Diary (brief 11, Act 6). Paper, pinned 320vh.
 * The booklet drops in; the cover opens; spread 1 fills with stamps; spread 2 peels the
 * seat cards Guest → Regular → Family; spread 3 tears out one page — "3 parties · never
 * late." — while the booklet closes and the seal becomes its clasp (D6).
 */
import { useRef, useState } from "react";
import { earliestSeat, TIER_NAMES, type Tier } from "@kitty/sdk";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion, useReducedMotion, snapOff } from "@kitty/ui/motion/reduced";
import { Stamp } from "@kitty/ui/components/Stamp";
import { Tag } from "@kitty/ui/components/Tag";
import { SealDock, flightTween, useSealDirector } from "@/components/chrome/SealDirector";
import { BookletCover, DiaryPage } from "@/components/stage/Booklet";
import { copy } from "@/copy/en";

const STAMPS = Array.from({ length: 14 }, (_, i) => ({ farewell: i === 6 || i === 13, n: (i % 7) + 1 }));

function SeatCardBig({ tier }: { tier: Tier }) {
  return (
    <div className="a6-seat" data-tier={tier}>
      <div className="a6-seat-face">
        <Tag variant={tier === 2 ? "family" : tier === 1 ? "regular" : "guest"}>{TIER_NAMES[tier]}</Tag>
        <span className="type-display-l" style={{ fontSize: 56 }}>
          Seat {earliestSeat(tier, 10)}+
        </span>
        <span className="type-small" style={{ color: "var(--ink-soft)" }}>
          Keepsafe {["75%", "50%", "25%"][tier]} of what&rsquo;s still owed
        </span>
      </div>
    </div>
  );
}

/** Reduced motion, and (inside <noscript>) no JS: the booklet, its captions and the torn-out page. */
function Act6StaticBody() {
  return (
    <div className="grid-page a6-static">
      <div className="a6-static-copy">
        <h2 className="type-h1">{copy.act6.title}</h2>
        <p className="type-body-l">{copy.act6.sub}</p>
        {copy.act6.captions.map((c) => (
          <p key={c} className="type-h2">
            {c}
          </p>
        ))}
      </div>
      <div className="a6-static-art" aria-hidden="true">
        <div className="a6-static-cover">
          <BookletCover />
        </div>
        <div className="a6-static-page">
          <DiaryPage perforated="left">
            <p className="type-word" style={{ fontSize: 32, lineHeight: 1.05, marginTop: 28 }}>
              {copy.act6.page}
            </p>
            <div className="a6-torn-stamp">
              <Stamp label="Verified by proof" ink="teal" />
            </div>
          </DiaryPage>
        </div>
      </div>
    </div>
  );
}

function Act6Static() {
  return (
    <section id="act-6" data-section-world="paper" data-world="paper" style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <Act6StaticBody />
    </section>
  );
}

export function Act6Diary() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const director = useSealDirector();
  const reduce = useReducedMotion();
  const [cap, setCap] = useState(-1);

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        director.set("D5", "D6", 1);
        return;
      }
      const q = gsap.utils.selector(section);
      gsap.set(q(".a6-book"), { y: () => 0.35 * window.innerHeight, rotation: -6, autoAlpha: 0 });
      gsap.set(q(".a6-stamp"), { autoAlpha: 0 });
      gsap.set(q(".a6-sp2, .a6-sp3"), { autoAlpha: 0 });
      gsap.set(q(".a6-perf"), { drawSVG: "0%" });
      gsap.set(q(".a6-torn"), { autoAlpha: 0 });
      gsap.set(q(".a6-closed"), { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "+=320%",
          pin: pin.current,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          snap: snapOff() ? undefined : { snapTo: "labelsDirectional", duration: { min: 0.25, max: 0.7 }, delay: 0.08, ease: "paper" },
          onUpdate: (self) => setCap(self.progress < 0.2 ? -1 : self.progress < 0.45 ? 0 : self.progress < 0.65 ? 1 : 2),
        },
      });
      tl.fromTo(q(".a6-book"), { y: () => 0.35 * window.innerHeight, rotation: -6, autoAlpha: 0 }, { y: 0, rotation: -1.5, autoAlpha: 1, duration: 0.1, ease: "paper", immediateRender: false }, 0)
        // Cover opens: page turn about the spine.
        .to(q(".a6-cover"), { rotationY: -180, duration: 0.1, ease: "fold" }, 0.1)
        .to(q(".a6-cover-front"), { autoAlpha: 0, duration: 0.01 }, 0.15);
      q<HTMLElement>(".a6-stamp").forEach((s, i) => {
        tl.fromTo(s, { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: 0.012, ease: "stamp" }, 0.2 + i * 0.013);
      });
      tl.addLabel("stamps", 0.4)
        // Spread 2: seat cards.
        .to(q(".a6-sp1"), { autoAlpha: 0, duration: 0.02 }, 0.45)
        .to(q(".a6-sp2"), { autoAlpha: 1, duration: 0.02 }, 0.45)
        .to(q(".a6-seat[data-tier='0']"), { rotationX: -100, transformOrigin: "50% 100%", duration: 0.06, ease: "fold" }, 0.5)
        .to(q(".a6-seat[data-tier='0']"), { autoAlpha: 0, duration: 0.005 }, 0.555)
        .to(q(".a6-seat[data-tier='1']"), { rotationX: -100, transformOrigin: "50% 100%", duration: 0.06, ease: "fold" }, 0.57)
        .to(q(".a6-seat[data-tier='1']"), { autoAlpha: 0, duration: 0.005 }, 0.625)
        .addLabel("seats", 0.64)
        // Spread 3: show a page.
        .to(q(".a6-sp2"), { autoAlpha: 0, duration: 0.02 }, 0.65)
        .to(q(".a6-sp3"), { autoAlpha: 1, duration: 0.02 }, 0.65)
        .to(q(".a6-perf"), { drawSVG: "100%", duration: 0.05, ease: "ink" }, 0.67)
        .set(q(".a6-torn"), { autoAlpha: 1 }, 0.72)
        .set(q(".a6-sp3-right"), { autoAlpha: 0 }, 0.72)
        .to(q(".a6-torn"), { keyframes: { rotationY: [0, -14, 0], rotation: [0, 3, -2] }, xPercent: -50, y: -10, scale: 1.04, duration: 0.1, ease: "fold", transformPerspective: 1600 }, 0.72)
        .to(q(".a6-open"), { autoAlpha: 0, duration: 0.04 }, 0.76)
        .to(q(".a6-closed"), { autoAlpha: 1, xPercent: -62, scale: 0.8, duration: 0.05, ease: "paper" }, 0.76)
        .fromTo(q(".a6-torn-stamp"), { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: 0.02, ease: "stamp" }, 0.82)
        .add(flightTween(director, "D5", "D6", 0.06), 0.8)
        .addLabel("show", 0.9)
        .to({}, { duration: 0.1 }, 0.9);
    },
    { scope: section },
  );

  if (reduce) return <Act6Static />;

  return (
    <section ref={section} id="act-6" data-section-world="paper" data-world="paper" className="act6" aria-labelledby="act6-title">
      <div ref={pin} className="act6-pin">
        <header className="a6-head">
          <h2 id="act6-title" className="type-h1">
            {copy.act6.title}
          </h2>
          <p className="type-body-l">{copy.act6.sub}</p>
        </header>

        <div className="a6-book" aria-hidden="true">
          <div className="a6-open">
            <div className="a6-spread a6-sp1">
              <DiaryPage perforated="left" n={1}>
                <p className="type-label" style={{ color: "var(--ink-soft)" }}>
                  Stamps · 14 chip-ins
                </p>
                <div className="a6-stamps">
                  {STAMPS.slice(0, 7).map((s, i) => (
                    <span key={i} className="a6-stamp">
                      <Stamp shape="round" size={72} ink={s.farewell ? "plum" : "teal"} label={s.farewell ? "Farewell" : "Paid"} seed={`a6${i}`} />
                    </span>
                  ))}
                </div>
              </DiaryPage>
              <DiaryPage perforated="none" n={2}>
                <div className="a6-stamps">
                  {STAMPS.slice(7).map((s, i) => (
                    <span key={i} className="a6-stamp">
                      <Stamp shape="round" size={72} ink={s.farewell ? "plum" : "teal"} label={s.farewell ? "Farewell" : "Paid"} seed={`a6b${i}`} />
                    </span>
                  ))}
                </div>
              </DiaryPage>
            </div>
            <div className="a6-spread a6-sp2">
              <DiaryPage perforated="left" n={3}>
                <p className="type-label" style={{ color: "var(--ink-soft)" }}>
                  Your seat at the table
                </p>
                <p className="type-body">Finish parties to move closer to the head of the table, with a smaller keepsafe.</p>
              </DiaryPage>
              <DiaryPage perforated="none" n={4}>
                <div className="a6-seats">
                  <SeatCardBig tier={2} />
                  <SeatCardBig tier={1} />
                  <SeatCardBig tier={0} />
                  <span className="a6-seat-count type-mono" aria-hidden="true">
                    Guest · Regular · Family
                  </span>
                </div>
              </DiaryPage>
            </div>
            <div className="a6-spread a6-sp3">
              <DiaryPage perforated="left" n={5}>
                <p className="type-label" style={{ color: "var(--ink-soft)" }}>
                  Show a page
                </p>
                <p className="type-body">One page, made for one reader.</p>
              </DiaryPage>
              <div className="a6-sp3-right">
                <DiaryPage perforated="none" n={6}>
                  <p className="type-word" style={{ fontSize: 40, lineHeight: 1.05 }}>
                    {copy.act6.page}
                  </p>
                </DiaryPage>
                <svg className="a6-perf-svg" viewBox="0 0 4 100" preserveAspectRatio="none">
                  <path className="a6-perf" d="M2,0 V100" stroke="var(--ink-soft)" strokeWidth="2" strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />
                </svg>
              </div>
            </div>
            <div className="a6-cover">
              <div className="a6-cover-front">
                <BookletCover />
              </div>
            </div>
          </div>
          <div className="a6-closed">
            <BookletCover />
            <SealDock id="D6" size={56} className="a6-clasp" />
          </div>
          <div className="a6-torn">
            <DiaryPage perforated="left">
              <p className="type-word" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 40 }}>
                {copy.act6.page}
              </p>
              <div className="a6-torn-stamp">
                <Stamp label="Verified by proof" ink="teal" />
              </div>
            </DiaryPage>
          </div>
        </div>

        <p className="a6-caption type-body-l" aria-live="polite">
          {cap >= 0 ? copy.act6.captions[cap] : " "}
        </p>
      </div>
      {/* No JS: the reduced-motion panels instead of the unplayed scene. */}
      <noscript>
        <Act6StaticBody />
      </noscript>
    </section>
  );
}
