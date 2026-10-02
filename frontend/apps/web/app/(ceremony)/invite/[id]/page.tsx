"use client";
/**
 * Invite card (brief 13.5). A sealed envelope over the host's tradition vignette; the seal
 * cracks, the card rises and settles at the left while a paper rules sheet slides in on
 * the right: the party, your seats, the fees in plain numbers, what happens if someone
 * misses, auto-pay. RSVP runs a 4-lantern stepper; success scrambles into your mask.
 * The invite secret lives in the URL fragment (#k=…), never in a server log.
 */
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { earliestSeat, formatMoney, formatPercentBps, perNightDue, TIER_NAMES, tradition as traditionOf } from "@kitty/sdk";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { stamp } from "@kitty/ui/motion/primitives/physical";
import { scramble } from "@kitty/ui/motion/primitives/text";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { WaxSeal } from "@kitty/ui/brand/WaxSeal";
import { Button, TextLink } from "@kitty/ui/components/Button";
import { LanternStepper, type Step } from "@kitty/ui/components/LanternStepper";
import { Sheet } from "@kitty/ui/components/Sheet";
import { Stamp } from "@kitty/ui/components/Stamp";
import { Emblem } from "@kitty/ui/generators/emblem";
import { Mask } from "@kitty/ui/generators/mask";
import { Art } from "@/components/Art";
import { useIrisEntry } from "@/components/chrome/Transition";
import { copy, t } from "@/copy/en";
import { IS_SAMPLE, useMe, useParty } from "@/data/api";
import { useSession } from "@/data/session";
import { useQueryClient } from "@tanstack/react-query";
import type { Party } from "@/data/types";

const PERIOD: Record<Party["period"], string> = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly", demo: "every 3 minutes (demo)" };
const MODE: Record<Party["mode"], string> = { draw: "The Draw", seating: "Seating plan", bid: "Bid night" };
const VIGNETTE: Record<string, "V-1" | "V-2" | "V-3" | "V-4" | "V-5" | "V-6" | "V-7"> = { kitty: "V-1", tanda: "V-2", susu: "V-3", paluwagan: "V-4", arisan: "V-5", chama: "V-6", ajo: "V-7" };
const RSVP_STEPS = ["Build proof", "Approve auto-pay", "RSVP", "First chip-in"];

