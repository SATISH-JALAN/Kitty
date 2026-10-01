"use client";
/**
 * Act 1 · The Invitation (brief 11, Act 1). Night. 100svh + pinned 140vh.
 *
 * A scalloped arch (cols 6–12) holds a five-layer diorama on the 2880×1800 stage. On
 * scroll: the tag retracts; the arch pushes to full-bleed while the text drops back into
 * its slots; the seal cracks free of the envelope; the camera dollies into the party
 * (guests part, the table grows, marigolds pass the camera); a caption; a rest; then
 * into the kraft of the parcel and out onto cream paper — Act 2's page.
 *
 * Only transforms, opacity and clip-path animate. The copy is server-rendered.
 */
import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@kitty/ui/motion/gsap";
import { MQ, isTouch, prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { lineInSlot, maskOff, fontsReady } from "@kitty/ui/motion/primitives/text";
import { magnetic, stamp } from "@kitty/ui/motion/primitives/physical";
import { swing } from "@kitty/ui/motion/gsap";
import { Button, TextLink } from "@kitty/ui/components/Button";
import { Lantern } from "@kitty/ui/components/Lantern";
import { patternCss } from "@kitty/ui/generators/patterns";
import { useLenis, scrollToTarget } from "@kitty/ui/motion/MotionProvider";
import { Art } from "@/components/Art";
import { SkyCanvas } from "@/components/stage/SkyCanvas";
import { SealDock, flightTween, useSealDirector } from "@/components/chrome/SealDirector";
import { copy } from "@/copy/en";
import { archPath, cover, lerpBox, scallopedArch, type Box } from "./archGeometry";
import { REVEAL_EVENT, revealed } from "@/lib/reveal";

const STAGE = { w: 2880, h: 1800 };
const FOCAL = { x: 1506, y: 878 };
const PARALLAX = { h1: 4, h2: 8, h3: 14, h4: 18, h5: 24 };

function Envelope() {
  return (
    <svg viewBox="0 0 180 120" width="100%" height="100%" aria-hidden="true" style={{ overflow: "visible" }}>
      <defs>
        <pattern id="act1-kraft" patternUnits="userSpaceOnUse" width="180" height="180">
          <image href="/art/P-3-512.webp" width="180" height="180" />
        </pattern>
      </defs>
      {/* flap, open and standing up behind the envelope */}
      <path d="M4,40 L90,-18 L176,40 Z" fill="#A9845A" />
      <path d="M4,40 L90,-18 L176,40 Z" fill="url(#act1-kraft)" opacity=".45" />
      <rect x="4" y="38" width="172" height="80" rx="2.5" fill="#C9A57A" />
      <rect x="4" y="38" width="172" height="80" rx="2.5" fill="url(#act1-kraft)" opacity=".55" />
      <path d="M4,40 L90,86 L176,40" fill="none" stroke="#8C6A45" strokeWidth="1.2" />
      <path d="M4,117 L70,74 M176,117 L110,74" stroke="#8C6A45" strokeWidth=".9" opacity=".6" />
    </svg>
  );
}

export function Act1Invitation() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const archBox = useRef<HTMLDivElement>(null);
  const dioA = useRef<HTMLDivElement>(null);
  const dioB = useRef<HTMLDivElement>(null);
  const stageA = useRef<HTMLDivElement>(null);
  const stageB = useRef<HTMLDivElement>(null);
  const frame = useRef<SVGSVGElement>(null);
  const director = useSealDirector();
  const lenis = useLenis();
  const sky = useRef<{ setBoost: (v: number) => void } | null>(null);

  useGSAP(
    () => {
      const root = section.current!;
      const q = gsap.utils.selector(root);
      const reduce = prefersReducedMotion();
      let arch: Box = { x: 0, y: 0, w: 1, h: 1 };
      let view: Box = { x: 0, y: 0, w: 1, h: 1 };
      const state = { push: 0 };

      /** Place clip, stage and frame for push progress k (0 = arch, 1 = full-bleed). */
      const place = () => {
        const k = gsap.parseEase("camera")(state.push);
        const b = lerpBox(arch, view, k);
        const c = cover(b, STAGE, FOCAL);
        const clip = `path("${archPath(b, (b.w / 2) * (1 - k))}")`;
        for (const d of [dioA.current, dioB.current]) if (d) d.style.clipPath = clip;
        for (const s of [stageA.current, stageB.current]) if (s) s.style.transform = `translate(${c.x}px, ${c.y}px) scale(${c.s})`;
        const f = frame.current;
        if (f) {
          const sx = b.w / arch.w;
          const sy = b.h / arch.h;
          f.style.transform = `translate(${b.x - arch.x * sx}px, ${b.y - arch.y * sy}px) scale(${sx}, ${sy})`;
          f.style.opacity = String(Math.max(0, 1 - k * 1.6));
        }
      };

      const measure = () => {
        const r = archBox.current!.getBoundingClientRect();
        const p = pin.current!.getBoundingClientRect();
        arch = { x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height };
        view = { x: 0, y: 0, w: p.width, h: p.height };
        const mobile = window.matchMedia(MQ.mobile).matches;
        const band = mobile ? 14 : 20;
        const f = frame.current;
        if (f) {
          f.setAttribute("viewBox", `0 0 ${p.width} ${p.height}`);
          f.setAttribute("width", String(p.width));
          f.setAttribute("height", String(p.height));
          f.style.transformOrigin = "0 0";
          const opening = archPath(arch);
          f.querySelector(".frame-paper")!.setAttribute("d", `${scallopedArch(arch, band, mobile ? 14 : 24)} ${opening}`);
          f.querySelector(".frame-shadow")!.setAttribute("d", `${scallopedArch(arch, band, mobile ? 14 : 24)} ${opening}`);
          const inset = (n: number) => archPath({ x: arch.x - n, y: arch.y - n, w: arch.w + 2 * n, h: arch.h + n });
          f.querySelector(".frame-rule-1")!.setAttribute("d", inset(band * 0.3));
          f.querySelector(".frame-rule-2")!.setAttribute("d", inset(band * 0.3 + 4));
        }
        // Envelope sits centred on the arch's bottom edge, overlapping it by half.
        place();
      };

      measure();
      ScrollTrigger.addEventListener("refreshInit", measure);

      if (reduce) {
        gsap.set(q(".mo-hold-strip"), { autoAlpha: 0 });
        director.set("D1", "D1h", 0);
        return () => ScrollTrigger.removeEventListener("refreshInit", measure);
      }

      /* ---------------- intro (time-based, after the preloader's iris) ---------------- */
      const intro = gsap.timeline({ paused: true });
      const lines = q<HTMLElement>(".hero-line");
      const released: (() => void)[] = [];
      const run = async () => {
        await fontsReady();
        gsap.set(q(".hero-copy"), { autoAlpha: 1 });
        gsap.set(q(".mo-hold-strip"), { autoAlpha: 0 });
        lines.forEach((l, i) => {
          const m = maskOff(l, { hold: ".hero-secret", strip: `${patternCss("kitty", "#3B2350")}, var(--night-raised)`, paused: true });
          released.push(m.release);
          intro.add(m.tl.play(), [0.3, 0.65, 1.0][i]);
        });
        const sub = lineInSlot(q<HTMLElement>(".hero-sub")[0], { paused: true });
        intro.add(sub.tl.play(), 1.3);
        intro.fromTo(q(".hero-cta > *"), { y: 90, rotate: 2 }, { y: 0, rotate: 0, duration: 0.7, ease: "paper", stagger: 0.07 }, 1.5);
        intro.fromTo(q(".layer-h5"), { y: 30 }, { y: 0, duration: 0.9, ease: "camera" }, 0.15);
        intro.fromTo(q(".layer-h4"), { y: 22 }, { y: 0, duration: 0.95, ease: "camera" }, 0.17);
        intro.fromTo(q(".layer-h3"), { y: 16 }, { y: 0, duration: 1, ease: "camera" }, 0.19);
        intro.fromTo(q(".layer-h2"), { y: 10 }, { y: 0, duration: 1.05, ease: "camera" }, 0.21);
        intro.fromTo(q(".hero-envelope"), { y: 40, rotate: -3, autoAlpha: 0 }, { y: 0, rotate: 0, autoAlpha: 1, duration: 0.6, ease: "paper" }, 1.7);
        intro.add(stamp(q(".hero-envelope .seal-dock")[0], { theta: -4, surface: q(".hero-envelope")[0] }), 2.0);
        intro.fromTo(q(".hero-tag"), { autoAlpha: 0, rotate: 18 }, { autoAlpha: 1, rotate: 0, duration: 0.01 }, 2.3);
        intro.add(() => {
          const t = q(".hero-tag")[0];
          gsap.set(t, { transformOrigin: "50% 0%" });
          swing(t, 18, 1.6, { fromAmp: true });
          // Idle cue: a slow ±3° swing (primitive 25) until the first scroll.
          gsap.to(t, { rotation: 3, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 1.6, id: "tag-idle" });
        }, 2.3);
        intro.play();
        const secret = q<HTMLElement>(".hero-secret")[0];
        const release = () => released.forEach((r) => r());
        secret?.addEventListener("pointerenter", release, { once: true });
        secret?.parentElement?.addEventListener("focusin", release, { once: true });
        q<HTMLElement>(".hero-cta a, .hero-cta button").forEach((b) => b.addEventListener("focus", release, { once: true }));
        gsap.delayedCall(isTouch() ? 4 : 3.2, release);
      };
      gsap.set(q(".hero-copy"), { autoAlpha: 0 });
      gsap.set(q(".cap-line"), { y: 0, yPercent: 105 });
      gsap.set([q(".hero-envelope"), q(".hero-tag")], { autoAlpha: 0 });
      if (revealed()) run();
      else window.addEventListener(REVEAL_EVENT, run, { once: true });

      /* ---------------- mouse parallax (one ticker callback) ---------------- */
      const target = { x: 0, y: 0 };
      const cur = { x: 0, y: 0 };
      const par = (Object.keys(PARALLAX) as (keyof typeof PARALLAX)[]).map((k) => ({ el: q(`.par-${k}`), amp: PARALLAX[k] }));
      const onMove = (e: PointerEvent) => {
        target.x = e.clientX / window.innerWidth - 0.5;
        target.y = e.clientY / window.innerHeight - 0.5;
      };
      const tick = () => {
        cur.x += (target.x - cur.x) * 0.06;
        cur.y += (target.y - cur.y) * 0.06;
        if (Math.abs(cur.x - target.x) < 0.0005 && Math.abs(cur.y - target.y) < 0.0005) return;
        par.forEach(({ el, amp }) => gsap.set(el, { x: -cur.x * amp * 2, y: -cur.y * amp * 2 }));
      };
      if (window.matchMedia(MQ.fine).matches) {
        window.addEventListener("pointermove", onMove, { passive: true });
        gsap.ticker.add(tick);
      }

      /* ---------------- scroll (pinned 140vh) ---------------- */
      const vw = () => window.innerWidth;
      const vh = () => window.innerHeight;
      const sV = () => cover(view, STAGE, FOCAL).s;
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "+=140%",
          pin: pin.current,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (self.progress > 0.001) gsap.getById("tag-idle")?.kill();
          },
        },
      });
      tl.addLabel("start", 0)
        // 0–.06: the tag swings harder, then retracts up its string.
        .to(q(".hero-tag"), { rotation: -12, duration: 0.03, ease: "sine.inOut" }, 0)
        .to(q(".hero-tag"), { rotation: 8, duration: 0.02, ease: "sine.inOut" }, 0.03)
        .to(q(".hero-tag-string"), { scaleY: 0, duration: 0.03, ease: "fold" }, 0.035)
        .to(q(".hero-tag-card"), { y: -48, autoAlpha: 0, duration: 0.03, ease: "fold" }, 0.035)
        // 0–.08: the whole text column (headline, sub, CTAs) drops back into its slots together
        // and fades, so it never sits half-gone over the art, and is clear before the arch opens.
        .to(q(".hero-copy"), { x: () => -0.04 * vw(), duration: 0.08 }, 0)
        .to(q(".hero-line, .hero-sub"), { yPercent: 125, stagger: 0.004, duration: 0.05, ease: "fold" }, 0)
        .to(q(".hero-cta > *"), { y: 90, duration: 0.05, ease: "fold" }, 0.01)
        .to(q(".hero-copy"), { autoAlpha: 0, duration: 0.03 }, 0.05)
        // .07–.22: push to full-bleed.
        .to(state, { push: 1, duration: 0.15, onUpdate: place }, 0.07)
        .to(q(".hero-strings"), { y: () => -0.2 * vh(), autoAlpha: 0, duration: 0.1 }, 0.08)
        .to(q(".mo-strip"), { autoAlpha: 0, duration: 0.02 }, 0.1)
        // .18–.32: the seal cracks free; the envelope slides away.
        .fromTo(q(".hero-envelope .seal-dock"), { y: 0 }, { y: 4, duration: 0.02, ease: "sine.in" }, 0.18)
        .add(flightTween(director, "D1", "D1h", 0.12), 0.2)
        .fromTo(q(".fleck"), { x: 0, y: 0, autoAlpha: 0, scale: 0.4 }, { x: (i) => Math.cos(i * 0.8) * (20 + (i % 4) * 12), y: (i) => Math.sin(i * 0.8) * (20 + (i % 3) * 14) + 30, autoAlpha: 1, scale: 1, duration: 0.05, ease: "paper", stagger: 0.002 }, 0.2)
        .to(q(".fleck"), { autoAlpha: 0, y: "+=40", duration: 0.04 }, 0.26)
        .to(q(".hero-envelope"), { y: () => 0.4 * vh(), duration: 0.1, ease: "fold" }, 0.22)
        // .25–.62: dolly into the party.
        .addLabel("dolly", 0.25)
        // The dolly lifts the sky: lanterns rise faster while the camera moves in.
        .to({ b: 0 }, { b: 1, duration: 0.2, onUpdate() { sky.current?.setBoost((this.targets()[0] as { b: number }).b); } }, 0.25)
        .to({ b: 1 }, { b: 0, duration: 0.17, onUpdate() { sky.current?.setBoost((this.targets()[0] as { b: number }).b); } }, 0.45)
        .to(q(".dolly-h1"), { scale: 1.12, duration: 0.37, ease: "camera" }, 0.25)
        .to(q(".dolly-h2"), { scale: 1.4, duration: 0.37, ease: "camera" }, 0.25)
        .to(q(".dolly-h3l"), { x: () => (-0.22 * vw()) / sV(), scale: 1.9, duration: 0.37, ease: "camera" }, 0.25)
        .to(q(".dolly-h3r"), { x: () => (0.22 * vw()) / sV(), scale: 1.9, duration: 0.37, ease: "camera" }, 0.25)
        .to(q(".dolly-h4"), { scale: 3.2, duration: 0.37, ease: "camera" }, 0.25)
        .to(q(".dolly-h5"), { scale: 5, y: () => (0.18 * vh()) / sV(), filter: "blur(10px)", duration: 0.3, ease: "camera" }, 0.25)
        .to(q(".dolly-h5"), { autoAlpha: 0, duration: 0.08 }, 0.47)
        .to(q(".jamb"), { autoAlpha: 0, duration: 0.05 }, 0.04)
        // .58–.64: the caption.
        .fromTo(q(".hero-caption .cap-line"), { y: 0, yPercent: 105, rotate: 2 }, { y: 0, yPercent: 0, rotate: 0, duration: 0.05, ease: "paper", stagger: 0.01 }, 0.54)
        .addLabel("rest", 0.64)
        // .74–1: into the paper.
        .to(q(".hero-caption .cap-line"), { y: 0, yPercent: -105, duration: 0.04, ease: "fold" }, 0.74)
        // 8× (brief: 14×): the delivered H-4 is 1586 px wide and pixelates beyond this; the kraft covers the rest.
        .to(q(".dolly-h4"), { scale: 8, duration: 0.2, ease: "camera" }, 0.76)
        .to(q(".dolly-h3l, .dolly-h3r, .dolly-h2, .dolly-h1"), { autoAlpha: 0, duration: 0.08 }, 0.8)
        .fromTo(q(".kraft"), { clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(75% at 50% 50%)", duration: 0.15, ease: "ink" }, 0.8)
        .fromTo(q(".kraft-img"), { scale: 1.15 }, { scale: 1, duration: 0.15, ease: "camera" }, 0.8)
        .fromTo(q(".cream"), { clipPath: "polygon(0% 0%, 0% 0%, 0% 0%)" }, { clipPath: "polygon(0% 0%, 220% 0%, 0% 220%)", duration: 0.05, ease: "ink" }, 0.95)
        .add(flightTween(director, "D1h", "D2", 0.08), 0.92)
        .addLabel("paper", 1);

      return () => {
        ScrollTrigger.removeEventListener("refreshInit", measure);
        window.removeEventListener("pointermove", onMove);
        gsap.ticker.remove(tick);
      };
    },
    { scope: section },
  );

  // Landing-only magnetic pull on the L CTA.
  const cta = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = cta.current?.querySelector<HTMLElement>(".btn");
    return b ? magnetic(b, b.querySelector<HTMLElement>(".btn-label")) : undefined;
  }, []);

  const layer = (cls: string, par: keyof typeof PARALLAX, dolly: string, id: Parameters<typeof Art>[0]["id"], extra?: React.CSSProperties, priority?: boolean) => (
    <div className={`par-${par} ${cls}`} style={{ position: "absolute", inset: 0 }}>
      <div className={dolly} style={{ position: "absolute", inset: 0, transformOrigin: `${FOCAL.x}px ${FOCAL.y}px`, ...extra }}>
        <Art id={id} sizes="(min-width:1024px) 60vw, 100vw" priority={priority} imgStyle={{ objectFit: "fill" }} />
      </div>
    </div>
  );

  return (
    <section ref={section} id="act-1" data-section-world="night" data-world="night" className="act1" aria-labelledby="hero-title">
      <div ref={pin} className="act1-pin">
        <div ref={archBox} className="act1-archbox" aria-hidden="true" />

        {/* Diorama A: sky, rooftops, guests, table */}
        <div ref={dioA} className="act1-dio" aria-hidden="true" data-cursor="media">
          <div ref={stageA} className="act1-stage">
            {layer("layer-h1", "h1", "dolly-h1", "H-1")}
            <div className="par-h1" style={{ position: "absolute", inset: 0 }}>
              <div className="dolly-h1" style={{ position: "absolute", inset: 0, transformOrigin: `${FOCAL.x}px ${FOCAL.y}px` }}>
                <SkyCanvas onReady={(h) => (sky.current = h)} />
              </div>
            </div>
            {layer("layer-h2", "h2", "dolly-h2", "H-2")}
            <div className="layer-h3" style={{ position: "absolute", inset: 0 }}>
              {layer("", "h3", "dolly-h3l", "H-3L")}
              {layer("", "h3", "dolly-h3r", "H-3R")}
            </div>
            {layer("layer-h4", "h4", "dolly-h4", "H-4", undefined, true)}
          </div>
          {/* The arch's inner jamb shadow keeps the headline overlap quiet. */}
          <div className="jamb" />
        </div>

        <svg ref={frame} className="act1-frame" aria-hidden="true">
          <path className="frame-shadow" fillRule="evenodd" fill="rgba(7,3,12,.55)" transform="translate(3 5)" />
          <path className="frame-paper" fillRule="evenodd" fill="var(--plum)" />
          <path className="frame-rule-1" fill="none" stroke="var(--gold)" strokeWidth="1" />
          <path className="frame-rule-2" fill="none" stroke="var(--gold)" strokeWidth="1" />
        </svg>

        {/* No JS: the same frame from CSS geometry alone (the one above is built from live measurements). */}
        <svg className="act1-frame-static" aria-hidden="true">
          <rect className="fs-band" />
          <rect className="fs-scallops" />
          <rect className="fs-sill" />
          <rect className="fs-rule fs-rule-1" />
          <rect className="fs-rule fs-rule-2" />
        </svg>

        <div className="hero-strings" aria-hidden="true">
          <svg viewBox="0 0 100 10" preserveAspectRatio="none">
            <path d="M-2,2 Q50,8 102,2" fill="none" stroke="var(--twine)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          </svg>
          {[0, 2, 4].map((c, i) => (
            <span key={c} className="hero-string-lantern" style={{ left: `calc(var(--margin) + ${c} * (var(--col) + var(--gutter)) + var(--col) / 2)` }}>
              <span style={{ display: "block", width: 1, height: [22, 38, 16][i], background: "var(--twine)", margin: "0 auto" }} />
              <Lantern width={20} flicker />
            </span>
          ))}
        </div>

        <div className="hero-copy grid-page">
          <h1 id="hero-title" className="hero-title">
            <span className="hero-slot">
              <span className="hero-line">{copy.hero.lines[0]}</span>
            </span>
            <span className="hero-slot hero-line-2">
              <span className="hero-line">{copy.hero.lines[1]}</span>
            </span>
            <span className="hero-slot">
              <span className="hero-line">
                {copy.hero.lines[2]} <em className="hero-secret type-word">{copy.hero.secret}</em>.
              </span>
            </span>
          </h1>
          <div className="hero-sub-slot">
            <p className="hero-sub type-body-l">{copy.hero.sub}</p>
          </div>
          <div ref={cta} className="hero-cta">
            <span>
              <Button href="/pass" size="L">
                {copy.cta.pass}
              </Button>
            </span>
            <span>
              <TextLink
                href="#act-4"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToTarget(lenis, "#act-4", 1.6);
                }}
              >
                {copy.cta.howItWorks}
              </TextLink>
            </span>
          </div>
        </div>

        {/* Diorama B: marigolds pass in front of the headline */}
        <div ref={dioB} className="act1-dio act1-front" aria-hidden="true">
          <div ref={stageB} className="act1-stage">
            {layer("layer-h5", "h5", "dolly-h5", "H-5")}
          </div>
        </div>

        <div className="hero-envelope">
          <Envelope />
          <SealDock id="D1" size={64} className="hero-seal" />
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="fleck" style={{ width: 6 + (i % 4) * 2, height: 6 + ((i + 1) % 3) * 3 }} aria-hidden="true" />
          ))}
          <span className="hero-tag" aria-hidden="true">
            <span className="hero-tag-string" />
            <span className="hero-tag-card type-mono">{copy.hero.cue}</span>
          </span>
        </div>

        <SealDock id="D1h" size={72} className="hero-hover-dock" />

        <p className="hero-caption type-h2" aria-hidden="true">
          <span className="cap-slot">
            <span className="cap-line">{copy.hero.caption}</span>
          </span>
        </p>

        {/* Into the paper: kraft from the parcel, then the cream page that is Act 2 */}
        <div className="kraft" aria-hidden="true">
          <div className="kraft-img" />
        </div>
        <div className="cream" aria-hidden="true">
          <div className="grid-page act2-intro-echo">
            <p className="type-display-l" style={{ gridColumn: "1 / -1" }}>
              <span className="cap-slot">
                <span className="slot-in">{copy.act2.intro[0]}</span>
              </span>
              <br />
              <span className="cap-slot">
                <span className="slot-in">{copy.act2.intro[1]}</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
