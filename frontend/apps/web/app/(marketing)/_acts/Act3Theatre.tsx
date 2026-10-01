"use client";
/**
 * Act 3 · Where parties break (brief 11, Act 3). A paper theatre (S-1), three scenes, set
 * changes between them. Each: title and flats roll on → the action → a stat stamp lands
 * and "Kitty's fix" slides in → rest → the flats roll off.
 *   1 · the early taker walks off with the parcel; their chair tips back.
 *   2 · the host gathers the kitty; the back wall tears open onto Night; the world flips.
 *   3 · a stamped ledger; the ink drains off; the seal lands on the fix (D3).
 * Figures and flats are code-drawn cut paper inside the proscenium.
 */
import { useRef } from "react";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { stamp } from "@kitty/ui/motion/primitives/physical";
import { prefersReducedMotion, useReducedMotion, snapOff } from "@kitty/ui/motion/reduced";
import { Stamp } from "@kitty/ui/components/Stamp";
import { Mask } from "@kitty/ui/generators/mask";
import { tornEdge } from "@kitty/ui/paper/tornEdge";
import { Art } from "@/components/Art";
import { SealDock, flightTween, useSealDirector } from "@/components/chrome/SealDirector";
import { KittyParcel } from "@/components/stage/Props";
import { copy } from "@/copy/en";

const S = copy.act3.scenes;
const FN = [1, 0, 2];

/** A seated guest, front view behind the table: cut-paper silhouette, mask, arms on the cloth. */
function Sitter({ x, colour, animal, cls, tall }: { x: number; colour: number; animal: number; cls?: string; tall?: boolean }) {
  const k = tall ? 1.16 : 1;
  return (
    <g className={cls} transform={`translate(${x} 332)`}>
      <g transform={`scale(${k}) translate(0 -332)`}>
        <path d="M-26,188 C-26,164 26,164 26,188 L22,214 C14,204 -14,204 -22,214 Z" fill="var(--silhouette-hair)" />
        <ellipse cx="0" cy="220" rx="17" ry="21" fill="var(--plum)" />
        <rect x="-7" y="236" width="14" height="20" fill="var(--plum)" />
        <path d="M-36,332 C-38,292 -32,264 -14,254 L14,254 C32,264 38,292 36,332 Z" fill="var(--plum)" />
        <path d="M-35,300 L35,300 L35.6,308 L-35.6,308 Z" fill="#C8A04A" opacity=".45" />
        <path d="M-34,276 C-46,296 -42,322 -26,332 L-12,332 C-26,320 -28,300 -22,284 Z" fill="#3A1840" />
        <path d="M34,276 C46,296 42,322 26,332 L12,332 C26,320 28,300 22,284 Z" fill="#3A1840" />
        <foreignObject x="-29" y="198" width="58" height="40">
          <Mask colour={colour} animal={animal} tradition="kitty" width={58} />
        </foreignObject>
      </g>
    </g>
  );
}

/** A chair back behind a seat (it tips back when the early taker walks out). */
function Chair({ x, cls }: { x: number; cls?: string }) {
  return (
    <g className={cls} transform={`translate(${x} 0)`}>
      <path d="M-34,238 h68 v9 h-68 Z M-32,247 h7 v85 h-7 Z M25,247 h7 v85 h-7 Z M-25,262 h50 v5 h-50 Z" fill="#8C6A45" />
    </g>
  );
}

