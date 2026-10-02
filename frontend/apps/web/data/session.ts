"use client";
/**
 * Session (architecture 8.2 `identity`, STORYBOARD C13). Signing in unlocks the device: the
 * identity wallet signs "kitty-identity-v1" once, and every secret (s, party wallets, the Diary
 * key) is derived from that signature on this device.
 *
 * - Privy (NEXT_PUBLIC_PRIVY_APP_ID set): the embedded Solana wallet signs (see PrivyBridge).
 * - Demo sign-in: an identity seed kept in this browser for the email. Same derivations.
 *
 * Only the email and a few flags live in this store; secrets live in the device store.
 */
import { create } from "zustand";
import { useDevice } from "@/lib/kitty/store";

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const LIVE = !!process.env.NEXT_PUBLIC_KITTY_API;

/** Filled in by PrivyBridge once Privy has loaded. A login asked for before then waits in `pending`. */
export const privyLink: { login?: (email: string) => void; logout?: () => Promise<void>; pending: string | null } = { pending: null };

export interface SessionState {
  email: string | null;
  hasPass: boolean;
  /** Chip-ins recorded on this device in sample mode (party id → night). */
  paid: Record<string, number>;
  signIn: (email: string) => Promise<void>;
  /** Unlock with a signature from the identity wallet (Privy). */
  unlockWith: (email: string, signature: Uint8Array) => Promise<void>;
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

/** Demo mode: this browser's identity seed for an email (created once). */
async function demoSeed(email: string): Promise<Uint8Array> {
  const { deviceStore } = await import("@kitty/diary");
  const k = `kitty:demo-seed:${email.toLowerCase()}`;
  let seed = (await deviceStore.get(k)) as Uint8Array | undefined;
  if (!seed) {
    seed = crypto.getRandomValues(new Uint8Array(32));
    await deviceStore.set(k, seed);
  }
  return seed;
}

export const useSession = create<SessionState>((set, get) => ({
  email: null,
  hasPass: false,
  paid: {},
  signIn: async (email) => {
    if (PRIVY_APP_ID) {
      // Privy shows its code screen; the bridge calls unlockWith once the wallet has signed.
      if (privyLink.login) privyLink.login(email);
      else privyLink.pending = email;
      return;
    }
    set({ email });
    save(get());
    if (LIVE && !PRIVY_APP_ID) {
      const [{ demoSignature }, { unlock }] = await Promise.all([import("@kitty/diary"), import("@/lib/kitty/device")]);
      await unlock(demoSignature(await demoSeed(email)));
      set({ hasPass: !!useDevice.getState().diary.note });
      save(get());
    }
  },
  unlockWith: async (email, signature) => {
    set({ email });
    const { unlock } = await import("@/lib/kitty/device");
    await unlock(signature);
    set({ hasPass: !!useDevice.getState().diary.note });
    save(get());
  },
  signOut: () => {
    void privyLink.logout?.();
    void import("@/lib/kitty/device").then((d) => d.lock());
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
  const s = load();
  useSession.setState(s);
  // Demo identities unlock again by themselves; Privy ones once Privy reports the wallet.
  if (LIVE && !PRIVY_APP_ID && s.email) void useSession.getState().signIn(s.email);
}

/** Keep `hasPass` in step with the Diary (a pass restored from backup counts). */
useDevice.subscribe((d) => {
  if (d.status === "ready" && !!d.diary.note !== useSession.getState().hasPass) {
    useSession.setState({ hasPass: !!d.diary.note });
    save(useSession.getState());
  }
});
