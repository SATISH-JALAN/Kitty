"use client";
/**
 * The Draw (brief 13.7): a full-screen Night ceremony. Folded chits shuffle in the bowl
 * until the chain reports DrawResolved — the animation never runs ahead of it. Then one
 * chit rises, unfolds, the guest's party name resolves, their mask appears, petals fall,
 * and a plain paper slip gives the numbers. Announced to screen readers in full.
 */
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatMoney, takeTheKitty } from "@kitty/sdk";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { scramble } from "@kitty/ui/motion/primitives/text";
import { prefersReducedMotion, useReducedMotion } from "@kitty/ui/motion/reduced";
import { Button } from "@kitty/ui/components/Button";
import { Chit } from "@kitty/ui/components/Chit";
import { IconButton } from "@kitty/ui/components/IconButton";
import { LedgerSlip } from "@kitty/ui/components/Ledger";
import { Mask } from "@kitty/ui/generators/mask";
import { useIrisEntry, useTransitionNav } from "@/components/chrome/Transition";
import { Petals, type PetalsHandle } from "@/components/stage/Petals";
import { copy, t } from "@/copy/en";
import { useDraw, useParty } from "@/data/api";

export default function DrawPage() {
  const { id } = useParams<{ id: string }>();
  const { data: party, isError, refetch } = useParty(id);
  const draw = useDraw(party);
  const root = useRef<HTMLDivElement>(null);
  const bowl = useRef<HTMLDivElement>(null);
  const petals = useRef<PetalsHandle>(null);
  const [phase, setPhase] = useState<"waiting" | "revealing" | "done">("waiting");
  const nav = useTransitionNav();
  const reduce = useReducedMotion();
  useIrisEntry(root);

  const taker = party && draw?.takerIdx != null ? party.seats[draw.takerIdx] : undefined;
  const result = party && taker ? takeTheKitty({ chipIn: party.chipIn, guests: party.guests, night: party.night, tier: taker.tier, hostFeeBps: party.hostFeeBps }) : null;
  const isMe = party?.me?.idx === draw?.takerIdx;
  const eligible = draw?.eligible ?? [];

  // The shuffle: each chit on its own ellipse, 2.4 s cycles at 0.8–1.3× speed, until resolved.
  useGSAP(
    () => {
      if (!bowl.current || !eligible.length || prefersReducedMotion()) return;
      const chits = Array.from(bowl.current.querySelectorAll<HTMLElement>(".d-chit"));
      const state = { t: 0 };
      const tween = gsap.to(state, {
        t: 1,
        duration: 2.4,
        ease: "none",
        repeat: -1,
        onUpdate: () => {
          chits.forEach((c, i) => {
            const speed = 0.8 + ((i * 29) % 50) / 100;
            const a = i * 1.7 + (state.t + tween.iteration()) * Math.PI * 2 * speed;
            const rx = 0.09 + (i % 3) * 0.03;
            const ry = 0.05 + (i % 2) * 0.03;
            gsap.set(c, { xPercent: -50, yPercent: -50, x: `${Math.cos(a) * rx * 44}vmin`, y: `${Math.sin(a) * ry * 44}vmin`, rotation: Math.sin(a * 1.3) * 25 });
          });
        },
      });
      return () => tween.kill();
    },
    { dependencies: [eligible.length], scope: bowl },
  );

  // Resolve only once the chain says so.
  useEffect(() => {
    if (draw?.status !== "resolved" || !taker || phase !== "waiting") return;
    setPhase("revealing");
    const reduce = prefersReducedMotion();
    const el = root.current!;
    const rising = el.querySelector<HTMLElement>(".d-drawn")!;
    const nameEls = rising.querySelectorAll<HTMLElement>(".type-word");
    if (reduce) {
      nameEls.forEach((n) => (n.textContent = taker.name));
      setPhase("done");
      return;
    }
    gsap.set(el.querySelectorAll(".d-chit"), { autoAlpha: 0.35 });
    const tl = gsap.timeline({ onComplete: () => setPhase("done") });
    tl.to(el.querySelector(".draw-head"), { y: -24, opacity: 0, duration: 0.4, ease: "fold" }, 0)
      .set(rising, { autoAlpha: 1, y: 0 }, 0)
      .to(rising, { y: "-19vmin", scale: 1.35, duration: 0.5, ease: "camera" })
      .to(rising.querySelector(".chit-right"), { rotationY: 0, duration: 0.6, ease: "fold" })
      .to(rising.querySelector(".chit-back"), { rotationY: 180, duration: 0.6, ease: "fold" }, "<")
      .add(() => nameEls.forEach((n) => scramble(n, taker.name, { duration: 0.7 })))
      .fromTo(el.querySelector(".d-mask-in"), { autoAlpha: 0, scale: 0.8, y: 20 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.6, ease: "paper" }, "+=0.2")
      .add(() => petals.current?.burst({ x: window.innerWidth / 2, y: window.innerHeight * 0.3 }), "<");
  }, [draw?.status, taker, phase]);

  useEffect(() => {
    if (phase !== "done" || !root.current || prefersReducedMotion()) return;
    gsap.fromTo(root.current.querySelector(".d-result"), { y: 40, rotationX: 6, autoAlpha: 0 }, { y: 0, rotationX: 0, autoAlpha: 1, duration: 0.48, ease: "paper", transformPerspective: 1200 });
  }, [phase]);

  if (isError) {
    return (
      <main className="draw-page" style={{ display: "grid", placeItems: "center" }}>
        <div data-world="paper" className="card" role="alert" style={{ maxWidth: 480 }}>
          <p className="type-body">{copy.error.network}</p>
          <div style={{ marginTop: 16 }}>
            <Button variant="ghost" size="S" onClick={() => refetch()}>
              {copy.cta.retry}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const sentence = taker ? t(copy.draw.result, { partyName: taker.name, n: party?.night ?? "" }) : "";

  return (
    <main ref={root} className="draw-page" aria-labelledby="draw-title">
      <div className="draw-close">
        <IconButton icon="close" label={copy.cta.backToParty} onClick={() => nav.go(`/p/${id}`)} />
      </div>
      <header className="draw-head">
        <p className="type-label" style={{ color: "var(--moon-soft)" }}>
          Night {party?.night ?? "…"}
          {party ? ` · ${party.title}` : ""}
        </p>
        <h1 id="draw-title" className="type-h1">
          The Draw
        </h1>
      </header>

      <div className="draw-stage">
        <div className="d-mask" style={{ visibility: phase === "waiting" ? "hidden" : undefined }} aria-hidden="true">
          <div className="d-mask-in">{taker && <Mask colour={taker.colour} animal={taker.animal} tradition={party!.tradition} width={240} />}</div>
        </div>
        <div ref={bowl} className="draw-bowl" aria-hidden="true">
          <svg viewBox="0 0 100 100" className="draw-bowl-svg">
            <ellipse cx="50" cy="56" rx="48" ry="40" fill="rgba(7,3,12,.45)" />
            <ellipse cx="50" cy="50" rx="47" ry="38" fill="#E9A21E" />
            <ellipse cx="50" cy="50" rx="43" ry="34" fill="#7A1F3D" />
            <ellipse cx="50" cy="52" rx="39" ry="30" fill="#4A0F24" />
            <ellipse cx="50" cy="50" rx="47" ry="38" fill="none" stroke="#C8A04A" strokeWidth=".6" />
          </svg>
          {eligible.map((idx) => (
            <span key={idx} className="d-chit">
              <Chit width={64} state="folded" />
            </span>
          ))}
          <span className="d-drawn" style={{ visibility: phase === "waiting" ? "hidden" : undefined }}>
            <Chit width={120} face="name" state={reduce ? "blank" : "folded"}>
              {reduce && taker ? taker.name : ""}
            </Chit>
          </span>
        </div>
      </div>

      <p className="draw-status type-mono" aria-live="polite" style={{ visibility: phase === "done" ? "hidden" : undefined }}>
        {phase === "waiting" ? copy.draw.waiting : "Picked with verifiable randomness, on-chain."}
      </p>

      <div className="sr-only" aria-live="assertive">
        {phase === "done" ? sentence : ""}
      </div>

      {phase === "done" && taker && result && (
        <div className="d-result">
          <LedgerSlip
            rotate={0}
            title={
              <span style={{ textTransform: "none", letterSpacing: 0, fontSize: 19, color: "var(--ink)" }} className="type-body">
                <em className="type-word">{taker.name}</em> takes Night {party!.night}&rsquo;s kitty.
              </span>
            }
            lines={[
              { key: "p", label: "Paid now", amount: formatMoney(result.paidNow), total: true },
              { key: "k", label: "Keepsafe", amount: formatMoney(result.keepsafe), rule: true },
              { key: "h", label: "Host fee", amount: formatMoney(result.hostFee) },
            ]}
            footer={
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
                {isMe && <p className="type-body">That&rsquo;s you. {formatMoney(result.paidNow)} is on its way to your party wallet.</p>}
                <Button href={`/p/${id}`}>{copy.cta.backToParty}</Button>
              </div>
            }
            style={{ width: 420 }}
          />
        </div>
      )}
      <Petals ref={petals} />
    </main>
  );
}

