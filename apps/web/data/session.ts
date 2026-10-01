"use client";
/**
 * Session (architecture 8.2 `identity`, STORYBOARD C13). Privy email login when
 * NEXT_PUBLIC_PRIVY_APP_ID is configured; otherwise a demo sign-in that keeps only an
 * email and flags in this browser. No secret ever enters this store.
 */
import { create } from "zustand";

export interface SessionState {
  email: string | null;
  hasPass: boolean;
  /** Chip-ins recorded on this device during the demo (party id → night). */
  paid: Record<string, number>;
  signIn: (email: string) => void;
  signOut: () => void;
  grantPass: () => void;
  recordChipIn: (partyId: string, night: number) => void;
}

const KEY = "kitty:session";

function load(): Pick<SessionState, "email" | "hasPass" | "paid"> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { paid: {}, ...JSON.parse(raw) };
  } catch {
    /* storage blocked: start fresh */
  }
  return { email: null, hasPass: false, paid: {} };
}

function save(s: Pick<SessionState, "email" | "hasPass" | "paid">) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ email: s.email, hasPass: s.hasPass, paid: s.paid }));
  } catch {
    /* ignore */
  }
}

export const useSession = create<SessionState>((set, get) => ({
  email: null,
  hasPass: false,
  paid: {},
  signIn: (email) => {
    set({ email });
    save(get());
  },
  signOut: () => {
    set({ email: null, hasPass: false, paid: {} });
    save(get());
  },
  grantPass: () => {
    set({ hasPass: true });
    save(get());
  },
  recordChipIn: (partyId, night) => {
    set({ paid: { ...get().paid, [partyId]: night } });
    save(get());
  },
}));

/** Hydrate from storage after mount (keeps server and first client render identical). */
export function hydrateSession() {
  useSession.setState(load());
}

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
