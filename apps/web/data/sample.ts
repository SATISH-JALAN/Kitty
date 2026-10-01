/**
 * Devnet sample data (STORYBOARD C12). Deterministic, SDK-consistent fixtures used until
 * the indexer API is live. Every screen labels it "Devnet sample" where numbers appear.
 * Parties are the ones the landing page's story uses: Asha's paluwagan draws on Night 4
 * and Marigold Parrot takes the kitty.
 */
import { dollars, identityFromName, keepsafeAfter, takeTheKitty, type Tier, type TraditionKey } from "@kitty/sdk";
import type { DrawState, GuestSeat, HouseFund, Me, NightRecord, Party, Period } from "./types";

/** Next occurrence of a weekday at an hour, from `from`. */
function nextAt(weekday: number, hour: number, from = new Date()) {
  const d = new Date(from);
  d.setHours(hour, 0, 0, 0);
  const add = (weekday - d.getDay() + 7) % 7 || (d <= from ? 7 : 0);
  d.setDate(d.getDate() + add);
  return d;
}

function seats(names: string[], tiers: Tier[], tonight: (i: number) => GuestSeat["tonight"], took: Record<number, number>): GuestSeat[] {
  return names.map((name, idx) => {
    const id = identityFromName(name);
    return { idx, name, colour: id.colour, animal: id.animal, tier: tiers[idx] ?? 0, tonight: tonight(idx), tookNight: took[idx] };
  });
}

function nights(n: number, current: number, start: Date, stepDays: number, takers: Record<number, number>): NightRecord[] {
  return Array.from({ length: n }, (_, i) => {
    const at = new Date(start);
    at.setDate(at.getDate() + (i - (current - 1)) * stepDays);
    const night = i + 1;
    const takerIdx = Object.entries(takers).find(([, nt]) => nt === night)?.[0];
    return { night, at: at.toISOString(), takerIdx: takerIdx != null ? +takerIdx : undefined, state: night < current ? "done" : night === current ? "tonight" : "upcoming" };
  });
}

const ASHA_NAMES = ["Saffron Lynx", "Indigo Heron", "Moss Koi", "Marigold Parrot", "Rose Hare", "Teal Peacock", "Ochre Owl", "Cobalt Fox", "Ivory Crane", "Plum Stag"];

