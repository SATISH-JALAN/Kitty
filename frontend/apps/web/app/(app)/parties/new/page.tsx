"use client";
/**
 * Host wizard (brief 13.4). Seven step cards; only the current one is open. The card
 * folds up as the next unfolds; finished steps collapse to one line with [Edit]. A live
 * invite card on the right follows every choice; the tradition word rolls into the copy.
 * Creating moves no money. Fees are plain, from the SDK.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { dollars, formatMoney, formatPercentBps, HOST_WORDS, perNightDue, type TraditionKey } from "@kitty/sdk";
import { gsap } from "@kitty/ui/motion/gsap";
import { getFlip, type FlipState } from "@kitty/ui/motion/flip";
import { stamp } from "@kitty/ui/motion/primitives/physical";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { Button } from "@kitty/ui/components/Button";
import { ChipGroup } from "@kitty/ui/components/Chip";
import { CopyButton } from "@kitty/ui/components/CopyButton";
import { Field } from "@kitty/ui/components/Field";
import { Icon } from "@kitty/ui/components/Icon";
import { Stamp } from "@kitty/ui/components/Stamp";
import { Tag } from "@kitty/ui/components/Tag";
import { toast } from "@kitty/ui/components/Toast";
import { Emblem } from "@kitty/ui/generators/emblem";
import { Wordmark } from "@kitty/ui/brand/Wordmark";
import { truncateId } from "@kitty/sdk";
import { Art } from "@/components/Art";
import { PageHeader } from "@/components/chrome/PageHeader";
import { copy } from "@/copy/en";
import type { OrderMode, Period } from "@/data/types";
import { IS_SAMPLE } from "@/data/api";

const VIGNETTE: Record<TraditionKey, "V-1" | "V-2" | "V-3" | "V-4" | "V-5" | "V-6" | "V-7"> = { kitty: "V-1", tanda: "V-2", susu: "V-3", paluwagan: "V-4", arisan: "V-5", chama: "V-6", ajo: "V-7" };
const PERIODS: { value: Period; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "demo", label: "Every 3 minutes (Demo)" },
];
const PERIOD_TEXT: Record<Period, string> = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly", demo: "every 3 minutes" };
const STEPS = ["Tradition", "Name", "Chip-in and guests", "How often", "Order", "Host fee", "Review"];

/** The word rolls into place (primitive 14) whenever it changes. */
function RollWord({ word, className, style }: { word: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(word);
  const [shown, setShown] = useState<[string, string]>([word, word]);
  useEffect(() => {
    if (word === prev.current) return;
    setShown([prev.current, word]);
    prev.current = word;
  }, [word]);
  useEffect(() => {
    if (!ref.current || prefersReducedMotion() || shown[0] === shown[1]) return;
    gsap.fromTo(ref.current.querySelector(".rw-old"), { yPercent: 0 }, { yPercent: -100, duration: 0.32, ease: "paper" });
    gsap.fromTo(ref.current.querySelector(".rw-new"), { yPercent: 100 }, { yPercent: 0, duration: 0.32, ease: "paper" });
  }, [shown]);
  return (
    <span ref={ref} className={`type-word ${className ?? ""}`} style={{ display: "inline-grid", overflow: "clip", verticalAlign: "bottom", ...style }}>
      <span className="rw-old" aria-hidden="true" style={{ gridArea: "1/1", visibility: shown[0] === shown[1] ? "hidden" : undefined }}>
        {shown[0]}
      </span>
      <span className="rw-new" style={{ gridArea: "1/1" }}>
        {shown[1]}
      </span>
    </span>
  );
}

function MiniTable({ n, onChange }: { n: number; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<FlipState | null>(null);
  useLayoutEffect(() => {
    const Flip = getFlip();
    if (!state.current || !ref.current || !Flip) return;
    Flip.from(state.current, { duration: prefersReducedMotion() ? 0 : 0.42, ease: "paper", onEnter: (els) => gsap.fromTo(els, { scale: 0 }, { scale: 1, duration: 0.3, ease: "stamp" }), onLeave: (els) => gsap.to(els, { scale: 0, duration: 0.2 }) });
    state.current = null;
  }, [n]);
  const set = (v: number) => {
    if (v < 4 || v > 20) return;
    const Flip = getFlip();
    if (ref.current && Flip) state.current = Flip.getState(ref.current.querySelectorAll(".mt-seat"));
    onChange(v);
  };
  return (
    <div className="mt-row">
      <Button variant="ghost" size="S" onClick={() => set(n - 1)} disabled={n <= 4} aria-label="One fewer guest">
        −
      </Button>
      <div ref={ref} className="mini-table" aria-hidden="true">
        <span className="mt-cloth" />
        {Array.from({ length: n }, (_, i) => {
          const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
          return <span key={i} className="mt-seat" data-flip-id={`seat-${i}`} style={{ left: 80 + Math.cos(a) * 66, top: 80 + Math.sin(a) * 66 }} />;
        })}
      </div>
      <Button variant="ghost" size="S" onClick={() => set(n + 1)} disabled={n >= 20} aria-label="One more guest">
        +
      </Button>
      <span className="type-money-l mt-count" aria-live="polite">
        {n} <span className="type-body">guests</span>
      </span>
    </div>
  );
}

/** Paper ruler slider: ticks every 0.25%, a bead for the thumb. The native range input stays for access. */
function Ruler({ bps, onChange, kitty }: { bps: number; onChange: (b: number) => void; kitty: number }) {
  return (
    <div className="ruler">
      <div className="ruler-paper" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="ruler-tick" style={{ left: `${(i / 8) * 100}%`, height: i % 4 === 0 ? 18 : i % 2 === 0 ? 12 : 8 }}>
            {i % 4 === 0 && <span className="type-mono ruler-label">{i / 4}%</span>}
          </span>
        ))}
        <span className="ruler-bead" style={{ left: `${(bps / 200) * 100}%` }} />
      </div>
      <input type="range" min={0} max={200} step={25} value={bps} onChange={(e) => onChange(+e.target.value)} aria-label="Host fee" aria-valuetext={`${formatPercentBps(bps)}, ${formatMoney((kitty * bps) / 10000)} a night`} className="ruler-input" />
      <p className="type-money" style={{ marginTop: 28 }}>
        Host fee {formatPercentBps(bps)} · {formatMoney((kitty * bps) / 10000)} a night
      </p>
    </div>
  );
}

