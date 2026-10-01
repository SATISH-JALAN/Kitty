"use client";
/**
 * Chips (brief 7.3): ticket-shaped, 32 px. Selected chips fill from the left (primitive
 * 26: inset(0 100% 0 0) → inset(0), 320 ms ink) in the accent colour with the tradition
 * pattern at 18%; the label turns paper through the same clip. Groups wrap with 8 px gaps
 * and use a roving tabindex (arrow keys move, Space/Enter select).
 */
import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { TraditionKey } from "@kitty/sdk";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { patternCss } from "../generators/patterns";

export interface ChipOption<V extends string> {
  value: V;
  label: ReactNode;
  /** Tradition chips set the pattern and use Boska italic, sentence case. */
  tradition?: TraditionKey;
  disabled?: boolean;
  /** Explains why a chip is disabled (read out and shown as a title). */
  reason?: string;
}

function ChipFace({ label, tradition, filter }: { label: ReactNode; tradition?: TraditionKey; filter: boolean }) {
  return (
    <span
      className={tradition ? "type-word" : "type-label"}
      style={{
        fontSize: tradition ? 17 : 13,
        textTransform: filter ? "uppercase" : "none",
        letterSpacing: tradition ? 0 : "0.08em",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Chip<V extends string>({
  opt,
  selected,
  focusable,
  onSelect,
  filter,
  accent,
  onKey,
}: {
  opt: ChipOption<V>;
  selected: boolean;
  focusable: boolean;
  onSelect: () => void;
  filter: boolean;
  accent: string;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const fill = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useEffect(() => {
    const el = fill.current;
    if (!el) return;
    const to = selected ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)";
    if (first.current || prefersReducedMotion()) {
      gsap.set(el, { clipPath: to });
      first.current = false;
      return;
    }
    gsap.to(el, { clipPath: to, duration: 0.32, ease: "ink", overwrite: true });
  }, [selected]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={opt.disabled || undefined}
      title={opt.disabled ? opt.reason : undefined}
      tabIndex={focusable ? 0 : -1}
      onClick={() => !opt.disabled && onSelect()}
      onKeyDown={onKey}
      data-focus-ring=""
      className="ticket"
      style={{
        position: "relative",
        height: 32,
        paddingInline: 14,
        display: "inline-flex",
        alignItems: "center",
        boxShadow: "inset 0 0 0 1px var(--hairline)",
        color: "var(--fg)",
        opacity: opt.disabled ? 0.45 : 1,
        cursor: opt.disabled ? "not-allowed" : "pointer",
      }}
    >
      {/* Invisible hit extension to 44 px. */}
      <span aria-hidden="true" style={{ position: "absolute", inset: "-6px 0" }} />
      <ChipFace label={opt.label} tradition={opt.tradition} filter={filter} />
      <span
        ref={fill}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "inline-flex",
          alignItems: "center",
          paddingInline: 14,
          background: accent,
          color: "var(--paper)",
          clipPath: "inset(0 100% 0 0)",
        }}
      >
        {opt.tradition && (
          <span style={{ position: "absolute", inset: 0, backgroundImage: patternCss(opt.tradition, "#ffffff", "#ffffff"), opacity: 0.18 }} />
        )}
        <span style={{ position: "relative" }}>
          <ChipFace label={opt.label} tradition={opt.tradition} filter={filter} />
        </span>
      </span>
    </button>
  );
}

export function ChipGroup<V extends string>({
  options,
  value,
  onChange,
  label,
  filter = false,
  accent = "var(--plum)",
  className,
  style,
}: {
  options: ChipOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  label: string;
  /** Filter chips are uppercase labels. */
  filter?: boolean;
  accent?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const move = (from: number, dir: number) => {
    for (let k = 1; k <= options.length; k++) {
      const i = (from + dir * k + options.length) % options.length;
      if (!options[i].disabled) {
        const btn = document.querySelectorAll<HTMLButtonElement>(`[data-chipgroup="${label}"] [role="radio"]`)[i];
        btn?.focus();
        return;
      }
    }
  };
  void refs;
  return (
    <div role="radiogroup" aria-label={label} data-chipgroup={label} className={className} style={{ display: "flex", flexWrap: "wrap", gap: 8, ...style }}>
      {options.map((o, i) => (
        <Chip
          key={o.value}
          opt={o}
          selected={o.value === value}
          focusable={i === activeIndex}
          filter={filter}
          accent={accent}
          onSelect={() => onChange(o.value)}
          onKey={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              move(i, 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              move(i, -1);
            }
          }}
        />
      ))}
    </div>
  );
}
