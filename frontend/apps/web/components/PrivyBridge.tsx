"use client";
/**
 * Privy login (architecture 8.2 `identity`). Loaded only when NEXT_PUBLIC_PRIVY_APP_ID is set
 * (see QueryProvider), and mounted beside the page rather than around it, so nothing else
 * waits on Privy. The session talks to it through `privyLink` in data/session.ts.
 *
 * Email login creates an embedded Solana wallet; once it's ready the wallet signs
 * "kitty-identity-v1" with no wallet UI, and that signature unlocks the device (same
 * derivations as demo sign-in: Ed25519 signatures are deterministic, so it's the same
 * identity on every device the guest signs in on).
 */
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useSignMessage, useWallets } from "@privy-io/react-auth/solana";
import { IDENTITY_MESSAGE } from "@kitty/diary";
import { useEffect, useRef } from "react";
import { PRIVY_APP_ID, privyLink, useSession } from "@/data/session";
import { useDevice } from "@/lib/kitty/store";

function Bridge() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const deviceStatus = useDevice((d) => d.status);
  const signing = useRef(false);

  useEffect(() => {
    privyLink.login = (email) => login({ loginMethods: ["email"], prefill: { type: "email", value: email } });
    privyLink.logout = logout;
    if (ready && privyLink.pending && !authenticated) {
      privyLink.login(privyLink.pending);
      privyLink.pending = null;
    }
    return () => {
      privyLink.login = undefined;
      privyLink.logout = undefined;
    };
  }, [ready, authenticated, login, logout]);

  // Signed in with a wallet but the device is locked: sign once and unlock.
  useEffect(() => {
    if (!ready || !authenticated || deviceStatus !== "locked" || signing.current) return;
    const wallet = wallets.find((w) => w.standardWallet.name === "Privy") ?? wallets[0];
    const email = user?.email?.address;
    if (!wallet || !email) return;
    signing.current = true;
    signMessage({ message: IDENTITY_MESSAGE, wallet, options: { uiOptions: { showWalletUIs: false } } })
      .then(({ signature }) => useSession.getState().unlockWith(email, signature))
      .catch((e) => console.error("[kitty] Privy unlock failed:", e))
      .finally(() => {
        signing.current = false;
      });
  }, [ready, authenticated, deviceStatus, wallets, user, signMessage]);

  return null;
}

export default function PrivyBridge() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        appearance: { theme: "dark", walletChainType: "solana-only" },
        embeddedWallets: { ethereum: { createOnLogin: "off" }, solana: { createOnLogin: "users-without-wallets" }, showWalletUIs: false },
      }}
    >
      <Bridge />
    </PrivyProvider>
  );
}
