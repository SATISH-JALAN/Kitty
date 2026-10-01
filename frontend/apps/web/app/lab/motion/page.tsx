"use client";
/**
 * /lab/motion (brief 9, 17.1): every motion primitive with a replay button. Primitives are
 * judged here before they're used in scenes. Several live inside components (buttons,
 * chips, fields) and are demoed through them.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { demoTag, TRADITIONS } from "@kitty/sdk";
import { gsap, swing } from "@kitty/ui/motion/gsap";
import { flicker, lanternIris, magnetic, stamp } from "@kitty/ui/motion/primitives/physical";
import { chitAssembly } from "@kitty/ui/motion/primitives/chits";
import "@kitty/ui/motion/motionPath";
import { labelRoll, lineInSlot, maskOff, scramble } from "@kitty/ui/motion/primitives/text";
import { BowMask } from "@kitty/ui/brand/BowMask";
import { WaxSeal } from "@kitty/ui/brand/WaxSeal";
import { Button, TextLink } from "@kitty/ui/components/Button";
import { Chit } from "@kitty/ui/components/Chit";
import { ChipGroup } from "@kitty/ui/components/Chip";
import { CopyButton } from "@kitty/ui/components/CopyButton";
import { EnvelopeDropzone, type DropState } from "@kitty/ui/components/EnvelopeDropzone";
import { Field, Toggle } from "@kitty/ui/components/Field";
import { Lantern, type LanternHandle } from "@kitty/ui/components/Lantern";
import { LedgerRoll } from "@kitty/ui/components/Ledger";
import { Stamp } from "@kitty/ui/components/Stamp";
import { TwineRail } from "@kitty/ui/components/TwineRail";
import { Mask } from "@kitty/ui/generators/mask";
import { TornEdgeSvg } from "@kitty/ui/paper/TornEdgeSvg";
import { Booklet, DiaryPage } from "@/components/stage/Booklet";

function Card({ n, name, note, children, onReplay, night }: { n: number; name: string; note: string; children: ReactNode; onReplay?: () => void; night?: boolean }) {
  return (
    <section className="lab-card" data-world={night ? "night" : "paper"}>
      <header>
        <span className="type-mono">{String(n).padStart(2, "0")}</span>
        <h2 className="type-h3">{name}</h2>
        {onReplay && (
          <Button size="S" variant="ghost" onClick={onReplay}>
            Replay
          </Button>
        )}
      </header>
      <div className="lab-demo">{children}</div>
      <p className="type-small" style={{ color: "var(--fg-soft)" }}>
        {note}
      </p>
    </section>
  );
}

function useReplay(fn: (el: HTMLElement) => unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const run = () => {
    if (ref.current) fn(ref.current);
  };
  useEffect(() => {
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { ref, run };
}

export default function MotionLab() {
  const [key, setKey] = useState<Record<string, number>>({});
  const bump = (k: string) => setKey((s) => ({ ...s, [k]: (s[k] ?? 0) + 1 }));
  const [bead, setBead] = useState(2);
  const [drop, setDrop] = useState<DropState>("empty");
  const [spread, setSpread] = useState(0);
  const [on, setOn] = useState(false);
  const [chip, setChip] = useState<string | null>("tanda");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const lantern = useRef<LanternHandle>(null);

  const iris = useReplay((el) => {
    const target = el.querySelector<HTMLElement>(".iris-target")!;
    const l = el.querySelector<HTMLElement>(".iris-lantern")!.getBoundingClientRect();
    lanternIris(target, { x: l.left + l.width / 2, y: l.top + l.height / 2 }, { glow: el.querySelector(".lantern-glow") });
  });
  const seal = useReplay((el) => {
    const s = el.querySelector(".fly-seal");
    gsap.fromTo(s, { x: 0, y: 0, rotation: -10, scale: 0.5 }, { motionPath: { path: [{ x: 0, y: 0 }, { x: 110, y: -70 }, { x: 220, y: 0 }], curviness: 1.2 }, rotation: 6, scale: 1, duration: 0.9, ease: "camera" });
  });
  const curtain = useReplay((el) => {
    const [l, r] = Array.from(el.querySelectorAll(".cur-panel"));
    gsap.timeline().fromTo(l, { xPercent: -100 }, { xPercent: 0, duration: 0.38, ease: "fold" }).fromTo(r, { xPercent: 100 }, { xPercent: 0, duration: 0.38, ease: "fold" }, 0).to(l, { xPercent: -100, duration: 0.38, ease: "paper" }, 0.44).to(r, { xPercent: 100, duration: 0.38, ease: "paper" }, 0.44);
  });
  const seam = useReplay((el) => {
    gsap.fromTo(el.querySelector(".seam-top"), { rotationX: 0, y: 0 }, { rotationX: -75, y: -30, duration: 1, ease: "fold", transformPerspective: 800, transformOrigin: "50% 0%", yoyo: true, repeat: 1, repeatDelay: 0.6 });
  });
  const mo = useReplay((el) => {
    const h = el.querySelector<HTMLElement>(".mo-h")!;
    h.innerHTML = 'Keep your <em class="type-word hold">secrets</em>.';
    const m = maskOff(h, { hold: ".hold", strip: "var(--plum)" });
    setTimeout(m.release, 1600);
  });
  const slot = useReplay((el) => {
    const p = el.querySelector<HTMLElement>(".slot-p")!;
    p.textContent = "Everyone chips in. One guest takes it home.";
    lineInSlot(p);
  });
  const roll = useReplay(() => bump("roll"));
  const ins = useReplay((el) => {
    const [a, b] = Array.from(el.querySelectorAll(".ins-word"));
    const w = el.querySelector(".ins-win");
    gsap.timeline().fromTo(a, { x: 60 }, { x: 0, duration: 0.6, ease: "camera" }, 0).fromTo(b, { x: -60 }, { x: 0, duration: 0.6, ease: "camera" }, 0).fromTo(w, { width: 0 }, { width: 120, duration: 0.6, ease: "camera" }, 0).fromTo(el.querySelector(".ins-img"), { scale: 1.3 }, { scale: 1, duration: 0.6, ease: "camera" }, 0);
  });
  const scr = useReplay((el) => {
    const s = el.querySelector<HTMLElement>(".scr")!;
    s.className = "scr type-mono";
    scramble(s, "Marigold Parrot", { onResolve: () => (s.className = "scr type-word") });
  });
  const asm = useReplay((el) => {
    const chits = Array.from(el.querySelectorAll<HTMLElement>(".asm-chit"));
    gsap.set(chits, { x: 0, y: 0 });
    const r = el.querySelector(".asm-target")!.getBoundingClientRect();
    chitAssembly(chits, chits.map((_, i) => ({ x: r.left + 20 + (i % 3) * 30, y: r.top + 12 + Math.floor(i / 3) * 22 })));
  });
  const stp = useReplay((el) => stamp(el.querySelector(".stp")!, { theta: -6, surface: el }));
  const mag = useReplay((el) => magnetic(el.querySelector<HTMLElement>(".btn")!, el.querySelector<HTMLElement>(".btn-label")));
  const swingR = useReplay((el) => {
    const t = el.querySelector(".swing-tag");
    gsap.set(t, { transformOrigin: "50% 0%" });
    swing(t, 12, 1.8, { fromAmp: true });
  });
  const flick = useReplay(() => (lantern.current?.glow ? flicker(lantern.current.glow) : undefined));
  const bow = useReplay((el) => el.querySelector("svg")?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true })));
  const peel = useReplay((el) => {
    const cards = Array.from(el.querySelectorAll(".peel"));
    gsap.set(cards, { rotationX: 0 });
    gsap.timeline().to(cards[0], { rotationX: -100, duration: 0.6, ease: "fold", transformOrigin: "50% 100%", transformPerspective: 700 }).to(cards[1], { rotationX: -100, duration: 0.6, ease: "fold", transformOrigin: "50% 100%", transformPerspective: 700 }, "+=0.3");
  });
  const cyl = useReplay((el) => gsap.fromTo(el.querySelector(".cyl-drum"), { rotationX: 0 }, { rotationX: 360, duration: 3, ease: "none" }));
  const pageTurn = useReplay(() => setSpread((s) => (s === 0 ? 1 : 0)));
  const wordmark = useReplay((el) => {
    const letters = el.querySelectorAll(".wm-l");
    gsap.fromTo(letters, { y: 0 }, { y: -8, duration: 0.3, stagger: 0.06, yoyo: true, repeat: 1, ease: "paper" });
  });

  return (
    <main className="px-page py-16" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      <header>
        <p className="type-label" style={{ color: "var(--fg-soft)" }}>
          Lab
        </p>
        <h1 className="type-h1">Motion primitives</h1>
        <p className="type-body" style={{ color: "var(--fg-soft)" }}>
          All 34 from brief section 9, each with its reduced-motion path. Hover the interactive ones.
        </p>
      </header>
      <div className="lab-grid">
        <Card n={1} name="Lantern iris" note="Circle from a lantern's centre, 900 ms ink; the lantern swells first." onReplay={iris.run} night>
          <div ref={iris.ref} style={{ position: "relative", height: 140 }}>
            <span className="iris-lantern" style={{ position: "absolute", left: 20, top: 40 }}>
              <Lantern width={40} />
            </span>
            <div className="iris-target" style={{ position: "absolute", inset: 0, background: "var(--paper)", clipPath: "circle(0% at 0 0)", display: "grid", placeItems: "center", color: "var(--ink)" }}>
              <span className="type-h2">The party</span>
            </div>
          </div>
        </Card>
        <Card n={2} name="Travelling seal" note="Arc 18vh above the line, −10° → +6°, scale by dock." onReplay={seal.run}>
          <div ref={seal.ref} style={{ position: "relative", height: 120, paddingTop: 50 }}>
            <span className="fly-seal" style={{ display: "inline-block" }}>
              <WaxSeal size={48} />
            </span>
          </div>
        </Card>
        <Card n={3} name="Paper curtain" note="Two torn panels close (380 ms fold), hold 60 ms, part (380 ms paper)." onReplay={curtain.run}>
          <div ref={curtain.ref} style={{ position: "relative", height: 120, overflow: "hidden", background: "var(--night)" }}>
            <div className="cur-panel" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "51%", background: "var(--paper-deep)", transform: "translateX(-100%)" }} />
            <div className="cur-panel" style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "51%", background: "var(--paper-deep)", transform: "translateX(100%)" }} />
          </div>
        </Card>
        <Card n={4} name="Torn seam" note="The upper sheet folds back from its torn edge onto the next world." onReplay={seam.run}>
          <div ref={seam.ref} style={{ position: "relative", height: 140, background: "var(--paper)", perspective: 800 }}>
            <div className="seam-top" style={{ position: "absolute", inset: 0, background: "var(--night)" }}>
              <div style={{ position: "absolute", left: 0, right: 0, bottom: -9 }}>
                <TornEdgeSvg depth={18} seed={3} fill="var(--night)" flip />
              </div>
            </div>
          </div>
        </Card>
        <Card n={5} name="Page turn" note="rotationY 0 → −180 about the spine, 720 ms fold; the back face is the next page." onReplay={pageTurn.run}>
          <div ref={pageTurn.ref}>
            <Booklet
              spread={spread}
              pages={[
                <DiaryPage key={1} n={1}>
                  <span className="type-h3">Stamps</span>
                </DiaryPage>,
                <DiaryPage key={2} n={2} perforated="none" />,
                <DiaryPage key={3} n={3}>
                  <span className="type-h3">Seats</span>
                </DiaryPage>,
                <DiaryPage key={4} n={4} perforated="none" />,
              ]}
              style={{ width: "100%" }}
            />
          </div>
        </Card>
        <Card n={6} name="Mask-off headline" note="Strips peel from the right, 90 ms apart; a held word waits." onReplay={mo.run} night>
          <div ref={mo.ref}>
            <h3 className="mo-h type-h1" />
          </div>
        </Card>
        <Card n={7} name="Line in a slot" note="yPercent 105 → 0, rotate 2° → 0, 700 ms paper, 70 ms stagger." onReplay={slot.run}>
          <div ref={slot.ref}>
            <p className="slot-p type-h2" style={{ maxWidth: "18ch" }} />
          </div>
        </Card>
        <Card n={8} name="Ledger roll" note="Digit strips roll right to left. Non-money only." onReplay={roll.run}>
          <div ref={roll.ref} className="type-display-l" style={{ fontSize: 48 }}>
            <LedgerRoll key={key.roll ?? 0} value="1,000,000,000" />
          </div>
        </Card>
        <Card n={9} name="Word insertion" note="Two words part as an arch window grows between them." onReplay={ins.run}>
          <div ref={ins.ref} style={{ display: "flex", alignItems: "center", gap: 8, height: 120 }}>
            <span className="ins-word type-word" style={{ fontSize: 34 }}>
              kitty
            </span>
            <span className="ins-win" style={{ width: 120, height: 110, overflow: "hidden", borderRadius: "60px 60px 0 0", position: "relative" }}>
              <span className="ins-img" style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #4E2152, #E4572E 70%, #F4A300)" }} />
            </span>
            <span className="ins-word type-word" style={{ fontSize: 34 }}>
              tanda
            </span>
          </div>
        </Card>
        <Card n={10} name="Mask scramble" note="▓▒░◆◇●○ settle left to right, then mono → Boska italic." onReplay={scr.run} night>
          <div ref={scr.ref} className="type-h2">
            <span className="scr type-mono">Marigold Parrot</span>
          </div>
        </Card>
        <Card n={11} name="Chit assembly" note="Chits fly on one-control-point curves and land with a squash." onReplay={asm.run}>
          <div ref={asm.ref} style={{ position: "relative", height: 140 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="asm-chit" style={{ position: "absolute", left: 10 + i * 40, top: 10 + (i % 2) * 30 }}>
                <Chit width={34} />
              </span>
            ))}
            <span className="asm-target" style={{ position: "absolute", right: 10, bottom: 10, width: 110, height: 60, border: "1px dashed var(--hairline)" }} />
          </div>
        </Card>
        <Card n={12} name="Rubber stamp" note="scale 1.4 → 1 in 260 ms stamp; ink blur settles; the page shakes." onReplay={stp.run}>
          <div ref={stp.ref} style={{ height: 120, display: "grid", placeItems: "center" }}>
            <Stamp className="stp" label="Never stored" ink="plum" />
          </div>
        </Card>
        <Card n={13} name="Ink fill button" note="Hover: fill spreads from where the pointer entered.">
          <Button size="L">Get your Guest Pass</Button>
        </Card>
        <Card n={14} name="Label roll" note="Characters roll up, 12 ms apart." onReplay={() => bump("lr")}>
          <RollDemo k={key.lr ?? 0} />
        </Card>
        <Card n={15} name="Dot to arrow" note="Hover the link: the dot becomes a paper arrow.">
          <TextLink href="#">See how a party works</TextLink>
        </Card>
        <Card n={16} name="Stitched underline" note="Draws from the left on hover, exits to the right.">
          <TextLink href="#" arrow={false}>
            How the House Fund works
          </TextLink>
        </Card>
        <Card n={17} name="Press" note="Press any button: scale .98, 1 px down, one depth level.">
          <Button variant="money">Chip in now</Button>
        </Card>
        <Card n={18} name="Chit fold loader" note="The label hides behind a folding chit; done becomes a stamped tick." onReplay={() => { setBusy(true); setTimeout(() => { setBusy(false); setDone(true); setTimeout(() => setDone(false), 1200); }, 2400); }}>
          <Button busy={busy} done={done}>
            Create party
          </Button>
        </Card>
        <Card n={19} name="Magnetic pull" note="Within 80 px the button follows at 0.3×, its label at 0.15×." onReplay={mag.run}>
          <div ref={mag.ref} style={{ padding: 40 }}>
            <Button size="L">Get your Guest Pass</Button>
          </div>
        </Card>
        <Card n={20} name="Stitched focus ring" note="Tab to any control: a dashed ring draws round in 280 ms.">
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="ghost">Tab to me</Button>
            <Button variant="ghost">Then me</Button>
          </div>
        </Card>
        <Card n={21} name="Lantern cursor + aperture" note="Move over this panel: the ring opens to a 140 px lens." night>
          <div data-cursor="media" style={{ height: 120, borderRadius: 2, background: "radial-gradient(circle at 60% 40%, #E4572E, #4E2152 60%, #170E22)" }} />
        </Card>
        <Card n={22} name="World switch header" note="Scroll the landing page: the header wipes between Paper and Night at each section.">
          <a className="type-body" href="/" style={{ textDecoration: "underline dashed" }}>
            Open the landing page
          </a>
        </Card>
        <Card n={23} name="Bead on a string" note="The bead slides along the sag; the string wobbles." onReplay={() => setBead((b) => (b + 3) % 10)}>
          <TwineRail count={10} active={bead} done={Array.from({ length: bead }, (_, i) => i)} height={30} />
        </Card>
        <Card n={24} name="Winking bow" note="Hover the mark: an eye blinks, the tails swing. Click tightens the bow." onReplay={bow.run}>
          <div ref={bow.ref}>
            <BowMask width={140} interactive />
          </div>
        </Card>
        <Card n={25} name="Dangling tag cue" note="A tag on a 40 px string; a damped swing." onReplay={swingR.run}>
          <div ref={swingR.ref} style={{ height: 110, display: "flex", justifyContent: "center" }}>
            <span className="swing-tag" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 1, height: 40, background: "var(--twine)" }} />
              <span className="type-mono" style={{ fontSize: 11, padding: "5px 9px", background: "var(--paper)", boxShadow: "var(--d2)" }}>
                Open it
              </span>
            </span>
          </div>
        </Card>
        <Card n={26} name="Chip and toggle fill" note="Chips fill from the left; the wax-seal knob slides and flattens.">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ChipGroup label="Tradition" value={chip} onChange={setChip} accent="var(--saffron)" options={TRADITIONS.slice(0, 4).map((t) => ({ value: t.key, label: t.word, tradition: t.key }))} />
            <Toggle checked={on} onChange={setOn} label="Auto-pay" />
          </div>
        </Card>
        <Card n={27} name="Field focus and error" note="Underline draws on focus; errors wobble the crease." onReplay={() => setErr((e) => (e ? null : "That doesn't look like an amount. Try 100."))}>
          <Field label="Chip-in" amount defaultValue="1o0" error={err} />
        </Card>
        <Card n={28} name="Envelope dropzone" note="Dragover lifts the flap; drop seals it; invalid shakes." onReplay={() => setDrop((d) => (d === "empty" ? "over" : d === "over" ? "sealed" : d === "sealed" ? "invalid" : "empty"))} night>
          <EnvelopeDropzone state={drop} onFile={() => setDrop("sealed")} width={260} helper={`State: ${drop}`} />
        </Card>
        <Card n={29} name="Copy → stamp" note="The copy glyph becomes a teal 'Copied' stamp for 1.2 s.">
          <CopyButton value="EQ9ZE3C5waLJvp5ttHKfuJoPZn2DBmv9yASNxsSWXPCH" />
        </Card>
        <Card n={30} name="Preloader" note="Open / in a fresh tab (first visit per session).">
          <a className="type-body" href="/" onClick={() => { try { sessionStorage.removeItem("kitty:preloaded"); } catch { /* ignore */ } }} style={{ textDecoration: "underline dashed" }}>
            Replay the preloader
          </a>
        </Card>
        <Card n={31} name="Bunting ticker" note="Papel-picado flags loop at 40 px/s; scroll speeds and flips them. See Act 2's bridge.">
          <div style={{ display: "flex", gap: 10 }}>
            {TRADITIONS.slice(0, 3).map((t, i) => (
              <span key={t.key} className="bt-flag" style={{ background: ["var(--saffron)", "var(--marigold)", "var(--plum)"][i], width: 90, height: 66 }}>
                <span className="type-word" style={{ color: "var(--paper)" }}>
                  {t.word}
                </span>
              </span>
            ))}
          </div>
        </Card>
        <Card n={32} name="Seat cards" note="The top card peels from its bottom edge to reveal the next." onReplay={peel.run}>
          <div ref={peel.ref} style={{ position: "relative", height: 130, perspective: 700 }}>
            {["Guest · Seat 6+", "Regular · Seat 4+", "Family · Seat 1+"].reverse().map((t, i) => (
              <div key={t} className={i < 2 ? "" : ""} style={{ position: "absolute", inset: 0 }}>
                <div className={i === 2 ? "peel" : i === 1 ? "peel" : ""} style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: ["var(--plum)", "#C28A2C", "var(--paper-deep)"][i], color: i === 2 ? "var(--ink)" : "var(--paper)", borderRadius: 2, boxShadow: "var(--d2)" }}>
                  <span className="type-h3">{t}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card n={33} name="Lit wordmark" note="Letters cut from dark paper with lantern light through them; each lifts toward the cursor. See the footer." onReplay={wordmark.run} night>
          <div ref={wordmark.ref} className="type-display-l" style={{ display: "flex", color: "transparent", WebkitTextStroke: "1px var(--lantern)", fontSize: 72 }}>
            {"Kitty".split("").map((c, i) => (
              <span key={i} className="wm-l" style={{ display: "inline-block", background: "linear-gradient(#FFD27A, #E4572E)", WebkitBackgroundClip: "text", backgroundClip: "text" }}>
                {c}
              </span>
            ))}
          </div>
        </Card>
        <Card n={34} name="Text cylinder" note="Words on a cylinder; back faces hidden." onReplay={cyl.run}>
          <div ref={cyl.ref} style={{ height: 120, display: "grid", placeItems: "center", perspective: 800 }}>
            <div className="cyl-drum" style={{ position: "relative", transformStyle: "preserve-3d", height: 36, fontSize: 32 }}>
              {TRADITIONS.map((t, i) => (
                <span key={t.key} className="type-word" style={{ position: "absolute", left: "50%", translate: "-50% 0", whiteSpace: "nowrap", backfaceVisibility: "hidden", transform: `rotateX(${(i * 360) / 7}deg) translateZ(34px)` }}>
                  {t.word}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>
      <section className="lab-card" style={{ alignItems: "flex-start" }}>
        <h2 className="type-h3">Mask with hover tilt</h2>
        <Mask tag={demoTag("tilt")} width={200} tilt tradition="susu" />
      </section>
    </main>
  );
}

function RollDemo({ k }: { k: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current || k === 0) return;
    gsap.set(ref.current.querySelectorAll("[data-roll-char]"), { yPercent: 0 });
    labelRoll(ref.current);
  }, [k]);
  const text = "Get your Guest Pass";
  return (
    <span ref={ref} className="type-body" style={{ display: "inline-flex", overflow: "clip", height: "1.3em", lineHeight: 1.3 }}>
      {text.split("").map((c, i) => (
        <span key={i} data-roll-char="" style={{ display: "inline-flex", flexDirection: "column", whiteSpace: "pre" }}>
          <span>{c}</span>
          <span>{c}</span>
        </span>
      ))}
    </span>
  );
}
