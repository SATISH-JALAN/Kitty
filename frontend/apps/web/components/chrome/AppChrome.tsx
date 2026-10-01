"use client";
/**
 * App shell chrome (brief 12.2, 12.3).
 * Desktop: 64 px header — wordmark · Tonight / Parties / Diary / House Fund (icon + label,
 * the active item marked by a bead on twine) · Devnet tag · Guest Pass medallion.
 * Mobile: 56 px top bar (wordmark + medallion) and a 64 px bottom tab bar with a torn top
 * edge and a twine string whose bead slides over the active tab.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark, Lockup } from "@kitty/ui/brand/Wordmark";
import { WaxSeal } from "@kitty/ui/brand/WaxSeal";
import { Button } from "@kitty/ui/components/Button";
import { Icon, type IconName } from "@kitty/ui/components/Icon";
import { Sheet } from "@kitty/ui/components/Sheet";
import { TwineRail } from "@kitty/ui/components/TwineRail";
import { TornEdgeSvg } from "@kitty/ui/paper/TornEdgeSvg";
import { copy } from "@/copy/en";
import { DevnetTag } from "./DevnetTag";
import { useSession } from "@/data/session";

const TABS: { href: string; label: string; short: string; icon: IconName; match: RegExp }[] = [
  { href: "/tonight", label: copy.nav.tonight, short: copy.nav.tonight, icon: "lantern", match: /^\/tonight/ },
  { href: "/parties", label: copy.nav.parties, short: copy.nav.parties, icon: "invite", match: /^\/(parties|p\/)/ },
  { href: "/diary", label: copy.nav.diaryShort, short: copy.nav.diaryShort, icon: "booklet", match: /^\/diary/ },
  { href: "/house", label: copy.nav.house, short: copy.nav.houseShort, icon: "net", match: /^\/house/ },
];

function useActive() {
  const path = usePathname() ?? "";
  const i = TABS.findIndex((t) => t.match.test(path));
  return i < 0 ? null : i;
}

function Medallion() {
  const [open, setOpen] = useState(false);
  const email = useSession((s) => s.email);
  const signOut = useSession((s) => s.signOut);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Your Guest Pass and account" data-focus-ring="" style={{ width: 44, height: 44, display: "grid", placeItems: "center", borderRadius: "50%" }}>
        <WaxSeal size={32} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Your Guest Pass">
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <WaxSeal size={56} />
          <div>
            <p className="type-body" style={{ fontWeight: 500 }}>
              {email ?? "Signed in"}
            </p>
            <p className="type-small" style={{ color: "var(--fg-soft)" }}>
              One Guest Pass per person. {copy.pass.never}
            </p>
          </div>
        </div>
        <nav aria-label="Account" style={{ display: "flex", flexDirection: "column" }}>
          {[
            { href: "/settings", label: "Settings", icon: "spool" as IconName },
            { href: "/settings#recovery", label: "Recovery", icon: "seal" as IconName },
            { href: "/settings#faucet", label: "Devnet faucet", icon: "envelope" as IconName },
          ].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="stitch-b" data-focus-ring="" style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52 }}>
              <Icon name={l.icon} size={20} />
              <span className="type-body">{l.label}</span>
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 24 }}>
          <Button
            variant="ghost"
            onClick={() => {
              signOut();
              setOpen(false);
              window.location.href = "/";
            }}
          >
            Sign out
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export function AppHeader() {
  const active = useActive();
  return (
    <header className="app-header" data-world="paper">
      <div className="app-header-inner">
        <Link href="/tonight" aria-label="Kitty — Tonight" data-focus-ring="" className="app-logo">
          <span className="hidden lg:inline-flex">
            <Lockup height={26} interactive />
          </span>
          <span className="lg:hidden inline-flex">
            <Wordmark height={24} interactive />
          </span>
        </Link>
        <nav aria-label="Main" className="app-nav hidden lg:flex">
          <ul>
            {TABS.map((t, i) => (
              <li key={t.href}>
                <Link href={t.href} aria-current={active === i ? "page" : undefined} className="type-label app-nav-link" data-focus-ring="">
                  <Icon name={t.icon} size={20} />
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
          <TwineRail count={4} active={active} sag={6} height={14} onlyActive style={{ marginTop: -4 }} />
        </nav>
        <div className="app-header-end">
          <DevnetTag placement="inline" />
          <Medallion />
        </div>
      </div>
    </header>
  );
}

export function TabBar() {
  const active = useActive();
  return (
    <nav className="tabbar lg:hidden" aria-label="Main" data-world="paper">
      <div style={{ position: "absolute", left: 0, right: 0, top: -9 }} aria-hidden="true">
        <TornEdgeSvg depth={18} seed={44} fill="var(--paper-deep)" />
      </div>
      <TwineRail count={4} active={active} sag={4} height={10} onlyActive style={{ position: "absolute", left: 0, right: 0, top: 2 }} />
      <ul>
        {TABS.map((t, i) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={active === i ? "page" : undefined} className="tab-link" data-focus-ring="">
              <Icon name={t.icon} size={24} />
              <span>{t.short}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
