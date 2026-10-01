"use client";
/**
 * Party card — the invite card (brief 7.15). 3:4, 300 wide, padding 24, d1, paper-deep,
 * foil frame. Hover raises it and tilts ±4° toward the cursor. On mobile lists it becomes
 * a horizontal row (1 : 0.42).
 */
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { identityFromName, type TraditionKey } from "@kitty/sdk";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { Emblem } from "../generators/emblem";
import { Mask } from "../generators/mask";
import { Money } from "./Money";

export interface PartyCardData {
  id: string;
  title: string;
  word: string;
  tradition: TraditionKey;
  guests: number;
  night: number;
  kitty: number;
  myTag?: Uint8Array;
  myName?: string;
  next?: string;
  status?: "active" | "forming" | "finished";
  rsvps?: number;
  startsBy?: string;
}

function MyMask({ name, tag, tradition }: { name: string; tag?: Uint8Array; tradition: TraditionKey }) {
  let id: { colour: number; animal: number } | null = null;
  try {
    id = identityFromName(name);
  } catch {
    id = null;
  }
  return id ? <Mask colour={id.colour} animal={id.animal} width={32} tradition={tradition} /> : tag ? <Mask tag={tag} width={32} tradition={tradition} /> : null;
}

function Beads({ n, done, size = 6 }: { n: number; done: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          style={{
            width: i === done - 1 ? size + 2 : size,
            height: i === done - 1 ? size + 2 : size,
            borderRadius: "50%",
            background: i < done ? (i === done - 1 ? "var(--marigold)" : "var(--twine)") : "transparent",
            boxShadow: i < done ? "none" : "inset 0 0 0 1px color-mix(in srgb, var(--twine) 60%, transparent)",
          }}
        />
      ))}
    </span>
  );
}

function PlaceCards({ n, filled }: { n: number; filled: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 3, flexWrap: "wrap" }} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ width: 10, height: 7, borderRadius: 1, background: i < filled ? "var(--kraft)" : "transparent", boxShadow: i < filled ? "0 1px 0 rgba(34,21,31,.15)" : "inset 0 0 0 1px var(--hairline)" }} />
      ))}
    </span>
  );
}

export function PartyCard({ party, href, layout = "card", footer }: { party: PartyCardData; href: string; layout?: "card" | "row"; footer?: ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    gsap.to(el, {
      rotationY: ((e.clientX - r.left) / r.width - 0.5) * 8,
      rotationX: -((e.clientY - r.top) / r.height - 0.5) * 8,
      y: -2,
      boxShadow: "var(--d2)",
      transformPerspective: 900,
      duration: 0.4,
      ease: "paper",
      overwrite: "auto",
    });
  };
  const leave = () => {
    if (ref.current) gsap.to(ref.current, { rotationX: 0, rotationY: 0, y: 0, boxShadow: "var(--d1)", duration: 0.4, ease: "paper", overwrite: "auto" });
  };
  const forming = party.status === "forming";
  const label = `${party.title}, ${party.word}. ${forming ? `RSVPs ${party.rsvps ?? 0} of ${party.guests}` : `Night ${party.night} of ${party.guests}`}.`;

  if (layout === "row") {
    return (
      <Link ref={ref} href={href} aria-label={label} className="paper-fibre" data-focus-ring="" data-flip-id={`party-${party.id}`} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", alignItems: "center", gap: 16, padding: 16, background: "var(--paper-deep)", borderRadius: "var(--radius-cut)", boxShadow: "var(--d1)", color: "var(--ink)" }}>
        <Emblem partyId={party.id} guests={party.guests} tradition={party.tradition} size={64} />
        <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span className="type-h3" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {party.title}
          </span>
          <span className="type-word" style={{ fontSize: 17 }}>
            {party.word}
          </span>
          <span className="type-mono" style={{ color: "var(--ink-soft)" }}>
            {forming ? `RSVPs ${party.rsvps ?? 0} of ${party.guests}` : `Night ${party.night} of ${party.guests}`}
          </span>
        </span>
        <Money micro={party.kitty} size="money-l" />
      </Link>
    );
  }

  return (
    <Link
      ref={ref}
      href={href}
      aria-label={label}
      onPointerMove={move}
      onPointerLeave={leave}
      data-focus-ring=""
      data-flip-id={`party-${party.id}`}
      className="paper-fibre foil-frame"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        width: "100%",
        maxWidth: 300,
        aspectRatio: "3 / 4",
        padding: 24,
        paddingTop: 30,
        background: "var(--paper-deep)",
        color: "var(--ink)",
        borderRadius: "var(--radius-cut)",
        boxShadow: "var(--d1)",
        textAlign: "center",
        transformStyle: "preserve-3d",
      }}
    >
      <span data-flip-id={`emblem-${party.id}`}>
        <Emblem partyId={party.id} guests={party.guests} tradition={party.tradition} size={64} />
      </span>
      <span className="type-h3" style={{ marginTop: 4 }}>
        {party.title}
      </span>
      <span className="type-word" style={{ fontSize: 17, marginTop: -6 }}>
        {party.word}
      </span>
      <span className="stitch-b" style={{ width: "70%", height: 1 }} aria-hidden="true" />
      {forming ? (
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span className="type-mono">
            RSVPs {party.rsvps ?? 0} of {party.guests}
          </span>
          <PlaceCards n={party.guests} filled={party.rsvps ?? 0} />
          {party.startsBy && (
            <span className="type-small" style={{ color: "var(--ink-soft)" }}>
              Starts when full · by {party.startsBy}
            </span>
          )}
        </span>
      ) : (
        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span className="type-mono">
            Night {party.night} of {party.guests}
          </span>
          <Beads n={party.guests} done={party.night} />
        </span>
      )}
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto" }}>
        <span className="type-label" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
          Tonight&rsquo;s kitty
        </span>
        <Money micro={party.kitty} size="money-l" />
      </span>
      {party.myName && (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MyMask name={party.myName} tag={party.myTag} tradition={party.tradition} />
          <span className="type-word" style={{ fontSize: 14 }}>
            {party.myName}
          </span>
        </span>
      )}
      {party.next && (
        <span className="type-small" style={{ color: "var(--ink-soft)" }}>
          {party.next}
        </span>
      )}
      {footer}
    </Link>
  );
}
