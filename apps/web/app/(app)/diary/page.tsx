"use client";
/**
 * Party Diary (brief 13.8). Only you can read it. Your seat card, kitty limit and totals
 * on the left; the booklet on the right with ribbon bookmarks — Stamps · Seats ·
 * Farewells · Show a page — that turn to their spread. On hold, a slip is clipped over it.
 */
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { dollars, earliestSeat, exampleParty, formatMoney, kittyLimit, TIER_NAMES, type Tier } from "@kitty/sdk";
import { Button } from "@kitty/ui/components/Button";
import { Butler } from "@kitty/ui/components/Butler";
import { Money } from "@kitty/ui/components/Money";
import { Stamp } from "@kitty/ui/components/Stamp";
import { Tag } from "@kitty/ui/components/Tag";
import { Emblem } from "@kitty/ui/generators/emblem";
import { PageHeader } from "@/components/chrome/PageHeader";
import { Booklet, BookletCover, DiaryPage } from "@/components/stage/Booklet";
import { copy, t } from "@/copy/en";
import { IS_SAMPLE, useMe, useParties } from "@/data/api";

const RIBBONS = ["Stamps", "Seats", "Farewells", "Show a page"] as const;
const RIBBON_COLOURS = ["var(--teal)", "var(--ochre, #C28A2C)", "var(--plum)", "var(--saffron)"];

