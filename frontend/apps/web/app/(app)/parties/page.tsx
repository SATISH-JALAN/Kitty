"use client";
/**
 * Parties (brief 13.3): your parties as invite cards, dealt onto the table in reading
 * order; filter chips re-deal them with Flip. The first card is always "Start a party".
 */
import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatWhen, hashString } from "@kitty/sdk";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { getFlip, type FlipState } from "@kitty/ui/motion/flip";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { Button } from "@kitty/ui/components/Button";
import { EmptyState } from "@kitty/ui/components/Butler";
import { ChipGroup } from "@kitty/ui/components/Chip";
import { PartyCard } from "@kitty/ui/components/PartyCard";
import { PageHeader } from "@/components/chrome/PageHeader";
import { copy } from "@/copy/en";
import { IS_SAMPLE, statusOf, useParties } from "@/data/api";
import type { Party } from "@/data/types";

type Filter = "active" | "forming" | "finished";

function StartCard() {
  return (
    <Link href="/parties/new" className="start-card" data-focus-ring="">
      <span className="start-plus" aria-hidden="true">
        <span />
        <span />
      </span>
      <span className="type-h3">{copy.cta.startParty}</span>
      <span className="type-small" style={{ color: "var(--ink-soft)" }}>
        Pick your tradition, set the chip-in, share the invite card.
      </span>
    </Link>
  );
}

export default function PartiesPage() {
  const q = useParties();
  const [filter, setFilter] = useState<Filter>("active");
  const grid = useRef<HTMLDivElement>(null);
  const flip = useRef<FlipState | null>(null);
  const status = statusOf(q, (d: Party[]) => d.length === 0);
  const list = useMemo(() => (q.data ?? []).filter((p) => p.status === filter), [q.data, filter]);

  // Deal the cards onto the table on enter.
  useGSAP(
    () => {
      if (status !== "ready" || prefersReducedMotion() || !grid.current) return;
      const cards = Array.from(grid.current.querySelectorAll<HTMLElement>(".deal"));
      cards.forEach((c, i) => {
        const r = ((hashString(c.dataset.key ?? String(i)) % 600) / 100 - 3).toFixed(2);
        gsap.fromTo(c, { y: 40, rotation: +r, autoAlpha: 0 }, { y: 0, rotation: 0, autoAlpha: 1, duration: 0.48, ease: "paper", delay: 0.15 + i * 0.05 });
      });
    },
    { dependencies: [status], scope: grid },
  );

  useLayoutEffect(() => {
    const Flip = getFlip();
    if (!flip.current || !grid.current || !Flip) return;
    Flip.from(flip.current, { duration: prefersReducedMotion() ? 0 : 0.48, ease: "paper", absolute: true, onEnter: (els) => gsap.fromTo(els, { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4, ease: "paper" }), onLeave: (els) => gsap.to(els, { autoAlpha: 0, duration: 0.2 }) });
    flip.current = null;
  }, [filter]);

  const change = (f: Filter) => {
    const Flip = getFlip();
    if (grid.current && Flip) flip.current = Flip.getState(grid.current.querySelectorAll(".deal"));
    setFilter(f);
  };

  return (
    <>
      <PageHeader
        title={copy.nav.parties}
        eyebrow={IS_SAMPLE ? "Devnet sample" : undefined}
        context={q.data ? `${q.data.filter((p) => p.status === "active").length} active · ${q.data.filter((p) => p.status === "forming").length} forming` : " "}
        actions={
          <>
            <ChipGroup<Filter>
              label="Show"
              filter
              value={filter}
              onChange={change}
              options={[
                { value: "active", label: "Active" },
                { value: "forming", label: "Forming" },
                { value: "finished", label: "Finished" },
              ]}
            />
            <span className="hidden lg:inline-flex">
              <Button href="/parties/new" icon="invite">
                {copy.cta.startParty}
              </Button>
            </span>
          </>
        }
      />

      {status === "loading" && (
        <div className="party-grid" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="fold-lines" style={{ aspectRatio: "3 / 4" }} />
          ))}
        </div>
      )}
      {status === "error" && (
        <div className="card" role="alert">
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
          <EmptyState title="No parties yet." body="Start one, or open an invite card from a friend." action={{ label: copy.cta.startParty, href: "/parties/new" }} />
        </div>
      )}
      {status === "ready" && (
        <div ref={grid} className="party-grid">
          <div className="deal" data-key="start" data-flip-id="start">
            <StartCard />
          </div>
          {list.map((p) => (
            <div key={p.id} className="deal" data-key={p.id} data-flip-id={p.id}>
              <div className="party-card-desk">
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
                    myName: p.me ? p.seats[p.me.idx]?.name : undefined,
                    next: p.status === "active" ? formatWhen(new Date(p.nextAt)) : p.status === "finished" ? "Farewell night held" : undefined,
                  }}
                />
              </div>
              <div className="party-card-row">
                <PartyCard
                  layout="row"
                  href={`/p/${p.id}`}
                  party={{ id: p.id, title: p.title, word: p.word, tradition: p.tradition, guests: p.guests, night: p.night, kitty: p.chipIn * p.guests, status: p.status, rsvps: p.rsvps }}
                />
              </div>
            </div>
          ))}
          {list.length === 0 && (
            <p className="type-body" style={{ color: "var(--ink-soft)", alignSelf: "center" }}>
              No {filter} parties.
            </p>
          )}
        </div>
      )}
    </>
  );
}
