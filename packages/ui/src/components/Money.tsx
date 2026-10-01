/**
 * Plain money (brief 0.3, 5.4): tabular figures, present at frame 0, never animated.
 * `xl` typesets the currency sign at 0.62em, superscript-aligned — a ledger detail.
 */
import { formatMoney, splitMoney, type MoneyOptions } from "@kitty/sdk";
import type { CSSProperties } from "react";

export function Money({
  micro,
  size = "money",
  cents,
  sign,
  className,
  style,
  tone,
}: {
  micro: number;
  size?: "money" | "money-l" | "money-xl";
  cents?: MoneyOptions["cents"];
  sign?: boolean;
  className?: string;
  style?: CSSProperties;
  /** "money" colours the amount teal: only for amounts a money action confirms (5.5). */
  tone?: "money";
}) {
  const color = tone === "money" ? "var(--money)" : undefined;
  if (size === "money-xl") {
    const p = splitMoney(micro, { cents, sign });
    return (
      <span className={`type-money-xl ${className ?? ""}`} style={{ color, whiteSpace: "nowrap", ...style }} aria-label={formatMoney(micro, { cents, sign })}>
        <span aria-hidden="true">
          {p.sign}
          <span className="money-sign">{p.symbol}</span>
          {p.digits}
        </span>
      </span>
    );
  }
  return (
    <span className={`type-${size} ${className ?? ""}`} style={{ color, whiteSpace: "nowrap", ...style }}>
      {formatMoney(micro, { cents, sign })}
    </span>
  );
}
