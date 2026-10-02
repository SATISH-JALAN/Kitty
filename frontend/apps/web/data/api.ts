"use client";
/**
 * The one data layer (brief 15.5, architecture 7.2). TanStack Query hooks over either the
 * Kitty API (NEXT_PUBLIC_KITTY_API) or the labelled devnet sample. Screens only ever see
 * { status, data } and render the designed state for each.
 *
 * Live: public party state comes from the API; the device's own view (which seat is mine,
 * my keepsafe, my grace hours, my tier) is added here from the Party Diary and never leaves
 * this browser.
 *
 * `?demo=loading|empty|error` forces a state for review (brief 17.3).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { FEES, type Tier } from "@kitty/sdk";
import type { Diary } from "@kitty/diary";
import { sampleDraw, sampleHouse, sampleMe, sampleParties } from "./sample";
import { useSession } from "./session";
import type { DrawState, HouseFund, Me, Party, Status } from "./types";
import { useDevice } from "@/lib/kitty/store";

export const API = process.env.NEXT_PUBLIC_KITTY_API ?? "";
export const IS_SAMPLE = !API;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function demoOverride(): "loading" | "empty" | "error" | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("demo");
  return v === "loading" || v === "empty" || v === "error" ? v : null;
}

async function get<T>(path: string, sample: () => T): Promise<T> {
  const demo = demoOverride();
  if (demo === "error") {
    await wait(400);
    throw new Error("network");
  }
  if (demo === "loading") await new Promise(() => {});
  if (!API) {
    await wait(260 + Math.random() * 220);
    return sample();
  }
  const res = await fetch(`${API}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`api ${res.status}`);
  return (await res.json()) as T;
}

/** Map a query to the four designed states. */
export function statusOf(q: { isPending: boolean; isError: boolean; data: unknown }, isEmpty: (d: never) => boolean = () => false): Status {
  if (q.isError) return "error";
  if (q.isPending) return "loading";
  if (demoOverride() === "empty") return "empty";
  return isEmpty(q.data as never) ? "empty" : "ready";
}

// ---------------------------------------------------------------- the device's view

const MEMBER = { ACTIVE: 0, GRACE: 1, DEFAULTED: 2, REMOVED: 3, SETTLED: 4 };

/** Add `me` to a party from the Diary (my tag → my seat). */
function withMe(p: Party, diary: Diary): Party {
  const mine = diary.parties[p.id];
  if (!mine) return p;
  const seat = mine.tag ? p.seats.find((s) => s.tag === mine.tag) : undefined;
  if (!seat) return { ...p, me: mine.host ? { idx: -1, tag: "", paidTonight: false, autopay: false, host: true } : undefined };
  const total = Number(seat.keepsafeTotal ?? 0);
  const left = Number(seat.keepsafe ?? 0);
  const graceMs = seat.graceDeadline ? Date.parse(seat.graceDeadline) - Date.now() : 0;
  return {
    ...p,
    me: {
      idx: seat.idx,
      tag: seat.tag ?? "",
      paidTonight: (seat.paidThrough ?? 0) >= p.night,
      graceHoursLeft: seat.status === MEMBER.GRACE ? Math.max(0, Math.ceil(graceMs / 3_600_000)) : undefined,
      keepsafe: total > 0 ? { total, back: total - left } : undefined,
      autopay: true,
      status: seat.status,
      host: !!mine.host,
      farewellPending: !!seat.farewelled && !mine.completedAt,
      completed: !!mine.completedAt,
    },
  };
}

function useDiary(): Diary | null {
  const status = useDevice((d) => d.status);
  const diary = useDevice((d) => d.diary);
  return status === "ready" ? diary : null;
}

// ---------------------------------------------------------------- hooks

