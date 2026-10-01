"use client";
/**
 * Tonight (brief 13.2), the home screen: what's due, the next Draw, your keepsafe,
 * grace hours if any, the Butler's note, and your parties. Plain at money.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { demoTag, formatDay, formatMoney, formatWhen, perNightDue } from "@kitty/sdk";
import { gsap } from "@kitty/ui/motion/gsap";
import { getFlip, type FlipState } from "@kitty/ui/motion/flip";
import { stamp } from "@kitty/ui/motion/primitives/physical";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { Button } from "@kitty/ui/components/Button";
import { Butler, EmptyState } from "@kitty/ui/components/Butler";
import { Chit } from "@kitty/ui/components/Chit";
import { GraceRing, KeepsafeMeter } from "@kitty/ui/components/Meters";
import { Money } from "@kitty/ui/components/Money";
import { PartyCard } from "@kitty/ui/components/PartyCard";
import { Tag } from "@kitty/ui/components/Tag";
import { toast } from "@kitty/ui/components/Toast";
import { Emblem } from "@kitty/ui/generators/emblem";
import { PageHeader } from "@/components/chrome/PageHeader";
import { copy, t } from "@/copy/en";
import { IS_SAMPLE, statusOf, useChipIn, useParties } from "@/data/api";
import type { Party } from "@/data/types";

function useNow(ms = 1000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function countdown(to: Date, now: Date) {
  const s = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h >= 48 ? `${Math.floor(h / 24)} days` : `${pad(h)} : ${pad(m)} : ${pad(sec)}`;
}

function DueRow({ p, onPaid, register, docked }: { p: Party; onPaid: (p: Party) => void; register: (id: string, pay: () => void) => void; docked: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  const chip = useChipIn();
  const due = perNightDue(p.chipIn);
  const paid = !!p.me?.paidTonight;
  const when = formatWhen(new Date(p.nextAt));
  const [paidAt, setPaidAt] = useState<string | null>(null);

  const pay = () =>
    chip.mutate(
      { partyId: p.id, night: p.night },
      {
        onSuccess: () => {
          setPaidAt(formatWhen(new Date()).replace(",", ""));
          onPaid(p);
        },
      },
    );

  register(p.id, pay);

  useEffect(() => {
    if (!paidAt || !ref.current) return;
    const s = ref.current.querySelector(".row-stamp");
    if (s) stamp(s, { theta: -8, surface: ref.current.querySelector(".chit") });
  }, [paidAt]);

  return (
    <li ref={ref} id={`due-${p.id}`} data-flip-id={`due-${p.id}`} className="due-row stitch-b">
      <span className="due-chit" style={{ position: "relative" }}>
        <Chit width={72} state={paid && !paidAt ? "stamped" : "blank"}>
          {formatMoney(p.chipIn)}
        </Chit>
        {paidAt && (
          <svg className="row-stamp" viewBox="0 0 40 40" width="32" height="32" style={{ position: "absolute", right: -8, top: -10, filter: "url(#ink)" }} aria-hidden="true">
            <circle cx="20" cy="20" r="17" fill="none" stroke="var(--teal)" strokeWidth="2" />
            <circle cx="20" cy="20" r="13.5" fill="none" stroke="var(--teal)" strokeWidth="1" />
            <path d="M13 20.5l4.5 4.5 9-9.5" fill="none" stroke="var(--teal)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <Emblem partyId={p.id} guests={p.guests} tradition={p.tradition} size={40} />
      <span className="due-main">
        <span className="type-h3">{p.title}</span>
        <span className="type-mono" style={{ color: "var(--ink-soft)" }}>
          Night {p.night}/{p.guests}
        </span>
      </span>
      <span className="due-money">
        {paid || paidAt ? (
          <span className="type-body" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {t(copy.status.paid, { time: paidAt ?? when.replace(",", "") })}
            <Tag variant="paid">Paid</Tag>
          </span>
        ) : (
          <>
            <span className="type-body">
              <Money micro={due.total} cents="always" /> due · {when}
            </span>
            <Button variant="money" size="S" busy={chip.isPending} onClick={pay}>
              {copy.cta.chipIn}
            </Button>
          </>
        )}
      </span>
      {docked && !paid && !paidAt && (
        <div className="dock-action">
          <Button variant="money" size="L" block busy={chip.isPending} onClick={pay}>
            {copy.cta.chipIn} · {formatMoney(due.total, { cents: "always" })}
          </Button>
        </div>
      )}
    </li>
  );
}

function Blank({ h }: { h: number }) {
  return <div className="fold-lines" style={{ height: h }} aria-hidden="true" />;
}

export default function TonightPage() {
  const q = useParties();
  const status = statusOf(q, (d: Party[]) => d.filter((p) => p.status === "active").length === 0);
  const now = useNow();
  const list = useRef<HTMLUListElement>(null);
  const flipState = useRef<FlipState | null>(null);
  const payers = useRef(new Map<string, () => void>());
  const register = (id: string, pay: () => void) => payers.current.set(id, pay);

  const active = useMemo(() => (q.data ?? []).filter((p) => p.status === "active"), [q.data]);
  // Due first, then paid (Flip settles the row into place after a chip-in).
  const rows = useMemo(() => [...active].sort((a, b) => Number(!!a.me?.paidTonight) - Number(!!b.me?.paidTonight)), [active]);
  const dueCount = rows.filter((p) => !p.me?.paidTonight).length;
  const grace = active.find((p) => p.me?.graceHoursLeft != null && !p.me.paidTonight);
  const keep = active.find((p) => p.me?.keepsafe);
  const nextDraw = [...active].filter((p) => p.mode === "draw").sort((a, b) => +new Date(a.nextAt) - +new Date(b.nextAt))[0];
  const autopay = active.filter((p) => p.me?.autopay).length;
  const urgent = grace ?? rows.find((p) => !p.me?.paidTonight);

  useLayoutEffect(() => {
    const Flip = getFlip();
    if (!flipState.current || !list.current || !Flip) return;
    Flip.from(flipState.current, { duration: prefersReducedMotion() ? 0 : 0.48, ease: "paper", targets: list.current.children });
    flipState.current = null;
  }, [rows]);

  const onPaid = (p: Party) => {
    const Flip = getFlip();
    if (list.current && Flip) flipState.current = Flip.getState(list.current.children);
    toast({ text: t(copy.toast.stamped, { n: p.night }) });
  };

  const context = now ? `${formatDay(now)} · ${dueCount === 0 ? "nothing due" : `${dueCount} chip-in${dueCount > 1 ? "s" : ""} due`}` : " ";

  return (
    <>
      <PageHeader title={copy.nav.tonight} context={context} eyebrow={IS_SAMPLE ? "Devnet sample" : undefined} />

      {status === "error" && (
        <div className="card" role="alert" data-enter>
          <p className="type-body">{copy.error.network}</p>
          <div style={{ marginTop: 16 }}>
            <Button variant="ghost" size="S" onClick={() => q.refetch()}>
              {copy.cta.retry}
            </Button>
          </div>
        </div>
      )}

      {status === "empty" && (
        <div className="card" data-enter>
          <EmptyState title={copy.empty.tonight} body="Open an invite card or start a party." action={{ label: copy.cta.startParty, href: "/parties/new" }} />
        </div>
      )}

      {status === "loading" && (
        <div className="app-grid" aria-busy="true" aria-label="Loading">
          <div className="span-8">
            <Blank h={236} />
          </div>
          <div className="span-4">
            <Blank h={236} />
          </div>
          <div className="span-6">
            <Blank h={150} />
          </div>
          <div className="span-6">
            <Blank h={150} />
          </div>
        </div>
      )}

      {status === "ready" && (
        <div className="app-grid tonight-grid">
          <section className="card span-8 t-due" aria-labelledby="due-h" data-enter>
            <h2 id="due-h" className="type-label" style={{ color: "var(--ink-soft)", marginBottom: 8 }}>
              Due tonight
            </h2>
            <ul ref={list} className="due-list">
              {rows.map((p) => (
                <DueRow key={p.id} p={p} onPaid={onPaid} register={register} docked={p.id === urgent?.id} />
              ))}
            </ul>
          </section>

          {nextDraw && (
            <section className="card span-4 t-draw" aria-labelledby="draw-h" data-enter>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <Emblem partyId={nextDraw.id} guests={nextDraw.guests} tradition={nextDraw.tradition} size={64} />
                <div>
                  <h2 id="draw-h" className="type-label" style={{ color: "var(--ink-soft)" }}>
                    Next Draw
                  </h2>
                  <p className="type-h3">Night {nextDraw.night}</p>
                  <p className="type-small" style={{ color: "var(--ink-soft)" }}>
                    {nextDraw.title}
                  </p>
                </div>
              </div>
              <p className="type-money-l tnum" style={{ margin: "20px 0" }} aria-label="Time until the Draw">
                {now ? countdown(new Date(nextDraw.nextAt), now) : " "}
              </p>
              <Button href={`/p/${nextDraw.id}/draw`} icon="bowl">
                {copy.cta.watchDraw}
              </Button>
            </section>
          )}

          {keep?.me?.keepsafe && (
            <section className="card span-6 t-keep" aria-labelledby="keep-h" data-enter>
              <h2 id="keep-h" className="type-label" style={{ color: "var(--ink-soft)", marginBottom: 16 }}>
                Keepsafe · {keep.title}
              </h2>
              <KeepsafeMeter
                total={keep.me.keepsafe.total}
                back={keep.me.keepsafe.back}
                line={
                  <>
                    Keepsafe <b>{formatMoney(keep.me.keepsafe.total)}</b> · <b>{formatMoney(keep.me.keepsafe.back)}</b> back so far
                  </>
                }
              />
            </section>
          )}

          {grace?.me?.graceHoursLeft != null && (
            <section className="card span-6 t-grace" aria-labelledby="grace-h" data-enter>
              <h2 id="grace-h" className="type-label" style={{ color: "var(--ink-soft)", marginBottom: 16 }}>
                Grace hours · {grace.title}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <GraceRing hoursLeft={grace.me.graceHoursLeft} />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                  <p className="type-body">
                    <b className="type-money">{grace.me.graceHoursLeft}</b> grace hours left · <Money micro={perNightDue(grace.chipIn).total} cents="always" /> due
                  </p>
                  <p className="type-small" style={{ color: "var(--ink-soft)" }}>
                    {t(copy.nudge.due, { n: grace.night })}
                  </p>
                  <Button variant="money" size="S" onClick={() => payers.current.get(grace.id)?.()}>
                    {copy.cta.chipIn}
                  </Button>
                </div>
              </div>
            </section>
          )}

          <section className="butler-strip t-butler" data-enter aria-label="The Butler">
            <Butler size={40} />
            <p className="type-body">
              The Butler collects chip-ins at 8 pm. Auto-pay is on for {autopay} {autopay === 1 ? "party" : "parties"}.
            </p>
          </section>

          <section className="t-parties" aria-labelledby="parties-h" data-enter>
            <h2 id="parties-h" className="type-h2" style={{ marginBottom: 16 }}>
              Your parties
            </h2>
            <div className="party-row">
              {(q.data ?? []).map((p) => (
                <div key={p.id} className="party-row-item">
                  <PartyCard
                    href={`/p/${p.id}`}
                    party={{
                      id: p.id,
                      title: p.title,
                      word: p.word,
                      tradition: p.tradition,
                      guests: p.guests,
                      night: p.night,
                      kitty: p.chipIn * p.guests,
                      status: p.status,
                      rsvps: p.rsvps,
                      startsBy: p.startsBy,
                      myTag: p.me ? demoTag(p.me.tag) : undefined,
                      myName: p.me ? p.seats[p.me.idx]?.name : undefined,
                      next: p.status === "active" ? formatWhen(new Date(p.nextAt)) : undefined,
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

    </>
  );
}