function SeatDiagram({ n, from }: { n: number; from: number }) {
  return (
    <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
      <circle cx="60" cy="60" r="34" fill="var(--paper-deep)" stroke="var(--hairline)" />
      {Array.from({ length: n }, (_, i) => {
        const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
        const x = 60 + Math.cos(a) * 48;
        const y = 60 + Math.sin(a) * 48;
        const ok = i + 1 >= from;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="7" fill={ok ? "var(--kraft)" : "transparent"} stroke={ok ? "none" : "var(--hairline)"} />
            {i + 1 === from && <circle cx={x} cy={y} r="10" fill="none" stroke="var(--ink)" strokeDasharray="2.5 2" />}
            <text x={x} y={y + 3} textAnchor="middle" style={{ font: "500 8px var(--font-mono)" }} fill="var(--ink)">
              {i + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function InvitePage() {
  const { id } = useParams<{ id: string }>();
  const { data: party, isPending } = useParty(id);
  const me = useMe();
  const root = useRef<HTMLElement>(null);
  const [opened, setOpened] = useState(false);
  const [rsvp, setRsvp] = useState(false);
  const [steps, setSteps] = useState<Step[]>(RSVP_STEPS.map((label) => ({ label, status: "idle" })));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const hasPass = useSession((s) => s.hasPass);
  const qc = useQueryClient();
  useIrisEntry(root);

  const tier = me.data?.tier ?? 0;
  const due = party ? perNightDue(party.chipIn) : null;
  const from = party ? earliestSeat(tier, party.guests) : 0;
  const myName = party?.me ? party.seats[party.me.idx]?.name ?? "Indigo Heron" : "Indigo Heron";
  const mySeat = party?.me ? party.seats[party.me.idx] : undefined;
  const [demo, setDemo] = useState<string | null>(null);
  useEffect(() => setDemo(new URLSearchParams(window.location.search).get("demo")), []);
  // Invites open while a party is forming; once it starts, every seat is taken.
  const full = party?.status === "active";
  const closed = party?.status === "finished" || demo === "expired";

  // Enter: the seal cracks, the card rises, flips to the left; the sheet slides in.
  useGSAP(
    () => {
      if (!party || opened) return;
      const el = root.current!;
      const reduce = prefersReducedMotion();
      if (reduce) {
        setOpened(true);
        return;
      }
      const tl = gsap.timeline({ delay: 0.3, onComplete: () => setOpened(true) });
      tl.fromTo(el.querySelectorAll(".inv-env .seal-crack"), { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.28, stagger: 0.06, ease: "ink" })
        .to(el.querySelector(".inv-env-seal"), { scale: 1.1, rotation: -8, autoAlpha: 0, duration: 0.35, ease: "fold" }, "+=0.05")
        .to(el.querySelector(".inv-env-flap"), { rotationX: 180, duration: 0.45, ease: "fold" }, "<")
        .fromTo(el.querySelector(".inv-rise"), { yPercent: 0 }, { yPercent: -70, duration: 0.5, ease: "camera" })
        .to(el.querySelector(".inv-env"), { y: 120, autoAlpha: 0, duration: 0.4, ease: "fold" }, "-=0.1");
    },
    { scope: root, dependencies: [party?.id] },
  );

  useEffect(() => {
    if (!opened || !root.current || prefersReducedMotion()) return;
    const el = root.current;
    gsap.fromTo(el.querySelector(".inv-card"), { y: 80, scale: 0.9, rotation: -3, autoAlpha: 0 }, { y: 0, scale: 1, rotation: -1.5, autoAlpha: 1, duration: 0.72, ease: "camera" });
    gsap.fromTo(el.querySelector(".inv-sheet"), { x: 80, rotationX: 6, autoAlpha: 0 }, { x: 0, rotationX: 0, autoAlpha: 1, duration: 0.6, ease: "paper", delay: 0.15, transformPerspective: 1200 });
  }, [opened]);

  const runRsvp = async () => {
    setStartedAt(Date.now());
    setFailed(null);
    if (!IS_SAMPLE) {
      setSteps(RSVP_STEPS.map((label) => ({ label, status: "idle" })));
      try {
        const k = new URLSearchParams(window.location.hash.slice(1)).get("k");
        if (!k) throw new Error("This link is missing its invite key. Ask the host for the full link.");
        const { rsvp: send } = await import("@/lib/kitty/actions");
        const { decodeInviteSecret } = await import("@kitty/chain");
        await send(BigInt(id), decodeInviteSecret(k), (i, status, detail) =>
          setSteps((s) => s.map((st, n) => (n === i ? { ...st, status, detail, progress: status === "done" ? 1 : null } : st))),
        );
        await qc.invalidateQueries({ queryKey: ["parties"] });
        setDone(true);
      } catch (e) {
        setFailed(rsvpError(e));
        setSteps((s) => s.map((st) => (st.status === "working" ? { ...st, status: "error" } : st)));
      }
      return;
    }
    for (let i = 0; i < RSVP_STEPS.length; i++) {
      setSteps((s) => s.map((st, k) => (k === i ? { ...st, status: "working", progress: i === 0 ? null : 0.5 } : st)));
      await new Promise((r) => setTimeout(r, i === 0 ? 4200 : 1100));
      setSteps((s) => s.map((st, k) => (k === i ? { ...st, status: "done", progress: 1 } : st)));
    }
    setDone(true);
  };

  useEffect(() => {
    if (!done || !root.current) return;
    const el = document.querySelector<HTMLElement>(".inv-name");
    if (el) scramble(el, myName, { onResolve: () => el.classList.add("type-word") });
    const st = document.querySelector(".inv-rsvpd");
    if (st) stamp(st, { theta: -6, delay: 0.8 });
  }, [done, myName]);

  if (isPending || !party || !due) {
    return <main ref={root} className="inv-page" aria-busy="true" />;
  }

  const trad = traditionOf(party.tradition);
  return (
    <main ref={root} className="inv-page" aria-labelledby="inv-title">
      <div className="inv-backdrop" aria-hidden="true">
        <Art id={VIGNETTE[party.tradition]} sizes="100vw" imgStyle={{ filter: "brightness(.35) blur(8px)", transform: "scale(1.06)" }} />
      </div>

      {!opened && (
        <div className="inv-env" aria-hidden="true">
          <div className="inv-rise">
            <div className="inv-mini-card paper-fibre">
              <Emblem partyId={party.id} guests={party.guests} tradition={party.tradition} size={64} />
            </div>
          </div>
          <svg viewBox="0 0 360 240" width="360" height="240" className="inv-env-body">
            <rect x="0" y="30" width="360" height="210" rx="3" fill="#C9A57A" />
            <path d="M0,240 L150,140 M360,240 L210,140" stroke="#8C6A45" strokeWidth="1" opacity=".5" />
          </svg>
          <svg viewBox="0 0 360 130" width="360" height="130" className="inv-env-flap" style={{ transformOrigin: "50% 23%" }}>
            <path d="M0,30 L360,30 L190,128 C184,131 176,131 170,128 Z" fill="#B8905F" stroke="#8C6A45" />
          </svg>
          <div className="inv-env-seal">
            <WaxSeal size={72} crackable />
          </div>
        </div>
      )}

      <div className="inv-layout" style={{ visibility: opened ? "visible" : "hidden" }}>
        <div className="inv-card paper-fibre foil-frame" data-world="paper" data-flip-id={`invite-${party.id}`}>
          <span className="type-label" style={{ color: "var(--ink-soft)" }}>
            {copy.finale.invited}
          </span>
          <h1 id="inv-title" className="type-h2" style={{ textAlign: "center" }}>
            {party.title}
          </h1>
          <Emblem partyId={party.id} guests={party.guests} tradition={party.tradition} size={120} />
          <span className="type-word" style={{ fontSize: 40 }}>
            {party.word}
          </span>
          <span className="stitch-b" style={{ width: "72%", height: 1 }} aria-hidden="true" />
          <p className="type-mono" style={{ fontSize: 14, textAlign: "center", lineHeight: 1.6 }}>
            Chip-in {formatMoney(party.chipIn)} · {PERIOD[party.period]} · {party.guests} guests
            <br />
            Kitty&nbsp;fee&nbsp;0.5% · House&nbsp;fee&nbsp;0.5% · Host&nbsp;fee&nbsp;{formatPercentBps(party.hostFeeBps)}
          </p>
          <p className="type-small" style={{ color: "var(--ink-soft)" }}>
            Hosted by <em className="type-word">{party.hostName}</em>
          </p>
        </div>

        <section className="inv-sheet paper-fibre" data-world="paper" aria-label="Rules of the party">
          <div className="inv-sec">
            <h2 className="type-label">The party</h2>
            <dl className="inv-dl">
              <dt>Tradition</dt>
              <dd>
                <em className="type-word">{party.word}</em> · {trad.region}
              </dd>
              <dt>Guests</dt>
              <dd className="tnum">{party.guests}</dd>
              <dt>Chip-in</dt>
              <dd>
                <span className="type-money">{formatMoney(party.chipIn)}</span> {PERIOD[party.period]}
              </dd>
              <dt>Order</dt>
              <dd>{MODE[party.mode]}</dd>
              <dt>Starts</dt>
              <dd>{party.status === "forming" ? `When full, by ${party.startsBy}` : new Date(party.nextAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}</dd>
            </dl>
          </div>
          <div className="inv-sec stitch-t">
            <h2 className="type-label">Your seats</h2>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <SeatDiagram n={party.guests} from={from} />
              <p className="type-body">
                As a <em className="type-word">{TIER_NAMES[tier]}</em>, you can take the kitty from Night {from}.
              </p>
            </div>
          </div>
          <div className="inv-sec stitch-t">
            <h2 className="type-label">Fees</h2>
            <table className="inv-fees">
              <tbody>
                <tr>
                  <td>Chip-in</td>
                  <td className="type-money">{formatMoney(due.chipIn, { cents: "always" })}</td>
                </tr>
                <tr>
                  <td>Kitty fee</td>
                  <td className="type-money">+ {formatMoney(due.kittyFee, { cents: "always" })}</td>
                </tr>
                <tr>
                  <td>House fee</td>
                  <td className="type-money">+ {formatMoney(due.houseFee, { cents: "always" })}</td>
                </tr>
                <tr className="inv-total">
                  <td>Each night</td>
                  <td className="type-money-l">{formatMoney(due.total, { cents: "always" })}</td>
                </tr>
              </tbody>
            </table>
            <p className="type-small" style={{ color: "var(--ink-soft)", marginTop: 8 }}>
              The Host fee is {formatPercentBps(party.hostFeeBps)} of the kitty ({formatMoney((party.chipIn * party.guests * party.hostFeeBps) / 10000)}), taken when someone takes it.
            </p>
          </div>
          <div className="inv-sec stitch-t">
            <h2 className="type-label">If someone misses</h2>
            <p className="type-body">{copy.house.line} Their keepsafe covers first, then plus-ones, then the House Fund.</p>
            <TextLink href="/house">How the House Fund works</TextLink>
          </div>
          <div className="inv-sec stitch-t">
            <h2 className="type-label">Auto-pay</h2>
            <p className="type-body">
              You&rsquo;ll approve exactly <span className="type-money">{formatMoney(due.total, { cents: "always" })}</span> per night. You can turn it off, but that counts as a missed chip-in.
            </p>
          </div>
          <div className="inv-sec">
            {closed ? (
              <p className="type-body" role="alert">
                This invite has closed.
              </p>
            ) : full ? (
              <p className="type-body" role="alert">
                This party is full. Ask the host about the standby list.
              </p>
            ) : party.me && party.me.idx >= 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
                <p className="type-body">You&rsquo;re on the guest list as <em className="type-word">{party.seats[party.me.idx]?.name}</em>.</p>
                <Button href={`/p/${party.id}`}>{copy.cta.goParty}</Button>
              </div>
            ) : !IS_SAMPLE && !hasPass ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
                <p className="type-body">You need a Guest Pass to RSVP. It takes a minute, once.</p>
                <Button href="/pass" iconEnd="arrow">{copy.cta.pass}</Button>
              </div>
            ) : me.data?.onHold ? (
              <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
                <p className="type-body">{copy.status.onHold}</p>
                <Button variant="money" href="/diary">
                  {t(copy.cta.settleUp, { amount: formatMoney(me.data.onHold.amount, { cents: "always" }) })}
                </Button>
              </div>
            ) : (
              <Button variant="money" size="L" block onClick={() => setRsvp(true)}>
                {t(copy.cta.rsvp, { amount: formatMoney(due.total, { cents: "always" }) })}
              </Button>
            )}
          </div>
        </section>
      </div>

      <Sheet open={rsvp} onClose={() => setRsvp(false)} title={done ? "You're in" : `RSVP to ${party.title}`} backdrop="night">
        {!done ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <p className="type-body" style={{ color: "var(--fg-soft)" }}>
              One proof and three small transactions. Your proof is made on this device; nothing about your other parties leaves it.
            </p>
            {startedAt == null ? (
              <Button variant="money" size="L" block onClick={runRsvp}>
                {t(copy.cta.rsvp, { amount: formatMoney(due.total, { cents: "always" }) })}
              </Button>
            ) : (
              <LanternStepper steps={steps} startedAt={startedAt} label="RSVP progress" onRetry={failed ? runRsvp : undefined} errorText={failed ?? undefined} />
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
            {mySeat && <Mask colour={mySeat.colour} animal={mySeat.animal} tradition={party.tradition} width={240} />}
            <p className="type-h2">
              At this party you&rsquo;re <span className="inv-name type-mono">{myName}</span>.
            </p>
            <Stamp className="inv-rsvpd" label="RSVP'd" ink="teal" />
            <Button href={`/p/${party.id}`} size="L">
              {copy.cta.goParty}
            </Button>
          </div>
        )}
      </Sheet>
    </main>
  );
}

/** Plain words for what went wrong (copy rules: no blame, say what to do). */
function rsvpError(e: unknown): string {
  const msg = (e as Error)?.message ?? "";
  const code = (e as { code?: string | null })?.code ?? "";
  if (/invite key|BadInvite/i.test(msg + code)) return "This invite link doesn't match the party. Ask the host to send it again.";
  if (/AlreadyJoined/.test(code)) return "You're already on this party's guest list.";
  if (/PartyFull|NotForming/.test(code)) return "This party filled up a moment ago.";
  if (/FormationClosed/.test(code)) return "The RSVP window for this party has closed.";
  if (/UnknownRoot|BadClock/.test(code)) return "The party list moved on while your proof was being made. Try again.";
  if (/four parties/.test(msg)) return "You're already at four parties. Finish one before joining another.";
  if (/Assert Failed|Error in template/.test(msg)) return "Your Diary can't vouch for you yet: a chip-in elsewhere is missing, or this party is above your kitty limit.";
  return msg && msg.length < 140 ? msg : copy.error.proof;
}