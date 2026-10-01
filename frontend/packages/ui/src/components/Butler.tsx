"use client";
/**
 * The Butler (brief 2.1): the keeper bot as a small paper figure carrying a lantern,
 * drawn against docs/ref/R-2-props.png. Masked, never a face. Used in empty states
 * (120 px) and the Tonight strip (32 px).
 */
import type { CSSProperties, ReactNode } from "react";
import { Lantern } from "./Lantern";
import { Button } from "./Button";

export function Butler({ size = 120, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  const small = size < 48;
  return (
    <span className={className} aria-hidden="true" style={{ position: "relative", display: "inline-block", width: size * 0.78, height: size, flex: "none", ...style }}>
      <svg viewBox="0 0 78 100" width={size * 0.78} height={size} style={{ overflow: "visible" }}>
        {/* shadow on the floor */}
        <ellipse cx="40" cy="97" rx="18" ry="2.4" fill="rgba(34,21,31,.18)" />
        {/* back layer */}
        <g transform="translate(1.5 2)" fill="#2E1230" opacity=".55">
          <path d="M28,34 C28,28 33,25 40,25 C47,25 52,28 52,34 L58,86 C52,92 28,92 22,86 Z" />
        </g>
        {/* coat tails */}
        <path d="M24,62 L20,90 L34,90 L37,66 Z M56,62 L60,90 L46,90 L43,66 Z" fill="#3A1840" />
        {/* legs */}
        <path d="M33,84 L32,96 L37,96 L38,84 Z M42,84 L43,96 L48,96 L47,84 Z" fill="#22151F" />
        {/* coat */}
        <path d="M28,34 C28,28 33,25 40,25 C47,25 52,28 52,34 L56,78 C50,84 30,84 24,78 Z" fill="#4E2152" />
        {/* gold trim down the front + cuffs */}
        <path d="M40,27 L40,82" stroke="#C8A04A" strokeWidth="1.2" />
        <path d="M34,30 L40,40 L46,30" fill="none" stroke="#C8A04A" strokeWidth="1.2" />
        {!small && (
          <g fill="#C8A04A">
            <circle cx="40" cy="48" r="1.1" />
            <circle cx="40" cy="56" r="1.1" />
            <circle cx="40" cy="64" r="1.1" />
            <path d="M46,50 C48,54 48,60 46,66 C47,60 47,55 46,50 Z" opacity=".7" />
            <path d="M34,50 C32,54 32,60 34,66 C33,60 33,55 34,50 Z" opacity=".7" />
          </g>
        )}
        {/* cravat */}
        <path d="M37,29 L40,33 L43,29 L40,31 Z" fill="#F3EADB" />
        {/* left arm raised to the lantern */}
        <path d="M29,36 C22,42 16,46 12,48 L13,52 C18,50 25,47 31,42 Z" fill="#4E2152" />
        <circle cx="11.5" cy="49.5" r="2.6" fill="#22151F" />
        {/* right arm, hand behind the back */}
        <path d="M51,36 C55,44 56,52 54,60 L50,59 C51,52 50,45 48,39 Z" fill="#3A1840" />
        {/* head + hair */}
        <circle cx="40" cy="17" r="8.5" fill="#22151F" />
        <path d="M31.5,15 C32,8 36,5 41,5 C47,5 50,9 49,15 C46,11 42,10 38,11 C35,12 33,13 31.5,15 Z" fill="#150C14" />
        {/* the mask */}
        <path d="M31,16 C34,13 38,13 40,15 C42,13 46,13 49,16 C49,20 46,22 43.5,21 C42,20.5 41,19.5 40,19 C39,19.5 38,20.5 36.5,21 C34,22 31,20 31,16 Z" fill="#EFE3C8" />
        <ellipse cx="35.6" cy="17.1" rx="2" ry="1.2" fill="#22151F" />
        <ellipse cx="44.4" cy="17.1" rx="2" ry="1.2" fill="#22151F" />
        <path d="M31,16 C34,13 38,13 40,15 C42,13 46,13 49,16" fill="none" stroke="#C8A04A" strokeWidth=".7" />
        {/* lantern string */}
        <path d="M11.5,50 V56" stroke="#B8542A" strokeWidth=".8" />
      </svg>
      <Lantern width={size * 0.16} lit={1} flicker={!small} style={{ position: "absolute", left: size * 0.03, top: size * 0.55 }} />
    </span>
  );
}

/** Empty state (brief 7.24): the Butler, one h2 line, one body line, one action. */
export function EmptyState({ title, body, action, compact }: { title: string; body?: ReactNode; action?: { label: string; href?: string; onClick?: () => void }; compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: compact ? "row" : "column", alignItems: compact ? "center" : "flex-start", gap: compact ? 20 : 16, padding: compact ? "8px 0" : "8px 0 16px" }}>
      <Butler size={compact ? 72 : 120} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        <h2 className="type-h2">{title}</h2>
        {body && (
          <p className="type-body" style={{ color: "var(--fg-soft)", maxWidth: "46ch" }}>
            {body}
          </p>
        )}
        {action && (
          <div style={{ marginTop: 16 }}>
            <Button href={action.href} onClick={action.onClick}>
              {action.label}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
