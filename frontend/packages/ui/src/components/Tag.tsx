/**
 * Tag (brief 7.11): ticket shape, 24 px, label 12 px.
 * Variants: neutral · devnet · family / regular / guest (tiers) · paid (ink stamp) · grace.
 */
import type { CSSProperties, ReactNode } from "react";

export type TagVariant = "neutral" | "devnet" | "family" | "regular" | "guest" | "paid" | "grace" | "active" | "forming" | "finished";

const STYLES: Record<TagVariant, CSSProperties> = {
  neutral: { boxShadow: "inset 0 0 0 1px var(--hairline)", color: "var(--fg)" },
  devnet: { background: "var(--marigold)", color: "var(--night)" },
  family: { background: "var(--plum)", color: "var(--paper)" },
  regular: { background: "var(--ochre, #C28A2C)", color: "var(--ink)" },
  guest: { boxShadow: "inset 0 0 0 1px var(--hairline)", color: "var(--fg)" },
  paid: { boxShadow: "inset 0 0 0 1.5px var(--fg)", color: "var(--fg)", filter: "url(#ink)" },
  grace: { background: "var(--paper-deep)", color: "var(--grace)" },
  active: { boxShadow: "inset 0 0 0 1px var(--teal)", color: "var(--teal)" },
  forming: { boxShadow: "inset 0 0 0 1px var(--hairline)", color: "var(--fg-soft)" },
  finished: { background: "var(--plum)", color: "var(--paper)" },
};

export function Tag({ children, variant = "neutral", className, style, title }: { children: ReactNode; variant?: TagVariant; className?: string; style?: CSSProperties; title?: string }) {
  return (
    <span
      className={`ticket type-label ${className ?? ""}`}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 24,
        paddingInline: 12,
        fontSize: 12,
        letterSpacing: "0.07em",
        whiteSpace: "nowrap",
        ...STYLES[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