function useSingle() {
  const [s, setS] = useState(false);
  useLayoutEffect(() => {
    const on = () => setS(window.innerWidth < 1024);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return s;
}

function SeatCard({ tier, active, guests = 10 }: { tier: Tier; active?: boolean; guests?: number }) {
  return (
    <div className="seat-card" data-active={active || undefined}>
      <Tag variant={tier === 2 ? "family" : tier === 1 ? "regular" : "guest"}>{TIER_NAMES[tier]}</Tag>
      <span className="type-h2">Seat {earliestSeat(tier, guests)}+</span>
      <span className="type-small" style={{ color: "var(--ink-soft)" }}>
        Keepsafe {["75%", "50%", "25%"][tier]} of what&rsquo;s still owed
      </span>
    </div>
  );
}

export default function DiaryPageScreen() {
  const me = useMe();
  const parties = useParties();
  const single = useSingle();
  const [spread, setSpread] = useState(0);
  const [demo, setDemo] = useState<string | null>(null);
  useEffect(() => setDemo(new URLSearchParams(window.location.search).get("demo")), []);

  const tier = me.data?.tier ?? 0;
  const lifetime = me.data?.lifetimeChippedIn ?? 0;
  const limit = kittyLimit(lifetime, dollars(100));
  const onHold = demo === "onhold" ? exampleParty().settleUp : null;
  const empty = demo === "empty";

  const stamps = useMemo(() => {
    const out: { party: string; night: number; id: string; tradition: string }[] = [];
    (parties.data ?? []).forEach((p) => {
      if (!p.me) return;
      const paidThrough = p.status === "finished" ? p.guests : p.me.paidTonight ? p.night : p.night - 1;
      for (let n = 1; n <= paidThrough; n++) out.push({ party: p.title, night: n, id: p.id, tradition: p.tradition });
    });
    return out.slice(0, 14);
  }, [parties.data]);
  const farewells = (parties.data ?? []).filter((p) => p.status === "finished");

  const stampGrid = (list: typeof stamps) => (
    <div className="stamp-grid">
      {list.map((s, i) => (
        <Stamp key={`${s.id}-${s.night}`} shape="round" size={84} ink="teal" label="Paid" seed={`${s.id}${s.night}`} sub={<text x="0" y="6" textAnchor="middle" style={{ font: "600 17px var(--font-sans)" }} fill="currentColor">{`N${s.night}`}</text>} style={{ opacity: 1 - i * 0.015 }} />
      ))}
    </div>
  );

  const pages = empty
    ? [
        <DiaryPage key="e1" n={1} perforated="left">
          <p className="type-label" style={{ color: "var(--ink-soft)" }}>
            Stamps
          </p>
        </DiaryPage>,
        <DiaryPage key="e2" n={2} perforated="none">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, textAlign: "center" }}>
            <Butler size={100} />
            <p className="type-body">Your first stamp comes with your first chip-in.</p>
          </div>
        </DiaryPage>,
      ]
    : [
        <DiaryPage key="p1" n={1} perforated="left">
          <p className="type-label" style={{ color: "var(--ink-soft)" }}>
            Stamps · {stamps.length} chip-ins
          </p>
          {stampGrid(stamps.slice(0, 7))}
        </DiaryPage>,
        <DiaryPage key="p2" n={2} perforated="none">
          {stampGrid(stamps.slice(7, 14))}
          <p className="type-small" style={{ color: "var(--ink-soft)", marginTop: "auto" }}>
            Every chip-in stamps a page.
          </p>
        </DiaryPage>,
        <DiaryPage key="p3" n={3} perforated="left">
          <p className="type-label" style={{ color: "var(--ink-soft)" }}>
            Your seat
          </p>
          <SeatCard tier={tier} active />
          <p className="type-body">Finish parties, move closer to the head of the table.</p>
        </DiaryPage>,
        <DiaryPage key="p4" n={4} perforated="none">
          <p className="type-label" style={{ color: "var(--ink-soft)" }}>
            Seats, for 10 guests
          </p>
          {([0, 1, 2] as Tier[]).map((tr) => (
            <SeatCard key={tr} tier={tr} active={tr === tier} />
          ))}
        </DiaryPage>,
        <DiaryPage key="p5" n={5} perforated="left">
          <p className="type-label" style={{ color: "var(--ink-soft)" }}>
            Farewells
          </p>
          {farewells.map((f) => (
            <div key={f.id} className="farewell-entry">
              <Emblem partyId={f.id} guests={f.guests} tradition={f.tradition} size={64} />
              <div>
                <p className="type-h3">{f.title}</p>
                <p className="type-small" style={{ color: "var(--ink-soft)" }}>
                  <em className="type-word">{f.word}</em> · {f.guests} nights · never late
                </p>
              </div>
            </div>
          ))}
        </DiaryPage>,
        <DiaryPage key="p6" n={6} perforated="none">
          <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
            <Stamp shape="round" size={140} ink="plum" label="Farewell" seed="farewell-office" />
          </div>
        </DiaryPage>,
        <DiaryPage key="p7" n={7} perforated="left">
          <p className="type-label" style={{ color: "var(--ink-soft)" }}>
            Show a page
          </p>
          <p className="type-h2">Show one page. Nothing else.</p>
          <p className="type-body" style={{ color: "var(--ink-soft)" }}>
            Prove something like &ldquo;finished at least 1 party, never late&rdquo; to a new circle or a lender, without showing which parties or how much.
          </p>
        </DiaryPage>,
        <DiaryPage key="p8" n={8} perforated="none">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", height: "100%", gap: 16 }}>
            <Button href="/diary/show" variant="money" icon="booklet">
              {copy.cta.showPage}
            </Button>
            <p className="type-small" style={{ color: "var(--ink-soft)" }}>
              Each page is made for one reader.
            </p>
          </div>
        </DiaryPage>,
      ];

  const ribbonSpread = (i: number) => (single ? [0, 2, 4, 6][i] : i);

  return (
    <>
      <PageHeader title="Party Diary" context="Only you can read it." eyebrow={IS_SAMPLE ? "Devnet sample" : undefined} />
      <div className="diary-layout">
        <aside className="diary-stats" data-enter>
          <SeatCard tier={tier} active />
          <p className="type-small" style={{ color: "var(--ink-soft)" }}>
            Earliest seat: {earliestSeat(tier, 10)} of 10
          </p>
          <div className="stitch-t" style={{ paddingTop: 20 }}>
            <p className="type-label" style={{ color: "var(--ink-soft)" }}>
              Kitty limit
            </p>
            <Money micro={limit} size="money-l" />
            <p className="type-small" style={{ color: "var(--ink-soft)", marginTop: 6 }}>
              Half of what you&rsquo;ve chipped in to finished parties, plus one chip-in. It caps what you can take early across all your parties.
            </p>
          </div>
          <dl className="diary-dl stitch-t">
            <dt>Parties finished</dt>
            <dd className="type-money">{me.data?.partiesFinished ?? 0}</dd>
            <dt>Never late</dt>
            <dd className="type-money">{me.data?.neverLate ?? 0}</dd>
            <dt>Lifetime chipped in</dt>
            <dd>
              <Money micro={lifetime} />
            </dd>
          </dl>
        </aside>

        <section className="diary-book" data-enter aria-label="Your Diary">
          <nav className="ribbons" aria-label="Diary sections">
            {RIBBONS.map((r, i) => (
              <button
                key={r}
                type="button"
                className="ribbon type-label"
                aria-current={Math.floor(spread / (single ? 2 : 1)) === i || undefined}
                style={{ "--ribbon": RIBBON_COLOURS[i] } as React.CSSProperties}
                onClick={() => setSpread(ribbonSpread(i))}
                data-focus-ring=""
                disabled={empty}
              >
                {r}
              </button>
            ))}
          </nav>
          <div className="booklet-wrap">
            <Booklet pages={pages} spread={spread} single={single} />
            {single && !empty && (
              <div className="page-nav">
                <Button size="S" variant="ghost" onClick={() => setSpread((s) => Math.max(0, s - 1))} disabled={spread === 0}>
                  Previous page
                </Button>
                <Button size="S" variant="ghost" onClick={() => setSpread((s) => Math.min(pages.length - 1, s + 1))} disabled={spread >= pages.length - 1}>
                  Next page
                </Button>
              </div>
            )}
            {onHold != null && (
              <div className="hold-slip paper-fibre" role="alert" data-world="paper">
                <span className="hold-clip" aria-hidden="true" />
                <p className="type-h3">{copy.status.onHold}</p>
                <p className="type-small" style={{ color: "var(--ink-soft)" }}>
                  The House Fund covered {formatMoney(exampleParty().cover.fromHouse)} for you, plus a late fee for each missed night.
                </p>
                <Button variant="money" href="/diary?demo=">
                  {t(copy.cta.settleUp, { amount: formatMoney(onHold, { cents: "always" }) })}
                </Button>
              </div>
            )}
          </div>
          <div className="sr-only">
            <BookletCover />
          </div>
        </section>
      </div>
    </>
  );
}