export function sampleParties(now = new Date()): Party[] {
  const fri = nextAt(5, 20, now);
  const sun = nextAt(0, 19, now);
  const wed = nextAt(3, 20, now);
  const tue = nextAt(2, 20, now);
  const period: Period = "monthly";

  // The tanda where I took Night 4: keepsafe per the SDK, paid Night 5, Night 6 in grace.
  const myTake = takeTheKitty({ chipIn: dollars(100), guests: 10, night: 4, tier: 1, hostFeeBps: 100 });
  const kept = keepsafeAfter(myTake, dollars(100), 1);

  return [
    {
      id: "asha",
      title: "Asha's paluwagan",
      word: "paluwagan",
      tradition: "paluwagan",
      guests: 10,
      chipIn: dollars(100),
      hostFeeBps: 100,
      period,
      mode: "draw",
      status: "active",
      night: 4,
      nextAt: fri.toISOString(),
      hostName: "Saffron Lynx",
      seats: seats(ASHA_NAMES, [2, 1, 2, 1, 0, 0, 1, 0, 0, 0], (i) => (i === 1 ? "due" : i === 5 ? "grace" : "paid"), { 0: 1, 6: 2, 2: 3 }),
      nights: nights(10, 4, fri, 30, { 0: 1, 6: 2, 2: 3 }),
      me: { idx: 1, tag: "asha-me", paidTonight: false, autopay: true },
    },
    {
      id: "diwali",
      title: "Diwali committee",
      word: "committee",
      tradition: "kitty",
      guests: 8,
      chipIn: dollars(50),
      hostFeeBps: 50,
      period: "monthly",
      mode: "seating",
      status: "active",
      night: 2,
      nextAt: wed.toISOString(),
      hostName: "Rose Hare",
      seats: seats(["Rose Hare", "Jade Crane", "Ember Fox", "Sand Owl", "Dusk Moth", "Clay Tiger", "Ivory Heron", "Teal Koi"], [2, 0, 1, 0, 0, 1, 0, 0], () => "paid", { 0: 1 }),
      nights: nights(8, 2, wed, 30, { 0: 1 }),
      me: { idx: 1, tag: "diwali-me", paidTonight: true, autopay: true },
    },
    {
      id: "sunday",
      title: "Sunday tanda",
      word: "tanda",
      tradition: "tanda",
      guests: 10,
      chipIn: dollars(100),
      hostFeeBps: 100,
      period: "weekly",
      mode: "draw",
      status: "active",
      night: 6,
      nextAt: sun.toISOString(),
      hostName: "Cobalt Crane",
      seats: seats(["Cobalt Crane", "Midnight Owl", "Saffron Moth", "Ochre Stag", "Rose Koi", "Jade Lynx", "Sand Parrot", "Ember Hare", "Dusk Heron", "Moss Tiger"], [2, 1, 1, 1, 0, 0, 0, 0, 1, 0], (i) => (i === 3 ? "grace" : "paid"), { 1: 1, 8: 2, 0: 3, 3: 4, 2: 5 }),
      nights: nights(10, 6, sun, 7, { 1: 1, 8: 2, 0: 3, 3: 4, 2: 5 }),
      me: { idx: 3, tag: "sunday-me", paidTonight: false, graceHoursLeft: 61, keepsafe: { total: myTake.keepsafe, back: myTake.keepsafe - kept }, autopay: true },
    },
    {
      id: "susu",
      title: "Saturday susu",
      word: "susu",
      tradition: "susu",
      guests: 10,
      chipIn: dollars(40),
      hostFeeBps: 100,
      period: "biweekly",
      mode: "draw",
      status: "forming",
      night: 0,
      nextAt: tue.toISOString(),
      hostName: "Jade Heron",
      rsvps: 6,
      startsBy: "Tue",
      seats: seats(["Jade Heron", "Plum Owl", "Teal Fox", "Ivory Lynx", "Ember Crane", "Sand Koi"], [2, 1, 0, 0, 1, 0], () => "paid", {}),
      nights: nights(10, 1, tue, 14, {}),
      me: { idx: 3, tag: "susu-me", paidTonight: true, autopay: true },
    },
    {
      id: "office",
      title: "Office ajo",
      word: "ajo",
      tradition: "ajo",
      guests: 6,
      chipIn: dollars(100),
      hostFeeBps: 100,
      period: "monthly",
      mode: "seating",
      status: "finished",
      night: 6,
      nextAt: now.toISOString(),
      hostName: "Midnight Crane",
      seats: seats(["Midnight Crane", "Ochre Parrot", "Rose Stag", "Cobalt Moth", "Jade Owl", "Clay Heron"], [2, 1, 1, 0, 0, 0], () => "took", { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }),
      nights: nights(6, 7, now, 30, { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 }),
      me: { idx: 5, tag: "office-me", paidTonight: true, autopay: false },
    },
  ];
}

export function sampleMe(): Me {
  return { email: "guest@kitty.test", hasPass: true, tier: 1, partiesFinished: 1, neverLate: 1, lifetimeChippedIn: dollars(600) };
}

export function sampleDraw(party: Party): DrawState {
  const eligible = party.seats.filter((s) => !s.tookNight).map((s) => s.idx);
  return { partyId: party.id, night: party.night, status: "waiting", eligible, takerIdx: party.id === "asha" ? 3 : eligible[eligible.length - 1] };
}

export function sampleHouse(now = new Date()): HouseFund {
  const series = Array.from({ length: 16 }, (_, i) => {
    const at = new Date(now);
    at.setDate(at.getDate() - (15 - i) * 7);
    const base = 1800 + i * 190 + (i > 9 ? -240 : 0) + Math.round(Math.sin(i * 1.3) * 60);
    return { at: at.toISOString(), balance: dollars(base) };
  });
  const flows = Array.from({ length: 26 }, (_, i) => {
    const at = new Date(now);
    at.setHours(at.getHours() - i * 19);
    const kind = i % 9 === 4 ? "cover-out" : i % 11 === 7 ? "settle-in" : "fee-in";
    const amount = kind === "fee-in" ? dollars([0.5, 0.25, 0.2, 0.5][i % 4] * 10) : kind === "cover-out" ? dollars(100) : dollars(102);
    return {
      id: `f${i}`,
      at: at.toISOString(),
      kind,
      amount,
      balanceAfter: series[series.length - 1].balance - dollars(i * 3),
      sig: `${(0x5dd + i * 7919).toString(36)}Kx${(i * 104729).toString(36)}Qm${(i * 131).toString(36)}H229`,
    } as HouseFund["flows"][number];
  });
  return { balance: series[series.length - 1].balance, feesIn: dollars(5040), paidOut: dollars(790), defaultRateBps: 120, reserveOk: true, series, flows };
}

export const SAMPLE_TRADITIONS: TraditionKey[] = ["kitty", "tanda", "susu", "paluwagan", "arisan", "chama", "ajo"];
