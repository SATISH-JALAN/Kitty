"use client";
/**
 * Act 5 · Masks on. Everyone's real. (brief 11, Act 5). Night, pinned 380vh.
 *   beat 1 · a test ID card goes into the door's slot; inside (the aperture) its fields
 *            scramble into pattern and vanish; a mask comes out; the seal becomes the
 *            medallion it hangs from (D5).
 *   beat 2 · three doors, three parties, three masks; the threads between them snap.
 *   beat 3 · the same guest with a "new wallet" tag tries again; the handle rattles;
 *            "Already has a Guest Pass."
 * Then the Night peels up (torn seam) onto the Diary's paper.
 */
import { useRef } from "react";
import { identityFromName } from "@kitty/sdk";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion, useReducedMotion, snapOff } from "@kitty/ui/motion/reduced";
import { Stamp } from "@kitty/ui/components/Stamp";
import { Emblem } from "@kitty/ui/generators/emblem";
import { Mask } from "@kitty/ui/generators/mask";
import { patternCss } from "@kitty/ui/generators/patterns";
import { TornEdgeSvg } from "@kitty/ui/paper/TornEdgeSvg";
import { SealDock, flightTween, useSealDirector } from "@/components/chrome/SealDirector";
import { Door } from "@/components/stage/Door";
import { copy } from "@/copy/en";

const B = copy.act5.beats;
const PARTIES = ["Indigo Heron", "Saffron Lynx", "Moss Koi"].map((n) => identityFromName(n));

function TestIdCard() {
  return (
    <div className="test-id" data-world="paper">
      <span className="tid-photo" style={{ backgroundImage: patternCss("ajo", "#4E2152", "#E6D6BD", 0.5) }} />
      <span className="tid-lines">
        <span className="type-label" style={{ fontSize: 11 }}>
          TEST ID
        </span>
        <span className="tid-field type-mono">▓▓▓▓▓▓ ▓▓▓▓</span>
        <span className="tid-field type-mono">▓▓▓▓ ▓▓▓▓ ▓▓▓▓</span>
        <span className="tid-field type-mono">▓▓/▓▓/▓▓▓▓</span>
      </span>
    </div>
  );
}

function Silhouette({ cls, tag }: { cls?: string; tag?: boolean }) {
  const me = PARTIES[0];
  return (
    <div className={`a5-walker ${cls ?? ""}`} aria-hidden="true">
      <svg viewBox="0 0 90 225" width="90" height="225" style={{ overflow: "visible" }}>
        <g fill="#2E1A3E" stroke="rgba(246,238,223,.35)" strokeWidth="1.5">
          <ellipse cx="45" cy="34" rx="20" ry="25" />
          <path d="M34,56 L56,56 L58,72 L32,72 Z" />
          <path d="M10,225 L13,112 C13,84 28,74 45,74 C62,74 77,84 77,112 L80,225 Z" />
        </g>
        <path d="M14,150 L76,150 L76.4,158 L13.6,158 Z" fill="#C8A04A" opacity=".4" />
      </svg>
      <span style={{ position: "absolute", left: 15, top: 20 }}>
        <Mask colour={me.colour} animal={me.animal} tradition="kitty" width={60} />
      </span>
      {tag && (
        <span className="a5-wallet-tag type-mono">
          <span className="a5-wallet-string" />
          {copy.act5.newWallet}
        </span>
      )}
    </div>
  );
}

