"use client";
/**
 * Ledger slip (brief 7.22): paper-deep, d2, padding 24, rotated 1°, a brass pin at the top
 * centre. Lines are mono 14, amounts are money right-aligned in tabular figures, dividers
 * are stitched, the total is money-l. Lines that change flash an ink underline for 600 ms.
 *
 * Ledger roll (primitive 8): digit strips roll to a value, right to left. Non-money only.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";

export interface LedgerLine {
  key: string;
  label: ReactNode;
  amount?: ReactNode;
  /** Bold total line. */
  total?: boolean;
  /** Stitched divider above this line. */
  rule?: boolean;
  /** Muted helper line. */
  note?: boolean;
}

function Line({ line }: { line: LedgerLine }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const sig = `${String(line.amount ?? "")}|${String(line.label)}`;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const u = ref.current?.querySelector<HTMLElement>(".ledger-flash");
    if (!u || prefersReducedMotion()) return;
    // Restart the CSS flash: an ink underline for 600 ms, no colour flashes (brief 7.22).
    u.classList.remove("is-on");
    void u.offsetWidth;
    u.classList.add("is-on");
  }, [sig]);
  return (
    <div
      ref={ref}
      className={line.rule ? "stitch-t" : undefined}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 16,
        paddingTop: line.rule ? 12 : 0,
        marginTop: line.rule ? 4 : 0,
      }}
    >
      <span className="type-mono" style={{ fontSize: 14, color: line.note ? "var(--fg-soft)" : "var(--fg)" }}>
        {line.label}
      </span>
      {line.amount != null && (
        <span className={line.total ? "type-money-l" : "type-money"} style={{ textAlign: "right" }}>
          {line.amount}
        </span>
      )}
      <span className="ledger-flash" aria-hidden="true" />
    </div>
  );
}

export function LedgerSlip({
  title,
  lines,
  className,
  style,
  pin = true,
  rotate = 1,
  footer,
}: {
  title?: ReactNode;
  lines: LedgerLine[];
  className?: string;
  style?: CSSProperties;
  pin?: boolean;
  rotate?: number;
  footer?: ReactNode;
}) {
  return (
    <div
      data-world="paper"
      className={`paper-fibre ${className ?? ""}`}
      style={{
        position: "relative",
        width: 380,
        maxWidth: "100%",
        padding: 24,
        paddingTop: pin ? 30 : 24,
        background: "var(--paper-deep)",
        color: "var(--ink)",
        borderRadius: "var(--radius-cut)",
        boxShadow: "var(--d2)",
        transform: `rotate(${rotate}deg)`,
        ...style,
      }}
    >
      {pin && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            width: 9,
            height: 9,
            marginLeft: -4.5,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #F1D58A, #C8A04A 55%, #8C6A2A)",
            boxShadow: "0 1px 1.5px rgba(7,3,12,.4)",
          }}
        />
      )}
      {title && (
        <div className="type-label" style={{ marginBottom: 14, color: "var(--ink-soft)" }}>
          {title}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lines.map((l) => (
          <Line key={l.key} line={l} />
        ))}
      </div>
      {footer}
    </div>
  );
}

/** Ledger roll (primitive 8): digit columns roll to the value in 900 ms paper, right to left, 40 ms apart. */
export function LedgerRoll({ value, className, style, play = true }: { value: string; className?: string; style?: CSSProperties; play?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const digits = value.split("");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const strips = Array.from(el.querySelectorAll<HTMLElement>("[data-strip]"));
    if (!play) {
      strips.forEach((s) => gsap.set(s, { yPercent: -10 * +(s.dataset.strip ?? 0) }));
      return;
    }
    if (prefersReducedMotion()) {
      strips.forEach((s) => gsap.set(s, { yPercent: -10 * +(s.dataset.strip ?? 0) }));
      return;
    }
    strips.reverse().forEach((s, i) => {
      gsap.fromTo(s, { yPercent: 0 }, { yPercent: -10 * +(s.dataset.strip ?? 0), duration: 0.9, ease: "paper", delay: i * 0.04 });
    });
  }, [value, play]);
  return (
    <span ref={ref} className={className} aria-label={value} role="text" style={{ display: "inline-flex", fontVariantNumeric: "tabular-nums", ...style }}>
      {digits.map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} aria-hidden="true" style={{ display: "inline-block", height: "1em", lineHeight: 1, overflow: "hidden", verticalAlign: "top" }}>
            <span data-strip={ch} style={{ display: "flex", flexDirection: "column" }}>
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d} style={{ height: "1em", lineHeight: 1 }}>
                  {d}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true" style={{ lineHeight: 1 }}>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