function Flats() {
  return (
    <>
      <g className="flat flat-l" aria-hidden="true">
        <path d="M0,0 L120,0 L120,40 C100,60 100,90 120,110 L120,600 L0,600 Z" fill="#7A1F3D" />
        <path d="M0,0 L96,0 L96,32 C80,50 80,80 96,98 L96,600 L0,600 Z" fill="#4A0F24" opacity=".6" />
        {[140, 260, 380, 500].map((y) => (
          <circle key={y} cx="48" cy={y} r="14" fill="#C8A04A" opacity=".85" />
        ))}
      </g>
      <g className="flat flat-r" aria-hidden="true">
        <path d="M1000,0 L880,0 L880,40 C900,60 900,90 880,110 L880,600 L1000,600 Z" fill="#7A1F3D" />
        <path d="M1000,0 L904,0 L904,32 C920,50 920,80 904,98 L904,600 L1000,600 Z" fill="#4A0F24" opacity=".6" />
        {[140, 260, 380, 500].map((y) => (
          <circle key={y} cx="952" cy={y} r="14" fill="#C8A04A" opacity=".85" />
        ))}
      </g>
    </>
  );
}

/** Reduced motion, and (inside <noscript>) no JS: the three scenes as plain end frames. */
function Act3StaticBody() {
  return (
    <div className="grid-page" style={{ paddingBlock: "clamp(96px, 12vw, 192px)", rowGap: 48 }}>
      {S.map((s, i) => (
        <article key={i} style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 className="type-h1">{s.title}</h2>
          {"stamp" in s && s.stamp && <Stamp label={s.stamp} sub={`${s.stampNote} ${FN[i] ? "" : ""}`} ink="saffron" style={{ alignSelf: "flex-start" }} />}
          <div className="a3-slip-static">
            <span className="type-label">{copy.act3.fixLabel}</span>
            <p className="type-body">{s.fix}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function Act3Static() {
  return (
    <section id="act-3" data-section-world="paper" data-world="paper" className="act3-static">
      <Act3StaticBody />
    </section>
  );
}

export function Act3Theatre() {
  const section = useRef<HTMLElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const director = useSealDirector();
  const reduce = useReducedMotion();
  const tear = tornEdge({ width: 600, depth: 14, seed: 23, jitter: 10, stepMin: 16, stepMax: 26 });
  // A vertical tear down the back wall, from the generator's points.
  const tearPath = `M500,0 ${tear.points.map(([x, y]) => `L${500 + (y - 7) * 2.2},${(x / 600) * 520}`).join(" ")}`;

  useGSAP(
    () => {
      if (prefersReducedMotion()) {
        director.set("D2", "D3", 1);
        return;
      }
      const q = gsap.utils.selector(section);
      // Waiting cards sit a full card height plus a margin outside their slot: a slot is only as
      // tall as its own card, so a shorter card peeking over the slot padding would cross a
      // longer title (three lines at wide viewports).
      gsap.set(q(".a3-title"), { yPercent: 100, y: 40 });
      gsap.set(q(".flat-l"), { xPercent: -100 });
      gsap.set(q(".flat-r"), { xPercent: 100 });
      gsap.set(q(".a3-stamp, .a3-slip"), { autoAlpha: 0 });
      gsap.set(q(".scene"), { autoAlpha: 0 });
      gsap.set(q(".tear-line"), { drawSVG: "0%", autoAlpha: 0 });
      gsap.set(q(".scene-3 .ink-mask-rect"), { attr: { height: 0 } });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "+=330%",
          pin: pin.current,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          snap: snapOff() ? undefined : { snapTo: "labelsDirectional", duration: { min: 0.25, max: 0.7 }, delay: 0.08, ease: "paper" },
          onUpdate: (self) => {
            if (!self.isActive) return;
            const night = self.progress > 0.333 + 0.36 * 0.333 && self.progress < 0.667;
            window.dispatchEvent(new CustomEvent("kitty:world", { detail: night ? "night" : "paper" }));
          },
          onLeave: () => window.dispatchEvent(new CustomEvent("kitty:world", { detail: "night" })),
          onLeaveBack: () => window.dispatchEvent(new CustomEvent("kitty:world", { detail: "paper" })),
        },
      });

      for (let i = 0; i < 3; i++) {
        const t0 = i / 3;
        const L = (v: number) => t0 + v / 3;
        const sc = q(`.scene-${i + 1}`);
        tl.addLabel(`scene-${i + 1}`, L(0.72))
          .set(sc, { autoAlpha: 1 }, L(0))
          .to(q(".flat-l"), { xPercent: 0, duration: 0.1 / 3, ease: "camera" }, L(0))
          .to(q(".flat-r"), { xPercent: 0, duration: 0.1 / 3, ease: "camera" }, L(0))
          .to(q(`.a3-title[data-s="${i}"]`), { yPercent: 0, y: 0, duration: 0.08 / 3, ease: "paper" }, L(0.01))
          .fromTo(q(`.a3-stamp[data-s="${i}"]`), { autoAlpha: 0, scale: 1.4, rotation: 0 }, { autoAlpha: 1, scale: 1, rotation: -6, duration: 0.04 / 3, ease: "stamp", immediateRender: false }, L(0.6))
          .fromTo(q(`.a3-slip[data-s="${i}"]`), { autoAlpha: 0, xPercent: 120, rotation: 8 }, { autoAlpha: 1, xPercent: 0, rotation: 2, duration: 0.1 / 3, ease: "paper", immediateRender: false }, L(0.62));
        if (i < 2) {
          tl.to(q(".flat-l"), { xPercent: -100, duration: 0.1 / 3, ease: "camera" }, L(0.88))
            .to(q(".flat-r"), { xPercent: 100, duration: 0.1 / 3, ease: "camera" }, L(0.88))
            .to(q(`.a3-title[data-s="${i}"]`), { yPercent: -100, y: -40, duration: 0.06 / 3, ease: "fold" }, L(0.88))
            .to(q(`.a3-stamp[data-s="${i}"], .a3-slip[data-s="${i}"]`), { autoAlpha: 0, duration: 0.05 / 3 }, L(0.9))
            .set(sc, { autoAlpha: 0 }, L(0.99));
        }
      }

      // Scene 1: the early taker rises with the parcel, walks off left; the chair tips back.
      const a = (v: number) => v / 3;
      tl.to(q(".taker"), { y: -22, duration: a(0.08), ease: "paper" }, a(0.12))
        .to(q(".s1-parcel"), { x: -20, y: -60, duration: a(0.08), ease: "paper" }, a(0.14))
        .to(q(".taker, .s1-parcel"), { x: "-=560", duration: a(0.3), ease: "power1.in" }, a(0.22))
        .to(q(".s1-chair"), { rotation: -24, transformOrigin: "0% 100%", duration: a(0.06), ease: "stamp" }, a(0.3));

      // Scene 2: the host gathers the kitty and turns; the back wall tears; they slip through.
      const b = (v: number) => 1 / 3 + v / 3;
      // The host gathers the kitty into their coat and rises.
      tl.to(q(".s2-parcel"), { x: -80, y: -20, scale: 0.5, duration: 0.06 / 3, ease: "paper" }, b(0.1))
        .to(q(".s2-parcel"), { autoAlpha: 0, duration: 0.02 / 3 }, b(0.16))
        .to(q(".host"), { y: -34, duration: 0.06 / 3, ease: "paper" }, b(0.16))
        // The back wall tears down the middle and the halves part onto Night.
        .set(q(".tear-line"), { autoAlpha: 1 }, b(0.28))
        .to(q(".tear-line"), { drawSVG: "100%", duration: 0.1 / 3, ease: "ink" }, b(0.28))
        .to(q(".tear-line"), { autoAlpha: 0, duration: 0.02 / 3 }, b(0.4))
        .to(q(".wall-l"), { x: -330, rotation: -5, svgOrigin: "0 520", duration: 0.14 / 3, ease: "fold" }, b(0.38))
        .to(q(".wall-r"), { x: 330, rotation: 5, svgOrigin: "1000 520", duration: 0.14 / 3, ease: "fold" }, b(0.38))
        // …and the host slips away through it into the lantern light.
        .to(q(".host"), { y: -120, scale: 0.45, autoAlpha: 0, svgOrigin: "500 332", duration: 0.14 / 3, ease: "power1.in" }, b(0.46))
        // Set change: the wall closes again for scene 3.
        .to(q(".wall-l, .wall-r"), { x: 0, rotation: 0, duration: 0.08 / 3, ease: "fold" }, b(0.9));

      // Scene 3: a stamped ledger; the ink drains off the page with a few drips.
      const c = (v: number) => 2 / 3 + v / 3;
      tl.to(q(".scene-3 .ink-mask-rect"), { attr: { height: 260 }, duration: 0.38 / 3, ease: "ink" }, c(0.14))
        .fromTo(q(".drip"), { y: 0, autoAlpha: 0 }, { y: 120, autoAlpha: 1, duration: 0.3 / 3, stagger: 0.03 / 3, ease: "power1.in" }, c(0.2))
        .add(flightTween(director, "D2", "D3", 0.08 / 3), c(0.62));
      tl.addLabel("end", 1);
    },
    { scope: section },
  );

  if (reduce) return <Act3Static />;

  return (
    <section ref={section} id="act-3" data-section-world="paper" data-world="paper" className="act3" aria-labelledby="act3-h">
      <h2 id="act3-h" className="sr-only">
        Where parties break
      </h2>
      <div ref={pin} className="act3-pin">
        <div className="a3-theatre" aria-hidden="true">
          <Art id="S-1" fit="cover" sizes="100vw" world="paper" />
        </div>
        <div className="a3-opening">
          <div className="a3-night" aria-hidden="true">
            <Art id="H-1" fit="cover" sizes="84vw" />
          </div>
          <svg className="a3-scene" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <defs>
              <mask id="ink-drain">
                <rect x="0" y="0" width="1000" height="600" fill="#fff" />
                <rect className="ink-mask-rect" x="380" y="170" width="260" height="0" fill="#000" />
              </mask>
            </defs>
            {/* the back wall (scene 2 tears it) */}
            <g className="wall">
              <g className="wall-l">
                <path d={`M0,0 L500,0 ${tearPath.replace(/^M500,0 /, "")} L0,520 Z`} fill="#E8D5B5" />
              </g>
              <g className="wall-r">
                <path d={`M1000,0 L500,0 ${tearPath.replace(/^M500,0 /, "")} L1000,520 Z`} fill="#E8D5B5" />
              </g>
              <path className="tear-line" d={tearPath} fill="none" stroke="#FFFBF3" strokeWidth="3" />
            </g>
            <rect x="0" y="520" width="1000" height="80" fill="#B8905F" />
            <rect x="0" y="516" width="1000" height="6" fill="#8C6A45" />

            {/* Scene 1 */}
            <g className="scene scene-1" transform="translate(90 0)">
              <rect x="290" y="330" width="430" height="16" rx="3" fill="#C9A57A" />
              <rect x="320" y="346" width="10" height="174" fill="#8C6A45" />
              <rect x="690" y="346" width="10" height="174" fill="#8C6A45" />
              <Chair x={350} cls="s1-chair" />
              {[430, 510, 590, 670].map((x) => (
                <Chair key={x} x={x} />
              ))}
              <Sitter x={350} colour={0} animal={0} cls="taker" />
              <Sitter x={430} colour={2} animal={1} />
              <Sitter x={510} colour={4} animal={11} />
              <Sitter x={590} colour={5} animal={6} />
              <Sitter x={670} colour={12} animal={3} />
              <rect x="290" y="330" width="430" height="16" rx="3" fill="#C9A57A" />
              <foreignObject className="s1-parcel" x="470" y="262" width="80" height="80">
                <KittyParcel size={70} />
              </foreignObject>
            </g>

            {/* Scene 2 */}
            <g className="scene scene-2">
              <rect x="320" y="330" width="360" height="16" rx="3" fill="#C9A57A" />
              <rect x="340" y="346" width="10" height="174" fill="#8C6A45" />
              <rect x="650" y="346" width="10" height="174" fill="#8C6A45" />
              {[380, 620].map((x) => (
                <Chair key={x} x={x} />
              ))}
              <Sitter x={380} colour={7} animal={8} />
              <Sitter x={620} colour={10} animal={5} />
              <Sitter x={500} colour={1} animal={8} cls="host" tall />
              <rect x="320" y="330" width="360" height="16" rx="3" fill="#C9A57A" />
              <foreignObject className="s2-parcel" x="540" y="262" width="80" height="80">
                <KittyParcel size={70} />
              </foreignObject>
            </g>

            {/* Scene 3 */}
            <g className="scene scene-3" transform="translate(90 0)">
              <path d="M470,520 L500,380 L520,380 L550,520 Z" fill="#8C6A45" />
              <path d="M360,390 L510,370 L660,390 L660,170 L510,150 L360,170 Z" fill="#F6EEDF" />
              <path d="M510,150 L510,370" stroke="#C9A57A" strokeWidth="2" />
              <g mask="url(#ink-drain)">
                {Array.from({ length: 12 }, (_, k) => (
                  <g key={k} transform={`translate(${385 + (k % 6) * 44 + (k % 6 > 2 ? 10 : 0)} ${200 + Math.floor(k / 6) * 70}) rotate(${(k * 37) % 20 - 10})`}>
                    <circle r="16" fill="none" stroke="var(--teal)" strokeWidth="2.4" />
                    <circle r="12" fill="none" stroke="var(--teal)" strokeWidth="1" />
                    <path d="M-6,0 l4,4 l8,-8" fill="none" stroke="var(--teal)" strokeWidth="2.2" />
                  </g>
                ))}
                <g stroke="#22151F" strokeOpacity=".5" strokeWidth="1.2">
                  {[330, 345, 360].map((y) => (
                    <path key={y} d={`M380,${y} L640,${y}`} />
                  ))}
                </g>
              </g>
              {[420, 470, 560, 600].map((x, k) => (
                <path key={x} className="drip" d={`M${x},370 q-3,8 0,12 q3,-4 0,-12 Z`} fill="var(--teal)" transform={`translate(0 ${k * 4})`} />
              ))}
            </g>
            <Flats />
          </svg>
        </div>

        {S.map((s, i) => (
          <div key={i} className="a3-title-slot" aria-hidden={undefined}>
            <h3 className="a3-title type-h1" data-s={i}>
              {s.title}
            </h3>
          </div>
        ))}

        {S.map((s, i) =>
          "stamp" in s && s.stamp ? (
            <div key={`st${i}`} className="a3-stamp" data-s={i}>
              <Stamp
                label={s.stamp}
                sub={
                  <>
                    {s.stampNote}
                    <sup>
                      <a href={`#fn-${FN[i]}`}>{FN[i]}</a>
                    </sup>
                  </>
                }
                ink="saffron"
                width={220}
                height={80}
                rotate={0}
              />
            </div>
          ) : null,
        )}

        {S.map((s, i) => (
          <aside key={`sl${i}`} className="a3-slip paper-fibre" data-s={i} data-world="paper">
            <span className="type-label" style={{ color: "var(--ink-soft)" }}>
              {copy.act3.fixLabel}
            </span>
            <p className="type-body" style={{ fontSize: 17 }}>
              {s.fix}
            </p>
            {i === 2 && <SealDock id="D3" size={48} className="a3-dock" />}
          </aside>
        ))}
      </div>
      {/* No JS: the reduced-motion end frames instead of the unplayed scene. */}
      <noscript>
        <div className="act3-static">
          <Act3StaticBody />
        </div>
      </noscript>
    </section>
  );
}
