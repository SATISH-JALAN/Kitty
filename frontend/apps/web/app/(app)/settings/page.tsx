"use client";
/**
 * Recovery and backup (brief 13.11). Deliberately plain: paper cards, stitched dividers,
 * no decoration except the faucet slip dropping into its envelope.
 */
import { useRef, useState } from "react";
import { gsap } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { Button } from "@kitty/ui/components/Button";
import { toast } from "@kitty/ui/components/Toast";
import { PageHeader } from "@/components/chrome/PageHeader";
import { useSession } from "@/data/session";
import { IS_SAMPLE } from "@/data/api";
import { useDevice } from "@/lib/kitty/store";

export default function SettingsPage() {
  const { signOut, signIn, email } = useSession();
  const backupAt = useDevice((d) => d.backup.at);
  const backupState = useDevice((d) => d.backup.state);
  const [faucetMsg, setFaucetMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const slip = useRef<HTMLSpanElement>(null);

  const run = (key: string, ms: number, done: () => void) => {
    setBusy(key);
    setTimeout(() => {
      setBusy(null);
      done();
    }, ms);
  };

  const dropSlip = () => {
    setSent(true);
    if (slip.current && !prefersReducedMotion()) gsap.fromTo(slip.current, { y: -40, rotation: -6, autoAlpha: 1 }, { y: 6, rotation: 0, autoAlpha: 0, duration: 0.7, ease: "fold" });
  };
  const live = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast({ text: (e as Error).message?.length < 120 ? (e as Error).message : "Something went wrong. Try again." });
    } finally {
      setBusy(null);
    }
  };
  const faucet = () =>
    IS_SAMPLE
      ? run("faucet", 1600, () => {
          setFaucetMsg("Sent 100 test kUSD");
          dropSlip();
        })
      : live("faucet", async () => {
          const { faucet: drip } = await import("@/lib/kitty/actions");
          await drip();
          setFaucetMsg("Sent test kUSD and a little devnet SOL");
          dropSlip();
        });
  const rederive = () =>
    IS_SAMPLE || !email
      ? run("keys", 1400, () => toast({ text: "Keys re-derived on this device." }))
      : live("keys", async () => {
          await signIn(email);
          toast({ text: "Keys re-derived on this device." });
        });
  const restore = () =>
    IS_SAMPLE
      ? run("restore", 1800, () => toast({ text: "Diary restored from backup." }))
      : live("restore", async () => {
          const { restore: fromBackup } = await import("@/lib/kitty/device");
          const ok = await fromBackup();
          toast({ text: ok ? "Diary restored from backup." : "No backup yet for this sign-in." });
        });
  const ago = (iso: string | null) => {
    if (!iso) return null;
    const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
    return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
  };

  return (
    <>
      <PageHeader title="Settings" context="Recovery, backup and devnet test funds." />
      <div className="settings">
        <section id="recovery" className="card" data-enter>
          <h2 className="type-h2">Recovery</h2>
          <p className="type-body">Your keys are made from your sign-in. On a new device, sign in with the same email and Kitty re-derives them. Nothing secret ever leaves your device.</p>
          <Button variant="ghost" busy={busy === "keys"} onClick={rederive}>
            Re-derive my keys
          </Button>
        </section>
        <section className="card" data-enter>
          <h2 className="type-h2">Diary backup</h2>
          <p className="type-body">
            {IS_SAMPLE
              ? "Backed up · 2 min ago."
              : backupState === "error"
                ? "The last backup didn’t go through; it retries on your next change."
                : backupAt
                  ? `Backed up · ${ago(backupAt)}.`
                  : "Not backed up yet: it happens after your first change."}{" "}
            The backup is encrypted with a key only your device can make.
          </p>
          <Button variant="ghost" busy={busy === "restore"} onClick={restore}>
            Restore from backup
          </Button>
        </section>
        <section id="faucet" className="card" data-enter>
          <h2 className="type-h2">Devnet faucet</h2>
          <p className="type-body">Test tokens for trying Kitty. They have no value.</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Button busy={busy === "faucet"} onClick={faucet}>
              Get test funds
            </Button>
            <span style={{ position: "relative", width: 44, height: 30 }} aria-hidden="true">
              <span ref={slip} style={{ position: "absolute", left: 10, top: -6, width: 24, height: 16, background: "var(--paper)", boxShadow: "var(--d1)", opacity: 0 }} />
              <svg viewBox="0 0 44 30" width="44" height="30" style={{ position: "absolute", inset: 0 }}>
                <rect x="1" y="4" width="42" height="25" rx="1.5" fill="var(--kraft)" />
                <path d="M1,5 L22,18 L43,5" fill="none" stroke="#8C6A45" />
              </svg>
            </span>
            <span className="type-body" aria-live="polite">
              {sent ? faucetMsg : ""}
            </span>
          </div>
        </section>
        <section className="card" data-enter>
          <h2 className="type-h2">Privacy notes</h2>
          <p className="type-body">
            Your parties can&rsquo;t be linked to each other on-chain; each party only ever sees your mask. Your ID never leaves your phone. Kitty keeps one mark that says &ldquo;this person has a pass&rdquo;. Nothing else.
          </p>
        </section>
        <section className="card" data-enter>
          <h2 className="type-h2">Sign out</h2>
          <Button
            variant="ghost"
            onClick={() => {
              signOut();
              window.location.href = "/";
            }}
          >
            Sign out
          </Button>
        </section>
      </div>
    </>
  );
}
