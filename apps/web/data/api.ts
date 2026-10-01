"use client";
/**
 * The one data layer (brief 15.5, architecture 7.2). TanStack Query hooks over either the
 * indexer API (NEXT_PUBLIC_KITTY_API) or the labelled devnet sample. Screens only ever
 * see { status, data } and render the designed state for each.
 *
 * `?demo=loading|empty|error` forces a state for review (brief 17.3).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sampleDraw, sampleHouse, sampleMe, sampleParties } from "./sample";
import { useSession } from "./session";
import type { DrawState, HouseFund, Me, Party, Status } from "./types";

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

export function useMe() {
  const hasPass = useSession((s) => s.hasPass);
  return useQuery<Me>({ queryKey: ["me", hasPass], queryFn: () => get("/v1/me", () => ({ ...sampleMe(), hasPass })) });
}

export function useParties() {
  const paid = useSession((s) => s.paid);
  return useQuery<Party[]>({
    queryKey: ["parties"],
    queryFn: () => get("/v1/parties", () => sampleParties()),
    select: (list) =>
      (demoOverride() === "empty" ? [] : list).map((p) => (p.me && paid[p.id] === p.night ? { ...p, me: { ...p.me, paidTonight: true, graceHoursLeft: undefined } } : p)),
  });
}

export function useParty(id: string) {
  const q = useParties();
  return { ...q, data: q.data?.find((p) => p.id === id) };
}

export function useHouse() {
  return useQuery<HouseFund>({ queryKey: ["house"], queryFn: () => get("/v1/house", () => sampleHouse()) });
}

/**
 * The Draw's state. Waits until the chain reports `DrawResolved` (sample: a few seconds,
 * like ORAO on devnet); the animation never runs ahead of it (brief 13.7).
 */
export function useDraw(party: Party | undefined) {
  const [state, setState] = useState<DrawState | null>(null);
  useEffect(() => {
    if (!party) return;
    const base = sampleDraw(party);
    setState({ ...base, status: "waiting" });
    const t = setTimeout(() => setState({ ...base, status: "resolved" }), 3800 + Math.random() * 1600);
    return () => clearTimeout(t);
  }, [party?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

/** Chip in now (`pay_manual`, architecture 4.2). */
export function useChipIn() {
  const qc = useQueryClient();
  const record = useSession((s) => s.recordChipIn);
  return useMutation({
    mutationFn: async (p: { partyId: string; night: number }) => {
      await wait(1400 + Math.random() * 600);
      return p;
    },
    onSuccess: (p) => {
      record(p.partyId, p.night);
      qc.invalidateQueries({ queryKey: ["parties"] });
    },
  });
}
