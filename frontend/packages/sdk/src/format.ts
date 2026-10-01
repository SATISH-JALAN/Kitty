import { MICRO } from "./fees";

const whole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const cents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export interface MoneyOptions {
  /** "auto" shows cents only when there are cents; "always" forces them. */
  cents?: "auto" | "always";
  /** Prefix a minus sign for outgoing lines in a ledger. */
  sign?: boolean;
}

/**
 * The one money formatter (brief 15.5). Takes micro-units of the test token.
 * `$1,000`, `$101.00` (with cents: "always"), `$0.50`.
 */
export function formatMoney(micro: number, opts: MoneyOptions = {}): string {
  const value = Math.abs(micro) / MICRO;
  const hasCents = Math.round(value * 100) % 100 !== 0;
  const f = opts.cents === "always" || hasCents ? cents : whole;
  const body = f.format(value);
  if (micro < 0 || (opts.sign && micro !== 0)) return `${micro < 0 ? "−" : "+"}${body}`;
  return body;
}

/** Split for money-xl rendering: the currency sign is typeset separately (brief 5.4). */
export function splitMoney(micro: number, opts: MoneyOptions = {}): { sign: string; symbol: string; digits: string } {
  const s = formatMoney(micro, opts);
  const m = /^([−+]?)(\$)(.*)$/.exec(s);
  if (!m) return { sign: "", symbol: "", digits: s };
  return { sign: m[1], symbol: m[2], digits: m[3] };
}

export function formatPercentBps(bpsValue: number): string {
  const pct = bpsValue / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(pct * 10 === Math.round(pct * 10) ? 1 : 2)}%`;
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const DATE = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** "Fri, 8 pm" / "Fri, 8:30 pm" (brief 1.2). */
export function formatWhen(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? "am" : "pm";
  return `${DAY.format(d)}, ${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${ampm}`;
}

/** "Fri 3 Oct" for context lines. */
export function formatDay(d: Date): string {
  return DATE.format(d).replace(",", "");
}

/** Truncate a base58 id for mono display: "EQ9ZE3…SWXPCH". */
export function truncateId(id: string, head = 6, tail = 6): string {
  return id.length <= head + tail + 1 ? id : `${id.slice(0, head)}…${id.slice(-tail)}`;
}
