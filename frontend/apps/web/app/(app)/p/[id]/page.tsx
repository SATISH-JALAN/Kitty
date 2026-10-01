"use client";
/**
 * Party page (brief 13.6): the table with every guest by party name, tonight's lantern,
 * your seat outlined; folder tabs for Nights · Guests · House Fund · Rules. States for a
 * forming party (empty place cards), a finished one (Farewell), and seating-plan mode.
 */
import { useParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { earliestSeat, formatMoney, formatPercentBps, formatWhen, perNightDue, TIER_NAMES } from "@kitty/sdk";
import { gsap } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { Button, TextLink } from "@kitty/ui/components/Button";
import { CopyButton } from "@kitty/ui/components/CopyButton";
import { Money } from "@kitty/ui/components/Money";
import { Tag } from "@kitty/ui/components/Tag";
import { toast } from "@kitty/ui/components/Toast";
import { TwineRail } from "@kitty/ui/components/TwineRail";
import { Emblem } from "@kitty/ui/generators/emblem";
import { Mask } from "@kitty/ui/generators/mask";
import { Table, seatPoint } from "@/components/stage/Table";
import { copy, t } from "@/copy/en";
import { IS_SAMPLE, useHouse, useParty } from "@/data/api";
import type { Party } from "@/data/types";

type TabId = "nights" | "guests" | "house" | "rules";
const TABS: { id: TabId; label: string }[] = [
  { id: "nights", label: "Nights" },
  { id: "guests", label: "Guests" },
  { id: "house", label: "House Fund" },
  { id: "rules", label: "Rules" },
];
const PERIOD: Record<Party["period"], string> = { weekly: "weekly", biweekly: "every 2 weeks", monthly: "monthly", demo: "every 3 minutes (demo)" };

function useD() {
  const [D, setD] = useState(460);
  useLayoutEffect(() => {
    const on = () => setD(window.innerWidth < 1024 ? Math.min(window.innerWidth * 0.8, 420) : Math.min(520, window.innerWidth * 0.34));
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return D;
}

function Nights({ p }: { p: Party }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TwineRail count={p.guests} active={p.status === "forming" ? null : Math.min(p.guests, p.night) - 1} done={Array.from({ length: Math.max(0, p.night - 1) }, (_, i) => i)} labels={Array.from({ length: p.guests }, (_, i) => `N${i + 1}`)} height={40} />
      <ol className="nights-list">
        {p.nights.map((n) => {
          const taker = n.takerIdx != null ? p.seats[n.takerIdx] : undefined;
          return (
            <li key={n.night} className="stitch-b" data-state={n.state}>
              <span className="type-mono">N{n.night}</span>
              {n.state === "done" && taker && (
                <>
                  <span className="type-body" style={{ flex: 1, minWidth: 0 }}>
                    <em className="type-word">{taker.name}</em> took the kitty
                  </span>
                  <Tag variant="paid">Stamped</Tag>
                </>
              )}
              {n.state === "tonight" && (
                <span className="type-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  {p.mode === "draw" ? "Draw" : "Seating plan"} {formatWhen(new Date(p.nextAt))}
                  {p.mode === "draw" && (
                    <Button href={`/p/${p.id}/draw`} size="S" icon="bowl">
                      {copy.cta.watchDraw}
                    </Button>
                  )}
                </span>
              )}
              {n.state === "upcoming" && (
                <span className="type-body" style={{ color: "var(--ink-soft)" }}>
                  {new Date(n.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Guests({ p }: { p: Party }) {
  return (
    <ul className="guests-list">
      {p.seats.map((s) => (
        <li key={s.idx} className="stitch-b">
          <Mask colour={s.colour} animal={s.animal} tradition={p.tradition} width={40} />
          <span className="type-word" style={{ fontSize: 18 }}>
            {s.name}
          </span>
          {p.me?.idx === s.idx && <Tag>You</Tag>}
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Tag variant={s.tier === 2 ? "family" : s.tier === 1 ? "regular" : "guest"}>{TIER_NAMES[s.tier]}</Tag>
            {p.status === "active" && <Tag variant={s.tonight === "grace" ? "grace" : s.tonight === "due" ? "neutral" : "paid"}>{s.tonight === "grace" ? "In grace hours" : s.tonight === "due" ? "Due" : "Paid"}</Tag>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function House() {
  const h = useHouse();
  if (!h.data) return <div className="fold-lines" style={{ height: 160 }} />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p className="type-body">{copy.house.line}</p>
      <dl className="inv-dl">
        <dt>Balance</dt>
        <dd>
          <Money micro={h.data.balance} />
        </dd>
        <dt>Default rate</dt>
        <dd className="tnum">{(h.data.defaultRateBps / 100).toFixed(1)}%</dd>
        <dt>Reserve</dt>
        <dd>{h.data.reserveOk ? "Above the 10% reserve" : "Below the 10% reserve: new parties pause"}</dd>
      </dl>
      <TextLink href="/house">Open the House Fund</TextLink>
    </div>
  );
}

function Rules({ p }: { p: Party }) {
  const due = perNightDue(p.chipIn);
  return (
    <dl className="inv-dl">
      <dt>Chip-in</dt>
      <dd>
        <span className="type-money">{formatMoney(p.chipIn)}</span> {PERIOD[p.period]}
      </dd>
      <dt>Each night</dt>
      <dd>
        <span className="type-money">{formatMoney(due.total, { cents: "always" })}</span> incl. Kitty fee and House fee
      </dd>
      <dt>Host fee</dt>
      <dd>{formatPercentBps(p.hostFeeBps)} of the kitty</dd>
      <dt>Order</dt>
      <dd>{p.mode === "draw" ? "The Draw" : p.mode === "seating" ? "Seating plan" : "Bid night"}</dd>
      <dt>Earliest seats</dt>
      <dd>
        Guest {earliestSeat(0, p.guests)} · Regular {earliestSeat(1, p.guests)} · Family {earliestSeat(2, p.guests)}
      </dd>
      <dt>Grace hours</dt>
      <dd>72</dd>
    </dl>
  );
}

export default function PartyPage() {
  const { id } = useParams<{ id: string }>();
  const { data: p, isPending, isError, refetch } = useParty(id);
  const D = useD();
  const [tab, setTab] = useState<TabId>("nights");
  const [seat, setSeat] = useState<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // Switching tabs slides the panel out from behind the tab edge.
  useEffect(() => {
    if (!panel.current || prefersReducedMotion()) return;
    gsap.fromTo(panel.current, { yPercent: -6, clipPath: "inset(0 0 100% 0)" }, { yPercent: 0, clipPath: "inset(0 0 0% 0)", duration: 0.42, ease: "paper", clearProps: "clipPath,transform" });
  }, [tab]);

  useEffect(() => {
    if (seat == null) return;
    const close = () => setSeat(null);
    const t = setTimeout(() => window.addEventListener("pointerdown", close, { once: true }), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", close);
    };
  }, [seat]);

  if (isError)
    return (
      <div className="card" role="alert">
        <p className="type-body">{copy.error.network}</p>
        <div style={{ marginTop: 16 }}>
          <Button variant="ghost" size="S" onClick={() => refetch()}>
            {copy.cta.retry}
          </Button>
        </div>
      </div>
    );
  if (isPending || !p) return <div className="fold-lines" style={{ height: 520 }} aria-busy="true" />;

  const kitty = p.chipIn * p.guests;
  const forming = p.status === "forming";
  const finished = p.status === "finished";
  const tonightTaker = p.nights.find((n) => n.state === "tonight");
  const seatsShown = forming ? [...p.seats, ...Array.from({ length: p.guests - p.seats.length }, (_, i) => ({ idx: p.seats.length + i, name: "", colour: 9, animal: 0, tier: 0 as const, tonight: "due" as const }))] : p.seats;
  const selected = seat != null ? p.seats[seat] : undefined;

  return (
    <>
      <header className="party-head" data-enter>
        <span data-flip-id={`emblem-${p.id}`}>
          <Emblem partyId={p.id} guests={p.guests} tradition={p.tradition} size={120} title={`${p.title} emblem`} />
        </span>
        <div className="party-head-text">
          {IS_SAMPLE && (
            <span className="type-label" style={{ color: "var(--ink-soft)" }}>
              Devnet sample
            </span>
          )}
          <h1 className="type-h1">{p.title}</h1>
          <p style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <em className="type-word" style={{ fontSize: 22 }}>
              {p.word}
            </em>
            <Tag variant={p.status === "active" ? "active" : p.status === "forming" ? "forming" : "finished"}>{p.status === "active" ? "Active" : p.status === "forming" ? "Forming" : "Finished"}</Tag>
          </p>
          <p className="type-small" style={{ color: "var(--ink-soft)" }}>
            Hosted by <em className="type-word">{p.hostName}</em> · {p.guests} guests · {PERIOD[p.period]}
          </p>
        </div>
        <div className="party-head-kitty">
          <span className="type-label" style={{ color: "var(--ink-soft)" }}>
            Tonight&rsquo;s kitty
          </span>
          <Money micro={kitty} size="money-xl" />
          {!finished && !forming && <span className="type-small">{formatWhen(new Date(p.nextAt))}</span>}
        </div>
      </header>

      {finished && (
        <div className="farewell-banner foil-frame" data-enter>
          <span className="type-h2">Farewell night!</span>
          <span className="type-body">Everyone who paid in full has a Farewell page in their Diary.</span>
        </div>
      )}

      <div className="party-body">
        <section className="party-table" aria-label="The table" data-enter>
          <div style={{ position: "relative", filter: finished ? "drop-shadow(0 0 24px rgba(255,210,122,.55))" : undefined }}>
            <Table
              ref={table}
              D={D}
              guests={seatsShown.map((s) => ({ name: s.name || "Empty seat", colour: s.colour, animal: s.animal }))}
              tradition={p.tradition}
              world="paper"
              you={p.me?.idx}
              litSeat={p.status === "active" && tonightTaker ? (p.mode === "seating" ? p.night - 1 : null) : null}
              seatOrder={p.mode === "seating"}
              onSeat={forming ? undefined : (i) => setSeat(i)}
            >
              {p.me && (
                <span
                  className="you-tag"
                  style={{ position: "absolute", left: seatPoint(p.me.idx, p.guests, D, 0.24).x, top: seatPoint(p.me.idx, p.guests, D, 0.24).y, translate: "-50% -50%" }}
                >
                  <Tag>You</Tag>
                </span>
              )}
              {selected && seat != null && (
                <span role="tooltip" className="seat-tip" style={{ position: "absolute", left: seatPoint(seat, p.guests, D).x, top: seatPoint(seat, p.guests, D).y - 0.14 * D }}>
                  <span className="seat-tip-string" aria-hidden="true" />
                  <span className="seat-tip-card">
                    <em className="type-word" style={{ fontSize: 16 }}>
                      {selected.name}
                    </em>
                    <span className="type-small">{selected.tonight === "grace" ? "In grace hours" : selected.tonight === "due" ? "Due tonight" : "Paid"}</span>
                  </span>
                </span>
              )}
            </Table>
          </div>
          {forming && (
            <div className="forming-note">
              <p className="type-body">{t(copy.status.forming, { n: p.guests - (p.rsvps ?? 0), day: p.startsBy ?? "" })}</p>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="type-small" style={{ color: "var(--ink-soft)" }}>
                  {copy.cta.copyInvite}
                </span>
                <CopyButton value={`${origin}/invite/${p.id}#k=demo`} label={copy.cta.copyInvite} onCopied={() => toast({ text: copy.toast.copied, icon: "copy" })} />
              </span>
            </div>
          )}
        </section>

        <section className="party-tabs" data-enter>
          <div role="tablist" aria-label="Party details" className="folder-tabs">
            {TABS.map((tb) => (
              <button
                key={tb.id}
                role="tab"
                id={`tab-${tb.id}`}
                aria-selected={tab === tb.id}
                aria-controls={`panel-${tb.id}`}
                tabIndex={tab === tb.id ? 0 : -1}
                onClick={() => setTab(tb.id)}
                onKeyDown={(e) => {
                  const i = TABS.findIndex((x) => x.id === tab);
                  if (e.key === "ArrowRight") setTab(TABS[(i + 1) % TABS.length].id);
                  if (e.key === "ArrowLeft") setTab(TABS[(i - 1 + TABS.length) % TABS.length].id);
                }}
                className="folder-tab type-label"
                data-focus-ring=""
              >
                {tb.label}
              </button>
            ))}
          </div>
          <div className="folder-panel paper-fibre">
            <div ref={panel} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
              {tab === "nights" && <Nights p={p} />}
              {tab === "guests" && <Guests p={p} />}
              {tab === "house" && <House />}
              {tab === "rules" && <Rules p={p} />}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
