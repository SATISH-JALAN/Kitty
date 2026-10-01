/** App data model: public party state (indexer, architecture 10.2) + the device's private view. */
import type { Tier, TraditionKey } from "@kitty/sdk";

export type Status = "loading" | "empty" | "error" | "ready";
export type OrderMode = "draw" | "seating" | "bid";
export type Period = "weekly" | "biweekly" | "monthly" | "demo";

export interface GuestSeat {
  idx: number;
  /** Party name (the tag rendered for humans). */
  name: string;
  colour: number;
  animal: number;
  tier: Tier;
  /** Status for the current night. */
  tonight: "paid" | "due" | "grace" | "took";
  tookNight?: number;
}

export interface NightRecord {
  night: number;
  at: string; // ISO
  takerIdx?: number;
  state: "done" | "tonight" | "upcoming";
}

export interface Party {
  id: string;
  title: string;
  word: string;
  tradition: TraditionKey;
  guests: number;
  chipIn: number; // micro-units
  hostFeeBps: number;
  period: Period;
  mode: OrderMode;
  status: "forming" | "active" | "finished";
  night: number; // current night (1-based)
  nextAt: string; // ISO of next chip-in / draw
  hostName: string;
  seats: GuestSeat[];
  nights: NightRecord[];
  rsvps?: number;
  startsBy?: string;
  /** The device's view (private, from the Diary). */
  me?: {
    idx: number;
    tag: string;
    paidTonight: boolean;
    graceHoursLeft?: number;
    keepsafe?: { total: number; back: number };
    autopay: boolean;
  };
}

export interface Me {
  email: string | null;
  hasPass: boolean;
  tier: Tier;
  partiesFinished: number;
  neverLate: number;
  lifetimeChippedIn: number;
  onHold?: { amount: number; party: string };
}

export interface DrawState {
  partyId: string;
  night: number;
  status: "waiting" | "resolved";
  takerIdx?: number;
  eligible: number[];
}

export interface HouseFlow {
  id: string;
  at: string;
  kind: "fee-in" | "cover-out" | "settle-in";
  amount: number;
  balanceAfter: number;
  sig: string;
}

export interface HouseFund {
  balance: number;
  feesIn: number;
  paidOut: number;
  defaultRateBps: number;
  reserveOk: boolean;
  series: { at: string; balance: number }[];
  flows: HouseFlow[];
}