export default function NewPartyPage() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [word, setWord] = useState<string>("paluwagan");
  const [other, setOther] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("100");
  const [guests, setGuests] = useState(10);
  const [period, setPeriod] = useState<Period>("monthly");
  const [mode, setMode] = useState<OrderMode>("draw");
  const [hostBps, setHostBps] = useState(100);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const cards = useRef<HTMLOListElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const wordmarkBox = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const trad: TraditionKey = HOST_WORDS.find((w) => w.word === word)?.pattern ?? "kitty";
  const shownWord = word === "other" ? other || "savings party" : word;
  const amtOk = /^\d+(\.\d{1,2})?$/.test(amount) && +amount > 0 && +amount <= 500;
  const chipIn = amtOk ? dollars(+amount) : dollars(100);
  const due = perNightDue(chipIn);
  const kitty = chipIn * guests;
  const title = name || `Your ${shownWord}`;
  const partyId = useMemo(() => `draft-${word}-${guests}`, [word, guests]);

  const go = (to: number) => {
    const el = cards.current;
    const reduce = prefersReducedMotion();
    const cur = el?.querySelector<HTMLElement>(`[data-step="${step}"] .step-body`);
    const next = () => {
      setDone((d) => (to > step && !d.includes(step) ? [...d, step] : d));
      setStep(to);
    };
    if (!cur || reduce) return next();
    gsap.to(cur, { rotationX: -90, transformOrigin: "50% 0%", transformPerspective: 900, duration: 0.42, ease: "fold", onComplete: next });
  };

  useEffect(() => {
    const body = cards.current?.querySelector<HTMLElement>(`[data-step="${step}"] .step-body`);
    if (!body || prefersReducedMotion()) return;
    gsap.fromTo(body, { rotationX: 90, transformOrigin: "50% 0%", transformPerspective: 900 }, { rotationX: 0, duration: 0.42, ease: "fold" });
  }, [step]);

  const [createErr, setCreateErr] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setCreateErr(null);
    if (IS_SAMPLE) {
      setTimeout(() => {
        setBusy(false);
        setCreated(`${window.location.origin}/invite/susu#k=${Math.random().toString(36).slice(2, 12)}`);
      }, 2200);
      return;
    }
    try {
      const { chainNow, createParty } = await import("@/lib/kitty/actions");
      const DAY = 86_400;
      const periodSecs = { weekly: 7 * DAY, biweekly: 14 * DAY, monthly: 30 * DAY, demo: 180 }[period];
      const now = await chainNow(); // the schedule runs on the chain's clock
      // Demo parties: 15 minutes to fill, then a night every 3 minutes with 2 grace minutes.
      const formationDeadline = now + (period === "demo" ? 15 * 60 : 7 * DAY);
      const r = await createParty({
        title, word: shownWord, tradition: trad, chipIn: BigInt(chipIn), guests, periodSecs,
        graceSecs: period === "demo" ? 120 : 3 * DAY, startTs: formationDeadline, formationDeadline,
        mode: mode === "seating" ? "seating" : "draw", hostFeeBps: hostBps,
      });
      setCreated(r.link);
    } catch (e) {
      setCreateErr((e as Error).message?.length < 160 ? (e as Error).message : "We couldn't create the party. Try again.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!created || !preview.current) return;
    const s = preview.current.querySelector(".ready-stamp");
    if (s) stamp(s, { theta: -8, surface: preview.current });
  }, [created]);

  // Share card (P2): drawn as soon as the party exists, so the tap can open the share
  // sheet straight away (browsers only allow it right after a tap).
  const cardBlob = useRef<Promise<Blob> | null>(null);
  const drawCard = () => {
    cardBlob.current ??= import("@/lib/shareCard").then(({ renderShareCard }) =>
      renderShareCard({
        invited: copy.finale.invited,
        title,
        word: shownWord,
        lines: [`Chip-in ${formatMoney(chipIn)} · ${PERIOD_TEXT[period]} · ${guests} guests`, "Kitty fee 0.5% · House fee 0.5%", `Host fee ${formatPercentBps(hostBps)}`],
        footnote: copy.devnet,
        art: preview.current?.querySelector<HTMLImageElement>(".preview-arch img") ?? null,
        emblem: preview.current?.querySelector<SVGSVGElement>("svg.preview-emblem") ?? null,
        wordmark: wordmarkBox.current?.querySelector<SVGSVGElement>("svg") ?? null,
      }),
    );
    cardBlob.current.catch(() => (cardBlob.current = null));
    return cardBlob.current;
  };
  useEffect(() => {
    if (created) void drawCard().catch(() => {});
  }, [created]);

  const shareCard = async () => {
    setSharing(true);
    try {
      const blob = await drawCard();
      const { shareOrDownload } = await import("@/lib/shareCard");
      const slug = shownWord.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "party";
      const result = await shareOrDownload(blob, `kitty-invite-${slug}.png`, title);
      if (result === "saved") toast({ text: copy.toast.cardSaved });
    } catch {
      toast({ text: copy.share.cardFailed });
    } finally {
      setSharing(false);
    }
  };

  const summary: string[] = [
    shownWord,
    name || `Your ${shownWord}`,
    `${formatMoney(chipIn)} · ${guests} guests`,
    PERIOD_TEXT[period],
    mode === "draw" ? "The Draw" : mode === "seating" ? "Seating plan" : "Bid night",
    `${formatPercentBps(hostBps)}`,
    "",
  ];

  const body = (i: number) => {
    switch (i) {
      case 0:
        return (
          <>
            <ChipGroup
              label="Tradition"
              value={word}
              onChange={setWord}
              options={[...HOST_WORDS.map((w) => ({ value: w.word, label: w.word, tradition: w.pattern })), { value: "other", label: "+ Other word" }]}
            />
            {word === "other" && <Field label="Your word" placeholder="e.g. hụi, kye, stokvel" value={other} onChange={(e) => setOther(e.target.value)} />}
          </>
        );
      case 1:
        return <Field label={`Name your ${shownWord} (optional)`} placeholder={`Asha's ${shownWord}`} value={name} onChange={(e) => setName(e.target.value)} />;
      case 2:
        return (
          <>
            <Field label="Chip-in per guest, per night" amount value={amount} onChange={(e) => setAmount(e.target.value)} error={amtOk ? null : +amount > 500 ? "Devnet parties cap the chip-in at $500. Try 100." : "That doesn't look like an amount. Try 100."} helper="In test kUSD." />
            <MiniTable n={guests} onChange={setGuests} />
          </>
        );
      case 3:
        return <ChipGroup label="How often" filter value={period} onChange={setPeriod} options={PERIODS} />;
      case 4:
        return (
          <div className="order-cards" role="radiogroup" aria-label="Order">
            {(
              [
                { v: "draw", title: "The Draw", icon: "bowl", body: "A fair draw each night, with verifiable randomness." },
                { v: "seating", title: "Seating plan", icon: "invite", body: "An order everyone accepts before the first night." },
                { v: "bid", title: "Bid night", icon: "envelope", body: "Sealed bids; the discount is shared back.", tag: "After v1" },
              ] as const
            ).map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={mode === o.v} className="order-card" onClick={() => setMode(o.v)} data-focus-ring="" disabled={o.v === "bid"} aria-disabled={o.v === "bid" || undefined} style={o.v === "bid" ? { opacity: 0.55, cursor: "not-allowed" } : undefined}>
                <Icon name={o.icon} size={32} />
                <span className="type-h3">{o.title}</span>
                <span className="type-small" style={{ color: "var(--ink-soft)" }}>
                  {o.body}
                </span>
                {"tag" in o && <Tag variant="family">{o.tag}</Tag>}
              </button>
            ))}
          </div>
        );
      case 5:
        return <Ruler bps={hostBps} onChange={setHostBps} kitty={kitty} />;
      case 6:
        return (
          <>
            <table className="review-table">
              <tbody>
                <tr>
                  <th scope="row">Tradition</th>
                  <td>
                    <em className="type-word">{shownWord}</em>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Guests</th>
                  <td className="tnum">{guests}</td>
                </tr>
                <tr>
                  <th scope="row">Chip-in</th>
                  <td className="type-money">{formatMoney(chipIn, { cents: "always" })}</td>
                </tr>
                <tr>
                  <th scope="row">Kitty fee (0.5%)</th>
                  <td className="type-money">{formatMoney(due.kittyFee, { cents: "always" })}</td>
                </tr>
                <tr>
                  <th scope="row">House fee (0.5%)</th>
                  <td className="type-money">{formatMoney(due.houseFee, { cents: "always" })}</td>
                </tr>
                <tr className="inv-total">
                  <th scope="row">Each guest, each night</th>
                  <td className="type-money-l">{formatMoney(due.total, { cents: "always" })}</td>
                </tr>
                <tr>
                  <th scope="row">Tonight&rsquo;s kitty</th>
                  <td className="type-money">{formatMoney(kitty)}</td>
                </tr>
                <tr>
                  <th scope="row">Host fee ({formatPercentBps(hostBps)} of the kitty)</th>
                  <td className="type-money">{formatMoney((kitty * hostBps) / 10000)}</td>
                </tr>
                <tr>
                  <th scope="row">How often</th>
                  <td>{PERIOD_TEXT[period]}</td>
                </tr>
              </tbody>
            </table>
            <p className="type-body" style={{ color: "var(--ink-soft)" }}>
              You&rsquo;ll RSVP like any guest. Creating the party moves no money.
            </p>
          </>
        );
    }
  };

  return (
    <>
      <PageHeader
        title={
          <>
            Start a <RollWord word={shownWord} />
          </>
        }
        context="Invite-only. Everyone sees the same rules and fees before they RSVP."
      />
      <div className="wizard">
        <ol ref={cards} className="wizard-steps">
          {STEPS.map((label, i) => {
            const open = step === i && !created;
            const isDone = done.includes(i) && step !== i;
            return (
              <li key={label} data-step={i} className={`step-card ${open ? "is-open" : ""}`} data-enter>
                <div className="step-head">
                  <span className="type-label" style={{ color: "var(--ink-soft)" }}>
                    Step {i + 1} of 7 · {label}
                  </span>
                  {isDone && (
                    <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="type-body">{i === 0 ? <em className="type-word">{summary[i]}</em> : summary[i]}</span>
                      {!created && (
                        <button type="button" className="type-label edit-link" onClick={() => setStep(i)} data-focus-ring="">
                          Edit
                        </button>
                      )}
                    </span>
                  )}
                </div>
                {open && (
                  <div className="step-body">
                    {body(i)}
                    <div className="step-actions">
                      {i > 0 && (
                        <Button variant="ghost" onClick={() => go(i - 1)}>
                          Back
                        </Button>
                      )}
                      {i < 6 ? (
                        <Button onClick={() => go(i + 1)} iconEnd="arrow" disabled={(i === 2 && !amtOk) || (i === 0 && word === "other" && !other)} disabledReason={i === 2 && !amtOk ? "Fix the chip-in to continue." : undefined}>
                          {copy.cta.continue}
                        </Button>
                      ) : (
                        <>
                          <Button size="L" busy={busy} onClick={create}>
                            {copy.cta.createParty}
                          </Button>
                          {createErr && (
                            <p className="type-small" role="alert" style={{ color: "var(--saffron)" }}>
                              {createErr}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <aside className="wizard-preview" aria-label="Invite card preview">
          <div ref={preview} className="preview-card paper-fibre foil-frame" data-world="paper">
            <div className="preview-arch">
              <Art id={VIGNETTE[trad]} sizes="120px" world="paper" tradition={trad} />
            </div>
            <span className="type-label" style={{ color: "var(--ink-soft)" }}>
              {copy.finale.invited}
            </span>
            <span className="type-h3" style={{ textAlign: "center" }}>
              {title}
            </span>
            <Emblem partyId={partyId} guests={guests} tradition={trad} size={64} className="preview-emblem" />
            <RollWord word={shownWord} style={{ fontSize: 28 }} />
            <span className="stitch-b" style={{ width: "70%", height: 1 }} aria-hidden="true" />
            <p className="type-mono" style={{ fontSize: 13, textAlign: "center", lineHeight: 1.6 }}>
              Chip-in {formatMoney(chipIn)} · {PERIOD_TEXT[period]} · {guests}
              <br />
              Kitty&nbsp;fee&nbsp;0.5% · House&nbsp;fee&nbsp;0.5% · Host&nbsp;fee&nbsp;{formatPercentBps(hostBps)}
            </p>
            {created && <Stamp className="ready-stamp" label="Ready to send" ink="teal" style={{ position: "absolute", bottom: 60, right: 20 }} />}
          </div>
          {created && (
            <div className="share-row" data-world="paper">
              <div className="share-link">
                <span className="type-mono" title={created}>
                  {truncateId(created, 28, 10)}
                </span>
                <CopyButton value={created} label="Copy invite link" onCopied={() => toast({ text: copy.toast.copied, icon: "copy" })} />
              </div>
              <p className="type-small" style={{ color: "var(--ink-soft)" }}>
                The invite secret is in the link. Share it only with your guests.
              </p>
              <Button variant="ghost" busy={sharing} onClick={shareCard}>
                {sharing ? copy.share.cardBusy : copy.share.card}
              </Button>
              <p className="type-small" style={{ color: "var(--ink-soft)" }}>
                {copy.share.cardNote}
              </p>
              {/* Source for the card image's wordmark (lib/shareCard). */}
              <div ref={wordmarkBox} hidden aria-hidden="true">
                <Wordmark height={64} ink="#F6EEDF" />
              </div>
              {!IS_SAMPLE && (
                <Button href={created.replace(/^https?:\/\/[^/]+/, "")} iconEnd="arrow">
                  RSVP to your party
                </Button>
              )}
              <Button href="/parties" variant="ghost">
                Go to your parties
              </Button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