/** Reduced motion, and (inside <noscript>) no JS: the three beats as static panels. */
function Act5StaticBody() {
  return (
    <div className="grid-page a5-static">
      <div className="a5-static-door" aria-hidden="true">
        <Door height="clamp(300px, 58svh, 560px)" />
      </div>
      <div className="a5-static-beats">
        {B.map((b, i) => (
          <article key={b.title}>
            <h2 className="type-h1">{b.title}</h2>
            <p className="type-body-l" style={{ color: "var(--moon-soft)", marginTop: 12, maxWidth: "38ch" }}>
              {b.body}
            </p>
            {i === 1 && (
              <div className="a5-static-masks" aria-hidden="true">
                {PARTIES.map((p, j) => (
                  <div key={p.name} className="a5-party-mask">
                    <Mask colour={p.colour} animal={p.animal} tradition={(["tanda", "susu", "ajo"] as const)[j]} width={96} />
                    <span className="type-word" style={{ fontSize: 18 }}>
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {i === 2 && (
              <div className="a5-static-notice" data-world="paper">
                <Stamp label={copy.act5.stamp} ink="plum" rotate={-4} />
              </div>
            )}
          </article>
        ))}
        <p className="type-mono" style={{ color: "var(--moon-soft)" }}>
          {copy.act5.caption}
        </p>
      </div>
    </div>
  );
}

function Act5Static() {
  return (
    <section id="act-5" data-section-world="night" data-world="night" style={{ background: "var(--night)" }}>
      <Act5StaticBody />
    </section>
  );
}

export function Act5Masks() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const director = useSealDirector();
  const reduce = useReducedMotion();

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        director.set("D4b", "D5", 1);
        return;
      }
      const q = gsap.utils.selector(section);
      gsap.set(q(".a5-copy"), { yPercent: 105 });
      gsap.set(q(".a5-aperture"), { clipPath: "circle(0px at 50% 50%)" });
      gsap.set(q(".a5-mask-out, .a5-doors-side, .a5-party-mask, .a5-thread, .a5-walker, .a5-stamp, .a5-cap"), { autoAlpha: 0 });
      gsap.set(q(".a5-thread path"), { drawSVG: "0%" });
      gsap.set(q(".door-img"), { filter: "brightness(.55)" });
      gsap.set(q(".door-glow"), { opacity: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "+=380%",
          pin: pin.current,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          snap: snapOff() ? undefined : { snapTo: "labelsDirectional", duration: { min: 0.25, max: 0.7 }, delay: 0.08, ease: "paper" },
        },
      });

      // 0–.08: the door's light comes up behind the cut-work.
      tl.to(q(".a5-door-main .door-img"), { filter: "brightness(1)", duration: 0.08, ease: "lantern" }, 0)
        .to(q(".a5-door-main .door-glow"), { opacity: 1, duration: 0.08, ease: "lantern" }, 0)
        .to(q(`.a5-copy[data-b="0"]`), { yPercent: 0, duration: 0.04, ease: "paper" }, 0.06);

      // Beat 1.
      tl.to(q(".test-id"), { x: () => (q(".a5-slot-target")[0] as HTMLElement).getBoundingClientRect().left - (q(".test-id")[0] as HTMLElement).getBoundingClientRect().left, y: () => (q(".a5-slot-target")[0] as HTMLElement).getBoundingClientRect().top - (q(".test-id")[0] as HTMLElement).getBoundingClientRect().top - 60, rotationY: -8, duration: 0.08, ease: "camera" }, 0.08)
        .to(q(".test-id"), { y: "+=70", clipPath: "inset(0 0 100% 0)", duration: 0.04, ease: "power1.in" }, 0.16)
        .to(q(".a5-tray"), { autoAlpha: 0, duration: 0.03 }, 0.18)
        .to(q(".a5-aperture"), { clipPath: "circle(140px at 50% 50%)", duration: 0.04, ease: "ink" }, 0.18)
        .to(q(".a5-ap-field"), { backgroundPositionX: "80px", duration: 0.04 }, 0.2)
        .to(q(".a5-ap-field"), { scaleX: 0, duration: 0.03, stagger: 0.005, ease: "fold" }, 0.23)
        .to(q(".a5-aperture"), { clipPath: "circle(0px at 50% 50%)", duration: 0.03, ease: "ink" }, 0.27)
        .fromTo(q(".a5-mask-out"), { autoAlpha: 0, x: -60 }, { autoAlpha: 1, x: 0, duration: 0.05, ease: "paper" }, 0.26)
        .add(flightTween(director, "D4b", "D5", 0.05), 0.28)
        .addLabel("beat1", 0.33);

      // Beat 2: three doors, three masks, threads that snap.
      tl.to(q(`.a5-copy[data-b="0"]`), { yPercent: -105, duration: 0.03, ease: "fold" }, 0.38)
        .to(q(".a5-mask-out"), { autoAlpha: 0, duration: 0.02 }, 0.38)
        .to(q(".a5-door-main"), { scale: 0.6, x: () => (window.innerWidth < 1024 ? 0 : -0.26 * window.innerWidth), y: () => 0.11 * window.innerHeight, duration: 0.06, ease: "camera" }, 0.4)
        .to(q(".a5-doors-side"), { autoAlpha: 1, duration: 0.03 }, 0.43)
        .fromTo(q(".a5-side"), { x: 160 }, { x: 0, duration: 0.06, stagger: 0.01, ease: "camera", immediateRender: false }, 0.42)
        .to(q(`.a5-copy[data-b="1"]`), { yPercent: 0, duration: 0.04, ease: "paper" }, 0.44);
      q<HTMLElement>(".a5-party-mask").forEach((m, i) => {
        tl.fromTo(m, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.03, ease: "paper" }, 0.48 + i * 0.04);
      });
      tl.to(q(".a5-thread"), { autoAlpha: 1, duration: 0.01 }, 0.58)
        .to(q(".a5-thread path"), { drawSVG: "100%", duration: 0.04, ease: "ink" }, 0.58)
        .to(q(".a5-thread-l"), { y: 40, rotation: -8, autoAlpha: 0, duration: 0.04, ease: "power1.in" }, 0.64)
        .to(q(".a5-thread-r"), { y: 40, rotation: 8, autoAlpha: 0, duration: 0.04, ease: "power1.in" }, 0.64)
        .addLabel("beat2", 0.68);

      // Beat 3: one door again; the new wallet is turned away.
      tl.to(q(`.a5-copy[data-b="1"]`), { yPercent: -105, duration: 0.03, ease: "fold" }, 0.7)
        .to(q(".a5-doors-side, .a5-party-mask"), { autoAlpha: 0, duration: 0.03 }, 0.7)
        .to(q(".a5-door-main"), { scale: 1, x: 0, y: 0, duration: 0.05, ease: "camera" }, 0.71)
        .to(q(`.a5-copy[data-b="2"]`), { yPercent: 0, duration: 0.04, ease: "paper" }, 0.74)
        .fromTo(q(".a5-walker-3"), { autoAlpha: 1, x: -220 }, { x: 0, duration: 0.06, ease: "paper", immediateRender: false }, 0.74)
        .to(q(".a5-door-main"), { keyframes: { x: [0, 2, -2, 2, -2, 2, 0] }, duration: 0.03 }, 0.8)
        .fromTo(q(".a5-stamp"), { autoAlpha: 0, scale: 1.4, rotation: 0 }, { autoAlpha: 1, scale: 1, rotation: -6, duration: 0.02, ease: "stamp" }, 0.83)
        .to(q(".a5-cap"), { autoAlpha: 1, duration: 0.02 }, 0.86)
        .addLabel("beat3", 0.9);

      // .92–1: the torn seam peels the Night up, revealing Paper.
      tl.to(q(".a5-sheet"), { yPercent: -104, rotationX: -14, duration: 0.08, ease: "fold", transformPerspective: 2200, transformOrigin: "50% 0%" }, 0.92)
        .to(q(".a5-seam-shadow"), { opacity: 1, duration: 0.08 }, 0.92)
        .addLabel("end", 1);
    },
    { scope: section },
  );

  if (reduce) return <Act5Static />;

  return (
    <section ref={section} id="act-5" data-section-world="night" data-world="night" className="act5" aria-labelledby="act5-h">
      <h2 id="act5-h" className="sr-only">
        Masks on. Everyone&rsquo;s real.
      </h2>
      <div ref={pin} className="act5-pin">
        <div className="a5-under" aria-hidden="true" />
        <div className="a5-seam-shadow" aria-hidden="true" />
        <div className="a5-sheet">
          <div className="a5-stage">
            <div className="a5-door-main">
              <Door height="78svh" ornament={<Emblem partyId="act4-party" guests={10} tradition="kitty" size={120} style={{ width: "100%", height: "auto" }} />}>
                <span className="a5-slot-target" style={{ position: "absolute", left: "38%", top: "53.6%" }} />
                <div className="a5-aperture" aria-hidden="true">
                  <div className="a5-ap-inner">
                    <span className="type-label" style={{ fontSize: 10, color: "var(--moon-soft)" }}>
                      Checked on your device
                    </span>
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="a5-ap-field" style={{ backgroundImage: patternCss("kitty", "#F4A300", "#F4A300", 0.6) }} />
                    ))}
                  </div>
                </div>
              </Door>
              <div className="a5-mask-out" aria-hidden="true">
                <SealDock id="D5" size={72} className="a5-medal" />
                <span className="a5-mask-string" />
                <Mask colour={PARTIES[0].colour} animal={PARTIES[0].animal} tradition="kitty" width={180} />
              </div>
              <Silhouette cls="a5-walker-3" tag />
              <div className="a5-stamp" data-world="paper">
                <Stamp label={copy.act5.stamp} ink="plum" rotate={0} />
              </div>
            </div>
            <div className="a5-doors-side" aria-hidden="true">
              <div className="a5-side a5-side-a">
                <Door height="47svh" />
              </div>
              <div className="a5-side a5-side-b">
                <Door height="47svh" />
              </div>
            </div>
            <div className="a5-party-masks" aria-hidden="true">
              {PARTIES.map((p) => (
                <div key={p.name} className="a5-party-mask">
                  <Mask colour={p.colour} animal={p.animal} tradition={(["tanda", "susu", "ajo"] as const)[PARTIES.indexOf(p)]} width={120} />
                  <span className="type-word" style={{ fontSize: 20 }}>
                    {p.name}
                  </span>
                </div>
              ))}
              <svg className="a5-thread a5-thread-l" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0,5 Q50,10 100,5" fill="none" stroke="var(--moon-soft)" strokeWidth="1.5" strokeDasharray="3 4" />
              </svg>
              <svg className="a5-thread a5-thread-r" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0,5 Q50,10 100,5" fill="none" stroke="var(--moon-soft)" strokeWidth="1.5" strokeDasharray="3 4" />
              </svg>
            </div>
          </div>

          <div className="a5-tray">
            <TestIdCard />
          </div>

          <div className="a5-copy-col">
            {B.map((b, i) => (
              <div key={b.title} className="a5-copy-slot">
                <div className="a5-copy" data-b={i}>
                  <h3 className="type-h1">{b.title}</h3>
                  <p className="type-body-l" style={{ color: "var(--moon-soft)", marginTop: 14, maxWidth: "30ch" }}>
                    {b.body}
                  </p>
                </div>
              </div>
            ))}
            <p className="a5-cap type-mono">{copy.act5.caption}</p>
          </div>
          <div className="a5-edge" aria-hidden="true">
            <TornEdgeSvg depth={20} seed={61} fill="var(--night)" flip />
          </div>
        </div>
      </div>
      {/* No JS: the reduced-motion panels instead of the unplayed scene. */}
      <noscript>
        <Act5StaticBody />
      </noscript>
    </section>
  );
}