export function useMe() {
  const hasPass = useSession((s) => s.hasPass);
  const email = useSession((s) => s.email);
  const diary = useDiary();
  const parties = useAllParties();
  const live = useMemo((): Me | undefined => {
    if (IS_SAMPLE) return undefined;
    const note = diary?.note;
    const completed = Number(note?.completed ?? 0);
    const late = Number(note?.late ?? 0);
    let onHold: Me["onHold"];
    for (const p of parties.data ?? []) {
      const tag = diary?.parties[p.id]?.tag;
      const seat = tag ? p.seats.find((s) => s.tag === tag) : undefined;
      if (seat?.status === MEMBER.DEFAULTED) {
        const lateFee = Math.round((p.chipIn * FEES.lateBps) / 10_000);
        onHold = { amount: Number(seat.debt ?? 0) + (seat.missedNights ?? 0) * lateFee, party: p.title, partyId: p.id };
      }
    }
    return {
      email,
      hasPass: !!note,
      tier: (completed >= 3 ? 2 : completed >= 1 ? 1 : 0) as Tier,
      partiesFinished: completed,
      neverLate: late === 0 ? completed : Math.max(0, completed - late),
      lifetimeChippedIn: Number(note?.paid ?? 0),
      onHold,
    };
  }, [diary, parties.data, email]);
  const q = useQuery<Me>({ queryKey: ["me", hasPass], queryFn: () => get("/v1/me", () => ({ ...sampleMe(), hasPass })), enabled: IS_SAMPLE });
  if (!IS_SAMPLE) {
    const pending = diary === null && !!email;
    return { ...q, data: pending ? undefined : live, isPending: pending, isError: false } as typeof q;
  }
  return q;
}

/** Every public party (while the list is small the app fetches all of them: architecture 11.3). */
function useAllParties() {
  return useQuery<Party[]>({ queryKey: ["parties", "all"], queryFn: () => get("/v1/parties", () => sampleParties()), refetchInterval: IS_SAMPLE ? false : 5000 });
}

/** The parties this device is in (sample: every sample party). */
export function useParties() {
  const paid = useSession((s) => s.paid);
  const diary = useDiary();
  const q = useAllParties();
  const data = useMemo(() => {
    if (!q.data) return undefined;
    if (IS_SAMPLE) {
      return (demoOverride() === "empty" ? [] : q.data).map((p) => (p.me && paid[p.id] === p.night ? { ...p, me: { ...p.me, paidTonight: true, graceHoursLeft: undefined } } : p));
    }
    if (!diary) return [];
    return q.data.filter((p) => diary.parties[p.id]).map((p) => withMe(p, diary));
  }, [q.data, diary, paid]);
  return { ...q, data };
}

/** One party by id: any party (invite pages show parties you aren't in yet). */
export function useParty(id: string) {
  const q = useAllParties();
  const diary = useDiary();
  const mine = useParties();
  const data = useMemo(() => {
    const p = q.data?.find((x) => x.id === id);
    if (!p) return undefined;
    if (IS_SAMPLE) return mine.data?.find((x) => x.id === id) ?? p;
    return diary ? withMe(p, diary) : p;
  }, [q.data, diary, id, mine.data]);
  return { ...q, data };
}

export function useHouse() {
  return useQuery<HouseFund>({ queryKey: ["house"], queryFn: () => get("/v1/house", () => sampleHouse()), refetchInterval: IS_SAMPLE ? false : 15_000 });
}

/**
 * The Draw's state. Waits until the chain reports the night's guest (sample: a few seconds,
 * like ORAO on devnet); the animation never runs ahead of it (brief 13.7).
 */
export function useDraw(party: Party | undefined) {
  const [state, setState] = useState<DrawState | null>(null);
  useEffect(() => {
    if (!party) return;
    if (IS_SAMPLE) {
      const base = sampleDraw(party);
      setState({ ...base, status: "waiting" });
      const t = setTimeout(() => setState({ ...base, status: "resolved" }), 3800 + Math.random() * 1600);
      return () => clearTimeout(t);
    }
    let alive = true;
    const night = party.nights.find((n) => n.state === "tonight")?.night ?? party.night;
    const poll = async () => {
      while (alive) {
        try {
          const s = await get<DrawState>(`/v1/parties/${party.id}/draws/${night}`, () => sampleDraw(party));
          if (!alive) return;
          setState(s);
          if (s.status === "resolved") return;
        } catch {
          /* keep waiting */
        }
        await wait(2500);
      }
    };
    void poll();
    return () => {
      alive = false;
    };
  }, [party?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** Chip in now (`pay_manual`, architecture 4.2): through the fee relay when live. */
export function useChipIn() {
  const qc = useQueryClient();
  const record = useSession((s) => s.recordChipIn);
  return useMutation({
    mutationFn: async (p: { partyId: string; night: number }) => {
      if (IS_SAMPLE) {
        await wait(1400 + Math.random() * 600);
        return p;
      }
      const { chipIn } = await import("@/lib/kitty/actions");
      await chipIn(BigInt(p.partyId));
      return p;
    },
    onSuccess: (p) => {
      if (IS_SAMPLE) record(p.partyId, p.night);
      qc.invalidateQueries({ queryKey: ["parties"] });
    },
  });
}
