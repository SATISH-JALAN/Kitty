/**
 * Act 4's script: chapters, their scroll windows (brief Act 4 table), and the plain ledger
 * lines for each — every number from packages/sdk (asserted in fees.test.ts).
 */
import { exampleParty, formatMoney, identityFromName, type TraditionKey } from "@kitty/sdk";
import { copy, t } from "@/copy/en";
import type { SeatGuest } from "@/components/stage/Table";

export const X = exampleParty();
export const TRADITION: TraditionKey = "kitty";
export const TAKER_SEAT = X.night - 1; // seat 4

const NAMES = ["Indigo Heron", "Saffron Lynx", "Moss Koi", X.taker, "Rose Hare", "Teal Peacock", "Ochre Owl", "Cobalt Fox", "Ivory Crane", "Plum Stag"];

export const GUESTS: SeatGuest[] = NAMES.map((name) => {
  const id = identityFromName(name);
  return { name, colour: id.colour, animal: id.animal };
});

export type ChapterId = "enter" | "chipIn" | "draw" | "takes" | "keepsafe" | "missed" | "waterfall" | "farewell";

export interface Chapter {
  id: ChapterId;
  at: number;
  end: number;
  title: string;
  body: string;
  /** Bead index (0-based night) shown as current. */
  night: number;
  lines: { key: string; label: string; amount?: string; total?: boolean; rule?: boolean; note?: boolean }[];
  /** Mobile: the ledger sheet expands for these chapters. */
  expand?: boolean;
}

const m = (n: number, opts?: { sign?: boolean }) => formatMoney(n, opts);
const c = copy.act4.chapters;
const name = X.taker;

export const CHAPTERS: Chapter[] = [
  {
    id: "enter",
    at: 0,
    end: 0.04,
    title: copy.act4.title,
    body: "A savings party, night by night.",
    night: 3,
    lines: [
      { key: "g", label: "Guests", amount: String(X.guests) },
      { key: "c", label: "Chip-in each", amount: m(X.chipIn) },
    ],
  },
  {
    id: "chipIn",
    at: 0.04,
    end: 0.17,
    title: c.chipIn.title,
    body: c.chipIn.body,
    night: 3,
    lines: [
      { key: "g", label: `${X.guests} guests × ${m(X.chipIn)}`, amount: m(X.take.kitty) },
      { key: "k", label: "Tonight's kitty", amount: m(X.take.kitty), total: true, rule: true },
      { key: "f", label: `Kitty fee ${m(X.due.kittyFee)} + House fee ${m(X.due.houseFee)} each, paid on top`, note: true },
    ],
  },
  {
    id: "draw",
    at: 0.17,
    end: 0.28,
    title: c.draw.title,
    body: c.draw.body,
    night: 3,
    lines: [
      { key: "k", label: "Tonight's kitty", amount: m(X.take.kitty) },
      { key: "d", label: `Night ${X.night} draw: ${name}`, rule: true },
    ],
  },
  {
    id: "takes",
    at: 0.28,
    end: 0.41,
    title: t(c.takes.title, { name }),
    body: c.takes.body,
    night: 3,
    expand: true,
    lines: [
      { key: "k", label: "Kitty", amount: m(X.take.kitty) },
      { key: "h", label: "Host fee (1%)", amount: m(-X.take.hostFee) },
      { key: "s", label: "Keepsafe", amount: m(-X.take.keepsafe) },
      { key: "p", label: "Paid now", amount: m(X.take.paidNow), total: true, rule: true },
    ],
  },
  {
    id: "keepsafe",
    at: 0.41,
    end: 0.52,
    title: c.keepsafe.title,
    body: c.keepsafe.body,
    night: 4,
    lines: [
      { key: "s", label: "Keepsafe", amount: m(X.take.keepsafe) },
      { key: "r", label: "Back as they chip in", amount: `${m(X.take.releasePerChipIn)} a night` },
      { key: "a", label: `After Night ${X.night + 1}`, amount: m(X.keepsafeBeforeMiss), total: true, rule: true },
    ],
  },
  {
    id: "missed",
    at: 0.52,
    end: 0.62,
    title: t(c.missed.title, { name }),
    body: c.missed.body,
    night: 5,
    lines: [
      { key: "d", label: `Night ${X.firstMissedNight} chip-in due`, amount: m(X.due.total, {}) },
      { key: "g", label: "Grace hours", amount: "72" },
      { key: "k", label: "A kind nudge is sent.", note: true, rule: true },
    ],
  },
  {
    id: "waterfall",
    at: 0.62,
    end: 0.8,
    title: c.waterfall.title,
    body: c.waterfall.body,
    night: 9,
    expand: true,
    lines: [
      { key: "m", label: `Missed Nights ${X.firstMissedNight}–${X.guests}`, amount: m(X.cover.missed) },
      { key: "k", label: "From keepsafe", amount: m(X.cover.fromKeepsafe), rule: true },
      { key: "p", label: "From plus-ones", amount: m(X.cover.fromPlusOnes) },
      { key: "h", label: "From the House Fund", amount: m(X.cover.fromHouse) },
      { key: "e", label: "Every other guest is paid in full.", note: true, rule: true },
    ],
  },
  {
    id: "farewell",
    at: 0.8,
    end: 1,
    title: c.farewell.title,
    body: c.farewell.body,
    night: 9,
    lines: [
      { key: "n", label: `Night ${X.guests}` },
      { key: "c", label: "Party complete", total: true, rule: true },
    ],
  },
];

export function chapterAt(p: number): number {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (p >= CHAPTERS[i].at) return i;
  return 0;
}
