"use client";
/**
 * Act 4 · How Kitty throws a party (brief 11, Act 4). Night. Pinned 680vh, scrub 1.2.
 * The centrepiece: one Night of a real party, with the SDK's numbers.
 *
 *   enter · chip-in (the seal stamps every chit) · the Draw · takes the kitty · keepsafe ·
 *   missed · waterfall · farewell · pull away into the party emblem.
 *
 * Money rule: each chapter's ledger lines are in the DOM, readable, the moment the chapter
 * begins; motion follows. The title and ledger are real text; the table is decorative.
 */
import { useLayoutEffect, useRef, useState } from "react";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import "@kitty/ui/motion/motionPath";
import { MQ, prefersReducedMotion, useReducedMotion } from "@kitty/ui/motion/reduced";
import { Chit } from "@kitty/ui/components/Chit";
import { LedgerSlip } from "@kitty/ui/components/Ledger";
import { TwineRail } from "@kitty/ui/components/TwineRail";
import { Emblem } from "@kitty/ui/generators/emblem";
import { Mask } from "@kitty/ui/generators/mask";
import { KittyParcel } from "@/components/stage/Props";
import { Table, seatPoint } from "@/components/stage/Table";
import { SealDock, flightTween, useSealDirector } from "@/components/chrome/SealDirector";
import { copy, t } from "@/copy/en";
import { CHAPTERS, GUESTS, TAKER_SEAT, TRADITION, X, chapterAt } from "./act4Data";

const N = GUESTS.length;
const GLYPHS = "▓▒░◆◇●○";

/** A reversible scramble: the text at progress p (0 = all glyphs, 1 = resolved). */
function scrambleAt(target: string, p: number) {
  const settled = Math.floor(p * target.length * 1.1);
  const tick = Math.floor(p * 18);
  return target
    .split("")
    .map((ch, i) => (ch === " " || i < settled ? ch : GLYPHS[(tick * 5 + i * 3) % GLYPHS.length]))
    .join("");
}

function useTableSize() {
  const [s, setS] = useState({ D: 520, mobile: false });
  useLayoutEffect(() => {
    const on = () => {
      const mobile = window.matchMedia(MQ.mobile).matches;
      const w = document.documentElement.clientWidth;
      const h = window.innerHeight;
      // D = min(40vw, 56svh) on desktop (brief: min(50vw, 72svh); see STORYBOARD §2), 84vw on phones.
      const D = mobile ? Math.min(w * 0.8, h * 0.42) : Math.min(w * 0.32, h * 0.5);
      setS((prev) => (Math.abs(prev.D - D) < 1 && prev.mobile === mobile ? prev : { D, mobile }));
    };
    on();
    // The layout viewport can settle after first paint (mobile meta viewport): watch the root box too.
    const ro = new ResizeObserver(on);
    ro.observe(document.documentElement);
    window.addEventListener("resize", on);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", on);
    };
  }, []);
  return s;
}

