/**
 * Chain → screen: turn a `Party` account (+ public metadata + settled-night history) into the
 * shape the app renders (frontend/apps/web/data/types.ts `Party`, without the device-only `me`).
 * Shared by the API and the app so both name guests the same way.
 */
import { partyName, type Tier, type TraditionKey } from "@kitty/sdk";
import type { Party as PartyAccount } from "./generated";
import { MEMBER_STATUS, NO_WINNER, ORDER, PARTY_STATUS } from "./constants";

export type OrderModeView = "draw" | "seating" | "bid";
export type PeriodView = "weekly" | "biweekly" | "monthly" | "demo";

export interface GuestSeatView {
  idx: number;
  name: string;
  colour: number;
  animal: number;
  tier: Tier;
  tonight: "paid" | "due" | "grace" | "took";
  tookNight?: number;
  /** Chain extras the app uses for the device's own view. */
  tag: string;
  wallet: string;
  status: number;
  paidThrough: number;
  keepsafe: string;
  keepsafeTotal: string;
  debt: string;
  missedNights: number;
  ownPaid: number;
  lateCount: number;
  farewelled: boolean;
  graceDeadline?: string;
}

export interface NightView {
  night: number;
  at: string;
  takerIdx?: number;
  state: "done" | "tonight" | "upcoming";
}

export interface PartyMeta {
  title?: string;
  word?: string;
  tradition?: TraditionKey;
}

export interface PartyView {
  id: string;
  address: string;
  title: string;
  word: string;
  tradition: TraditionKey;
  guests: number;
  chipIn: number;
  hostFeeBps: number;
  period: PeriodView;
  periodSecs: number;
  graceSecs: number;
  mode: OrderModeView;
  status: "forming" | "active" | "finished";
  cancelled: boolean;
  night: number;
  nextAt: string;
  hostName: string;
  seats: GuestSeatView[];
  nights: NightView[];
  rsvps: number;
  startsAt: string;
  startsBy: string;
  formationDeadline: string;
  drawRound: number;
  drawWinner?: number;
}

const DAY = 86_400;
export function periodName(secs: bigint | number): PeriodView {
  const s = Number(secs);
  if (s >= 27 * DAY) return "monthly";
  if (s >= 13 * DAY) return "biweekly";
  if (s >= 6 * DAY) return "weekly";
  return "demo";
}

const hex = (b: ArrayLike<number>) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const iso = (secs: bigint | number) => new Date(Number(secs) * 1000).toISOString();
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Party names for every joined guest, re-rolling clashes in join order (brief 6.2). */
export function seatNames(p: PartyAccount) {
  const taken = new Set<string>();
  return p.members.slice(0, p.joined).map((m) => {
    const id = partyName(Uint8Array.from(m.tag), taken);
    taken.add(id.name);
    return id;
  });
}

export function toPartyView(address: string, p: PartyAccount, meta: PartyMeta = {}, takers: Record<number, number> = {}, nowSecs = Math.floor(Date.now() / 1000)): PartyView {
  const names = seatNames(p);
  const settled = p.currentRound;
  const night = Math.min(settled + 1, p.guests);
  const dueTs = (r: number) => Number(p.startTs) + (r - 1) * Number(p.periodSecs);
  const status: PartyView["status"] = p.status === PARTY_STATUS.FORMING ? "forming" : p.status === PARTY_STATUS.ACTIVE ? "active" : "finished";

  const seats: GuestSeatView[] = p.members.slice(0, p.joined).map((m, idx) => {
    const tonight: GuestSeatView["tonight"] =
      m.tookNight > 0 && m.tookNight === settled ? "took" : m.status === MEMBER_STATUS.GRACE ? "grace" : m.paidThrough >= night ? "paid" : "due";
    return {
      idx,
      name: names[idx].name,
      colour: names[idx].colour,
      animal: names[idx].animal,
      tier: Math.min(m.tier, 2) as Tier,
      tonight,
      tookNight: m.tookNight || undefined,
      tag: hex(m.tag),
      wallet: m.wallet,
      status: m.status,
      paidThrough: m.paidThrough,
      keepsafe: m.keepsafe.toString(),
      keepsafeTotal: m.keepsafeTotal.toString(),
      debt: m.debt.toString(),
      missedNights: m.missedNights,
      ownPaid: m.ownPaid,
      lateCount: m.lateCount,
      farewelled: m.farewelled === 1,
      graceDeadline: m.graceDeadline > 0n ? iso(m.graceDeadline) : undefined,
    };
  });
  for (const s of seats) if (s.tookNight) takers[s.tookNight] ??= s.idx;

  const nights: NightView[] = Array.from({ length: p.guests }, (_, i) => {
    const n = i + 1;
    return {
      night: n,
      at: iso(dueTs(n)),
      takerIdx: takers[n],
      state: n <= settled ? "done" : n === settled + 1 && status === "active" ? "tonight" : "upcoming",
    };
  });

  const host = p.members.slice(0, p.joined).findIndex((m) => m.isHost === 1);
  const start = Number(p.startTs);
  void nowSecs;
  return {
    id: p.id.toString(),
    address,
    title: meta.title ?? `Party ${p.id}`,
    word: meta.word ?? "kitty party",
    tradition: meta.tradition ?? "kitty",
    guests: p.guests,
    chipIn: Number(p.chipIn),
    hostFeeBps: p.hostFeeBps,
    period: periodName(p.periodSecs),
    periodSecs: Number(p.periodSecs),
    graceSecs: Number(p.graceSecs),
    mode: p.mode === ORDER.SEATING ? "seating" : "draw",
    status,
    cancelled: p.status === PARTY_STATUS.CANCELLED,
    night,
    nextAt: iso(status === "forming" ? start : dueTs(night)),
    hostName: host >= 0 ? names[host].name : "The host",
    seats,
    nights,
    rsvps: p.joined,
    startsAt: iso(start),
    startsBy: DAYS[new Date(start * 1000).getUTCDay()],
    formationDeadline: iso(p.formationDeadline),
    drawRound: p.drawRound,
    drawWinner: p.drawWinner === NO_WINNER ? undefined : p.drawWinner,
  };
}
