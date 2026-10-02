"use client";
/**
 * The device's state only (no crypto imports), so screens and the session can read it without
 * pulling the Diary, Solana and noble code into every route. The heavy parts (unlocking,
 * encrypting, backups) live in ./device and load when someone signs in or acts.
 */
import { create } from "zustand";
import type { Diary, Identity } from "@kitty/diary";

export interface DeviceState {
  status: "locked" | "unlocking" | "ready";
  identity: Identity | null;
  /** The identity secret s (decimal). */
  s: string | null;
  diary: Diary;
  backup: { at: string | null; state: "idle" | "saving" | "error" };
}

export const emptyDiary = (): Diary => ({ v: 1, note: null, parties: {}, pages: [], updatedAt: new Date(0).toISOString() });

export const useDevice = create<DeviceState>(() => ({
  status: "locked",
  identity: null,
  s: null,
  diary: emptyDiary(),
  backup: { at: null, state: "idle" },
}));