export function Act4Party() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const { D, mobile } = useTableSize();
  const [ch, setCh] = useState(0);
  const [night, setNight] = useState(3);
  const director = useSealDirector();
  const chapter = CHAPTERS[ch];

  const seat4 = seatPoint(TAKER_SEAT, N, D);
  const slot = (i: number) => seatPoint(i, N, D, 0.3);
  const parcelAt = { x: D / 2 + 0.17 * D, y: D / 2 - 0.12 * D };
  const envAt = seatPoint(TAKER_SEAT, N, D, 0.22);
  const chitW = Math.max(44, 0.1 * D);
  const miss = slot(TAKER_SEAT);

  useGSAP(
    () => {
      const q = gsap.utils.selector(section);
      if (prefersReducedMotion()) {
        director.set("D3", "D4a", 1);
        director.set("D4a", "D4b", 1);
        setCh(CHAPTERS.length - 1);
        return;
      }
      const at = (id: string) => CHAPTERS.find((c) => c.id === id)!.at;

      // Initial states (titles: GSAP owns the transform from here).
      q<HTMLElement>(".ch-title").forEach((el, i) => {
        gsap.set(el, { clearProps: "transform" });
        if (i > 0) gsap.set(el, { yPercent: 105 });
      });
      gsap.set(q(".mchit"), { scale: 0, autoAlpha: 0 });
      gsap.set(q(".mchit-stamp"), { autoAlpha: 0 });
      gsap.set(q(".act4-parcel"), { scale: 0, autoAlpha: 0 });
      gsap.set(q(".draw-chit"), { autoAlpha: 0 });
      gsap.set(q(".ks-env, .ks-slice, .miss-chit, .fw-page, .act4-inset, .act4-emblem, .stream-label"), { autoAlpha: 0 });
      gsap.set(q(".fw-stamp"), { autoAlpha: 0 });
      gsap.set(q(".stream"), { drawSVG: "0%" });
      gsap.set(q(".grace-arc"), { drawSVG: "0%" });
      gsap.set(q(".seat-glow"), { autoAlpha: 0 });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "+=680%",
          pin: pin.current,
          scrub: 1.2,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          // No snapping (owner, Oct 1): the story moves exactly with the scroll so no chapter is ever jumped.
          onUpdate: (self) => {
            const p = self.progress;
            setCh(chapterAt(p));
            const w = CHAPTERS.find((c) => c.id === "waterfall")!;
            if (p < at("keepsafe")) setNight(3);
            else if (p < at("missed")) setNight(4);
            else if (p < w.at) setNight(5);
            else setNight(Math.min(9, 5 + Math.floor(((p - w.at) / (w.end - 0.04 - w.at)) * 5)));
          },
        },
      });
      // Snap points sit where each chapter is fully readable (title in, motion done), not at its first frame.
      [0.02, 0.145, 0.27, 0.385, 0.505, 0.605, 0.775, 0.935, 1].forEach((v, i) => tl.addLabel(`read-${i}`, v));

      // Chapter titles: the outgoing block drops into its slot as the next rises.
      CHAPTERS.forEach((c, i) => {
        const el = q(`.ch-title[data-ch="${i}"]`);
        if (i > 0) tl.fromTo(el, { yPercent: 105 }, { yPercent: 0, duration: 0.02, ease: "paper" }, c.at + 0.002);
        if (i < CHAPTERS.length - 1) tl.to(el, { yPercent: -105, duration: 0.012, ease: "fold" }, CHAPTERS[i + 1].at - 0.006);
      });

      // enter: the table settles; the seal arrives from Act 3 as the stamp.
      tl.fromTo(q(".act4-tilt"), { rotationX: 14, scale: 1.06 }, { rotationX: 0, scale: 1, duration: 0.04, ease: "camera" }, 0)
        .add(flightTween(director, "D3", "D4a", 0.04), 0);

      // chip-in: ten chits appear clockwise; the seal hops seat to seat, stamping each.
      const chits = q<HTMLElement>(".mchit");
      tl.to(chits, { scale: 1, autoAlpha: 1, duration: 0.008, ease: "stamp", stagger: 0.0015 }, 0.045);
      const stamper = q(".act4-stamper")[0];
      chits.forEach((chit, i) => {
        const s = slot(i);
        const t0 = 0.058 + i * 0.0068;
        tl.to(stamper, { x: s.x, y: s.y - chitW * 0.35, duration: 0.004, ease: "paper" }, t0)
          .to(stamper, { scale: 0.82, duration: 0.0012, ease: "power2.in" }, t0 + 0.0042)
          .to(stamper, { scale: 1, duration: 0.0012, ease: "paper" }, t0 + 0.0054)
          .fromTo(chit.querySelector(".mchit-stamp"), { autoAlpha: 0, scale: 1.4, rotation: 0 }, { autoAlpha: 1, scale: 1, rotation: -8, duration: 0.0016, ease: "stamp" }, t0 + 0.0045);
      });
      // The chits fly into a stack and fold into the kitty parcel.
      tl.to(stamper, { x: parcelAt.x + D * 0.1, y: parcelAt.y - D * 0.12, duration: 0.008, ease: "camera" }, 0.127);
      chits.forEach((chit, i) => {
        const s = slot(i);
        tl.to(chit, { x: parcelAt.x - s.x, y: parcelAt.y - s.y - i * 1.2, rotation: (i % 3) - 1, duration: 0.01, ease: "camera" }, 0.125 + i * 0.0006);
      });
      tl.to(chits, { scale: 0.4, autoAlpha: 0, duration: 0.004 }, 0.137)
        .to(q(".act4-parcel"), { scale: 1, autoAlpha: 1, duration: 0.006, ease: "stamp" }, 0.136);

      // the Draw: folded name-chits orbit the bowl; one rises, unfolds, names the guest.
      const names = q<HTMLElement>(".nchit");
      const orbit = { t: 0 };
      tl.to(
        orbit,
        {
          t: 1,
          duration: 0.07,
          onUpdate: () => {
            names.forEach((n, i) => {
              const speed = 0.8 + ((i * 37) % 50) / 100;
              const a = i * 0.9 + orbit.t * Math.PI * 3 * speed;
              gsap.set(n, { x: Math.cos(a) * D * (0.035 + (i % 3) * 0.012), y: Math.sin(a) * D * (0.02 + (i % 2) * 0.012), rotation: (a * 57) % 30 });
            });
          },
        },
        0.17,
      );
      const drawn = q(".draw-chit")[0];
      tl.set(drawn, { autoAlpha: 1, y: 0 }, 0.222)
        .to(drawn, { y: -0.22 * D, duration: 0.014, ease: "camera" }, 0.222)
        .to(drawn.querySelector(".chit-right"), { rotationY: 0, duration: 0.012, ease: "fold" }, 0.238)
        .to(drawn.querySelector(".chit-back"), { rotationY: 180, duration: 0.012, ease: "fold" }, 0.238);
      const nameEls = drawn.querySelectorAll<HTMLElement>(".type-word");
      const reveal = { p: 0 };
      tl.to(reveal, { p: 1, duration: 0.014, onUpdate: () => nameEls.forEach((n) => (n.textContent = scrambleAt(X.taker, reveal.p))) }, 0.25);
      tl.to(q(`[data-seat-lantern="${TAKER_SEAT}"]`), { autoAlpha: 1, duration: 0.01, ease: "lantern" }, 0.258);

      // takes the kitty: the parcel arcs to seat 4 (the ledger is already showing).
      tl.to(drawn, { autoAlpha: 0, y: -0.3 * D, duration: 0.01 }, 0.3);
      tl.to(q(".act4-parcel"), { motionPath: { path: [{ x: 0, y: 0 }, { x: (seat4.x - parcelAt.x) * 0.5, y: -0.14 * D }, { x: (seat4.x - parcelAt.x) * 0.72, y: (seat4.y - parcelAt.y) * 0.72 }], curviness: 1.2 }, scale: 0.8, duration: 0.065, ease: "camera" }, 0.302);

      // keepsafe: a slice folds into an envelope; the seal seals it; $50 comes back.
      tl.fromTo(q(".ks-env"), { autoAlpha: 0, scale: 0.3, x: (seat4.x - envAt.x) * 0.3, y: -0.05 * D }, { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: 0.02, ease: "fold" }, 0.415)
        .to(q(".act4-parcel"), { scale: 0.68, duration: 0.02, ease: "fold" }, 0.415)
        .add(flightTween(director, "D4a", "D4b", 0.035), 0.44)
        .fromTo(q(".ks-env .seal-crack").slice(0, 1), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.008 }, 0.485)
        .fromTo(q(".ks-slice"), { autoAlpha: 0, x: 0, y: 0, scale: 0.6 }, { autoAlpha: 1, x: seat4.x - envAt.x, y: seat4.y - envAt.y - 0.06 * D, scale: 1, duration: 0.02, ease: "paper", immediateRender: false }, 0.492)
        .to(q(".ks-slice"), { autoAlpha: 0, duration: 0.006 }, 0.514);

      // missed: seat 4's chit stays blank; the lantern dims while grace hours tick.
      tl.fromTo(q(".miss-chit"), { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.01, ease: "stamp" }, 0.525)
        .to(q(`[data-seat-lantern="${TAKER_SEAT}"]`), { autoAlpha: 0.28, duration: 0.07, ease: "lantern" }, 0.54)
        .to(q(".grace-arc"), { drawSVG: "0% 88%", duration: 0.07, ease: "lantern" }, 0.54);

      // waterfall: the keepsafe covers first; the ledger carries the plus-ones and House Fund lines.
      tl.to(q(".stream-keep"), { drawSVG: "100%", duration: 0.04, ease: "ink" }, 0.632)
        .to(q(".ks-env"), { scale: 0.72, autoAlpha: 0.55, duration: 0.02 }, 0.668)
        .to(q(".stream-label-keep"), { autoAlpha: 1, duration: 0.01 }, 0.655)
        .to(q(".miss-chit .mchit-stamp"), { autoAlpha: 1, duration: 0.004 }, 0.738)
        .fromTo(q(".act4-inset"), { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.02, ease: "paper" }, 0.705);

      // farewell: seats glow; Diary pages slide out, clockwise, and get stamped (not seat 4's).
      tl.to(q(".stream, .stream-label, .grace-arc"), { autoAlpha: 0, duration: 0.015 }, 0.8)
        .to(q(".seat-glow"), { autoAlpha: 1, duration: 0.03, ease: "lantern", stagger: 0.002 }, 0.8)
        .to(q(".act4-inset"), { autoAlpha: 0, duration: 0.01 }, 0.8);
      q<HTMLElement>(".fw-page").forEach((pg, i) => {
        tl.fromTo(pg, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.012, ease: "paper" }, 0.815 + i * 0.005);
        const st = pg.querySelector(".fw-stamp");
        if (st) tl.fromTo(st, { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: 0.004, ease: "stamp" }, 0.86 + i * 0.006);
      });

      // pull away: the table shrinks and turns into the party emblem (Act 5's door ornament).
      tl.to(q(".act4-tilt"), { scale: 240 / D, rotation: 40, autoAlpha: 0, duration: 0.045, ease: "camera" }, 0.945)
        .fromTo(q(".act4-emblem"), { autoAlpha: 0, scale: 0.8, rotation: -30 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.04, ease: "camera" }, 0.955)
        .to(q(".act4-rail"), { autoAlpha: 0, duration: 0.02 }, 0.94)
        .to(q(".act4-ledger, .act4-titles"), { autoAlpha: 0, duration: 0.02 }, 0.97);
    },
    { scope: section, dependencies: [D], revertOnUpdate: true },
  );

  // Mobile: the ledger sheet expands at "takes" and "waterfall".
  const expanded = mobile && !!chapter.expand;
  const reduce = useReducedMotion();
  if (reduce) return <Act4Static />;

  return (
    <section ref={section} id="act-4" data-section-world="night" data-world="night" className="act4" aria-labelledby="act4-title">
      <h2 id="act4-title" className="sr-only">
        {copy.act4.title}
      </h2>
      <div ref={pin} className="act4-pin">
        <div className="act4-titles" aria-live="polite">
          {CHAPTERS.map((c, i) => (
            <div key={c.id} className="ch-slot" aria-hidden={i !== ch}>
              <div className="ch-title" data-ch={i} style={{ transform: i === 0 ? undefined : "translateY(105%)" }}>
                <h3 className="type-h1">
                  {c.title.includes(X.taker)
                    ? c.title.split(X.taker).flatMap((part, k) => (k === 0 ? [part] : [<em key={k} className="type-word">{X.taker}</em>, part]))
                    : c.title}
                </h3>
                <p className="type-body-l" style={{ color: "var(--moon-soft)", marginTop: 12 }}>
                  {c.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="act4-stage" style={{ width: D, height: D }}>
          <div className="act4-tilt" style={{ position: "absolute", inset: 0, transformPerspective: 1200, transformOrigin: "50% 50%" } as React.CSSProperties}>
            <Table
              D={D}
              guests={GUESTS}
              tradition={TRADITION}
              litSeat={null}
              bowl={
                <div style={{ position: "relative", width: 0.22 * D, height: 0.22 * D }}>
                  <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
                    <circle cx="51" cy="53" r="47" fill="rgba(7,3,12,.28)" />
                    <circle cx="50" cy="50" r="46" fill="#E9A21E" />
                    <circle cx="50" cy="50" r="42" fill="#7A1F3D" />
                    <circle cx="50" cy="50" r="38" fill="#4A0F24" />
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#C8A04A" strokeWidth=".8" />
                  </svg>
                  {Array.from({ length: N }, (_, i) => (
                    <span key={i} className="nchit" style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -0.035 * D, marginTop: -0.022 * D }}>
                      <Chit width={0.07 * D} state="folded" />
                    </span>
                  ))}
                </div>
              }
            >
              {/* seat glows (farewell) */}
              {GUESTS.map((_, i) => {
                const p = seatPoint(i, N, D);
                return <span key={`g${i}`} className="seat-glow" style={{ position: "absolute", left: p.x - 0.12 * D, top: p.y - 0.14 * D, width: 0.24 * D, height: 0.24 * D, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,210,122,.45), rgba(255,210,122,0) 68%)", mixBlendMode: "screen" }} />;
              })}
              {/* money chits */}
              {GUESTS.map((_, i) => {
                const s = slot(i);
                return (
                  <span key={`m${i}`} className="mchit" style={{ position: "absolute", left: s.x - chitW / 2, top: s.y - (chitW * 56) / 88 / 2 }}>
                    <Chit width={chitW}>{`$${X.chipIn / 1e6}`}</Chit>
                    <svg className="mchit-stamp" viewBox="0 0 40 40" width={chitW * 0.42} height={chitW * 0.42} style={{ position: "absolute", right: -chitW * 0.1, top: -chitW * 0.14, filter: "url(#ink)" }} aria-hidden="true">
                      <circle cx="20" cy="20" r="17" fill="none" stroke="var(--teal-night)" strokeWidth="2.4" />
                      <path d="M12 20.5l5 5 10-10.5" fill="none" stroke="var(--teal-night)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                );
              })}
              {/* the parcel */}
              <span className="act4-parcel" style={{ position: "absolute", left: parcelAt.x - 0.08 * D, top: parcelAt.y - 0.075 * D }}>
                <KittyParcel size={0.16 * D} />
              </span>
              {/* the drawn chit */}
              <span className="draw-chit" style={{ position: "absolute", left: D / 2 - 0.08 * D, top: D / 2 - 0.05 * D }}>
                <Chit width={0.16 * D} face="name" state="folded">
                  {""}
                </Chit>
              </span>
              {/* the stamp: the seal itself (D4a) */}
              <span className="act4-stamper" style={{ position: "absolute", left: 0, top: 0, translate: "-50% -50%", transform: `translate(${slot(0).x}px, ${slot(0).y}px)` }}>
                <SealDock id="D4a" size={48} />
              </span>
              {/* keepsafe envelope, sealed by D4b */}
              <span className="ks-env" style={{ position: "absolute", left: envAt.x - 0.07 * D, top: envAt.y - 0.045 * D, width: 0.14 * D, height: 0.09 * D }}>
                <svg viewBox="0 0 140 90" width="100%" height="100%" aria-hidden="true">
                  <rect x="2" y="2" width="136" height="86" rx="2" fill="#C9A57A" />
                  <path d="M2,4 L70,52 L138,4" fill="none" stroke="#8C6A45" strokeWidth="2" />
                </svg>
                <SealDock id="D4b" size={Math.max(24, 0.06 * D)} cracked={0} style={{ position: "absolute", left: "50%", top: "55%", translate: "-50% -50%" }} />
              </span>
              <span className="ks-slice" style={{ position: "absolute", left: envAt.x - 0.035 * D, top: envAt.y - 0.02 * D, padding: "2px 6px", background: "#C9A57A", color: "var(--ink)", borderRadius: 1, boxShadow: "var(--d1)", fontSize: Math.max(11, 0.024 * D) }}>
                <span className="type-money">{`$${X.take.releasePerChipIn / 1e6}`}</span>
              </span>
              {/* missed chit + grace ring at seat 4 */}
              <span className="miss-chit" style={{ position: "absolute", left: miss.x - chitW / 2, top: miss.y - (chitW * 56) / 88 / 2 }}>
                <Chit width={chitW} />
                <svg className="mchit-stamp" viewBox="0 0 40 40" width={chitW * 0.42} height={chitW * 0.42} style={{ position: "absolute", right: -chitW * 0.1, top: -chitW * 0.14, opacity: 0, filter: "url(#ink)" }} aria-hidden="true">
                  <circle cx="20" cy="20" r="17" fill="none" stroke="var(--lantern)" strokeWidth="2.4" />
                  <path d="M12 20.5l5 5 10-10.5" fill="none" stroke="var(--lantern)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <svg className="act4-overlay-svg" width={D} height={D * 1.2} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} aria-hidden="true">
                <circle className="grace-arc" cx={seat4.x} cy={seat4.y - 0.03 * D} r={0.1 * D} fill="none" stroke="var(--grace)" strokeWidth="3" strokeLinecap="round" transform={`rotate(-90 ${seat4.x} ${seat4.y - 0.03 * D})`} style={{ filter: "brightness(1.6)" }} />
                <path className="stream stream-keep" d={`M${envAt.x},${envAt.y} Q${(envAt.x + miss.x) / 2 - 0.05 * D},${(envAt.y + miss.y) / 2 - 0.08 * D} ${miss.x},${miss.y}`} fill="none" stroke="#C9A57A" strokeWidth={2.5} strokeLinecap="round" />
              </svg>
              <span className="stream-label stream-label-keep type-mono" style={{ position: "absolute", left: envAt.x - 0.34 * D, top: envAt.y - 0.2 * D, fontSize: 11 }}>
                keepsafe {`$${X.cover.fromKeepsafe / 1e6}`}
              </span>
              {/* farewell pages */}
              {GUESTS.map((_, i) => {
                const p = seatPoint(i, N, D, 0.3);
                return (
                  <span key={`fw${i}`} className="fw-page" style={{ position: "absolute", left: p.x - 0.045 * D, top: p.y - 0.06 * D, width: 0.09 * D, height: 0.12 * D, background: "var(--paper)", borderRadius: 1, boxShadow: "var(--d1)" }}>
                    {i !== TAKER_SEAT && (
                      <svg className="fw-stamp" viewBox="0 0 40 40" width="90%" height="90%" style={{ position: "absolute", left: "5%", top: "10%", filter: "url(#ink)" }} aria-hidden="true">
                        <circle cx="20" cy="20" r="16" fill="none" stroke="var(--plum)" strokeWidth="2.2" />
                        <circle cx="20" cy="20" r="12.5" fill="none" stroke="var(--plum)" strokeWidth="1" />
                        <text x="20" y="22.5" textAnchor="middle" fill="var(--plum)" style={{ font: "600 5.5px var(--font-sans)", letterSpacing: ".06em" }}>
                          FAREWELL
                        </text>
                      </svg>
                    )}
                  </span>
                );
              })}
            </Table>
          </div>
          <div className="act4-emblem" style={{ position: "absolute", left: D / 2 - 120, top: D / 2 - 120 }} aria-hidden="true">
            <Emblem partyId="act4-party" guests={N} tradition={TRADITION} size={240} />
          </div>
          <div className="act4-rail" style={{ position: "absolute", left: D * 0.05, top: D * 1.2, width: D * 0.9 }}>
            <TwineRail count={N} active={night} done={Array.from({ length: night }, (_, i) => i)} labels={GUESTS.map((_, i) => `N${i + 1}`)} height={40} />
            <span className="sr-only">
              Night {night + 1} of {N}
            </span>
          </div>
        </div>

        <div className={`act4-ledger ${expanded ? "is-expanded" : ""}`}>
          <LedgerSlip title={`Night ${chapter.id === "farewell" ? X.guests : night + 1} of ${X.guests}`} lines={chapter.lines} />
          <div className="act4-inset" data-world="night">
            <span className="type-label" style={{ color: "var(--moon-soft)", fontSize: 11 }}>
              {t(copy.act4.inset.label, { name: X.taker })}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
              <Mask colour={GUESTS[TAKER_SEAT].colour} animal={GUESTS[TAKER_SEAT].animal} tradition={TRADITION} width={56} />
              <p className="type-body" style={{ color: "var(--moon)" }}>
                {copy.status.onHold}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* No JS: the reduced-motion frames (every ledger line) instead of the unplayed scene. */}
      <noscript>
        <div className="act4-static">
          <Act4StaticBody />
        </div>
      </noscript>
    </section>
  );
}


/** Reduced motion (brief Act 4): the chapters as stacked, static frames with their ledgers. */
function Act4StaticBody() {
  return (
    <div className="grid-page" style={{ paddingBlock: "clamp(96px, 12vw, 192px)", rowGap: 48 }}>
      <h2 id="act4-title-static" className="type-display-l" style={{ gridColumn: "1 / -1" }}>
        {copy.act4.title}
      </h2>
      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center" }}>
        <Table D={Math.min(520, 360)} guests={GUESTS} tradition={TRADITION} litSeat={TAKER_SEAT} />
      </div>
      {CHAPTERS.slice(1).map((c) => (
        <article key={c.id} className="act4-static-frame" style={{ gridColumn: "1 / -1", display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", alignItems: "start" }}>
          <div>
            <h3 className="type-h1">{c.title}</h3>
            <p className="type-body-l" style={{ color: "var(--moon-soft)", marginTop: 12 }}>
              {c.body}
            </p>
          </div>
          <LedgerSlip lines={c.lines} rotate={0} title={`Night ${c.id === "farewell" ? X.guests : c.night + 1} of ${X.guests}`} />
        </article>
      ))}
    </div>
  );
}

function Act4Static() {
  return (
    <section id="act-4" data-section-world="night" data-world="night" className="act4-static" aria-labelledby="act4-title-static">
      <Act4StaticBody />
    </section>
  );
}
