"use client";
import { useState } from "react";
import { demoTag, dollars, exampleParty, formatMoney } from "@kitty/sdk";
import { Button, TextLink } from "@kitty/ui/components/Button";
import { Butler, EmptyState } from "@kitty/ui/components/Butler";
import { Chit } from "@kitty/ui/components/Chit";
import { ChipGroup } from "@kitty/ui/components/Chip";
import { EnvelopeDropzone, type DropState } from "@kitty/ui/components/EnvelopeDropzone";
import { Field, Toggle } from "@kitty/ui/components/Field";
import { Icon, type IconName } from "@kitty/ui/components/Icon";
import { IconButton } from "@kitty/ui/components/IconButton";
import { Lantern } from "@kitty/ui/components/Lantern";
import { LanternStepper, type Step } from "@kitty/ui/components/LanternStepper";
import { LedgerRoll, LedgerSlip } from "@kitty/ui/components/Ledger";
import { GraceRing, KeepsafeMeter } from "@kitty/ui/components/Meters";
import { Money } from "@kitty/ui/components/Money";
import { PartyCard } from "@kitty/ui/components/PartyCard";
import { Sheet } from "@kitty/ui/components/Sheet";
import { Stamp } from "@kitty/ui/components/Stamp";
import { Tag } from "@kitty/ui/components/Tag";
import { toast } from "@kitty/ui/components/Toast";
import { Tooltip } from "@kitty/ui/components/Tooltip";
import { TwineRail } from "@kitty/ui/components/TwineRail";

const ICONS: IconName[] = ["lantern", "invite", "booklet", "net", "chit", "stamp", "seal", "bowl", "mask", "door", "masks", "envelope", "grace", "copy", "done", "arrow", "close", "spool", "tag", "external", "menu", "butler"];

function Section({ title, children, night }: { title: string; children: React.ReactNode; night?: boolean }) {
  return (
    <section data-world={night ? "night" : undefined} className="flex flex-col gap-6 p-8 cut" style={{ background: "var(--bg)", color: "var(--fg)" }}>
      <h2 className="type-h2">{title}</h2>
      {children}
    </section>
  );
}

export default function ComponentsLab() {
  const x = exampleParty();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [trad, setTrad] = useState<string | null>("paluwagan");
  const [filter, setFilter] = useState<string | null>("active");
  const [on, setOn] = useState(true);
  const [amount, setAmount] = useState("100");
  const [sheet, setSheet] = useState(false);
  const [bead, setBead] = useState(3);
  const [drop, setDrop] = useState<DropState>("empty");
  const [steps, setSteps] = useState<Step[]>([
    { label: "Fetch keys", status: "done" },
    { label: "Build proof", status: "working", progress: 0.42, detail: "Building your proof · 0:12" },
    { label: "Send", status: "idle" },
  ]);

  const amountError = /^\d+(\.\d{1,2})?$/.test(amount) ? null : "That doesn't look like an amount. Try 100.";

  return (
    <main className="px-page py-16 flex flex-col gap-10">
      <header>
        <p className="type-label" style={{ color: "var(--fg-soft)" }}>
          Lab
        </p>
        <h1 className="type-h1">Components</h1>
      </header>

      {(["paper", "night"] as const).map((w) => (
        <Section key={w} title={`Buttons · ${w}`} night={w === "night"}>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="L">Get your Guest Pass</Button>
            <Button variant="money" size="L">
              RSVP &amp; chip in $101.00
            </Button>
            <Button variant="ghost">Go to Tonight</Button>
            <Button variant="money" size="S">
              Chip in now
            </Button>
            <Button disabled disabledReason="Finish a party to move up.">
              Make this page
            </Button>
            <Button
              busy={busy}
              done={done}
              onClick={() => {
                setBusy(true);
                setTimeout(() => {
                  setBusy(false);
                  setDone(true);
                  setTimeout(() => setDone(false), 1200);
                }, 2400);
              }}
            >
              Create party
            </Button>
            <TextLink href="#">See how a party works</TextLink>
          </div>
        </Section>
      ))}

      <Section title="Icons">
        <div className="flex flex-wrap gap-6">
          {ICONS.map((n) => (
            <span key={n} className="flex flex-col items-center gap-2 w-16">
              <Icon name={n} size={24} />
              <span className="type-mono" style={{ fontSize: 11 }}>
                {n}
              </span>
            </span>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <IconButton icon="close" label="Close" />
          <IconButton icon="menu" label="Menu" />
          <IconButton icon="copy" label="Copy invite" />
          {[16, 20, 24, 32].map((s) => (
            <Icon key={s} name="lantern" size={s} />
          ))}
        </div>
      </Section>

      <Section title="Chips, fields, toggle, tags">
        <ChipGroup
          label="Tradition"
          value={trad}
          onChange={setTrad}
          accent="var(--saffron)"
          options={[
            { value: "kitty", label: "kitty party", tradition: "kitty" },
            { value: "tanda", label: "tanda", tradition: "tanda" },
            { value: "susu", label: "susu", tradition: "susu" },
            { value: "paluwagan", label: "paluwagan", tradition: "paluwagan" },
            { value: "ajo", label: "ajo", tradition: "ajo" },
          ]}
        />
        <ChipGroup
          label="Filter"
          filter
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: "Active" },
            { value: "forming", label: "Forming" },
            { value: "finished", label: "Finished" },
          ]}
        />
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <Field label="Email" type="email" placeholder="you@example.com" />
          <Field label="Chip-in" amount value={amount} onChange={(e) => setAmount(e.target.value)} error={amountError} helper="Per guest, per night." />
          <label className="flex items-center gap-3 type-body">
            <Toggle checked={on} onChange={setOn} label="Auto-pay" /> Auto-pay
          </label>
        </div>
        <div className="flex flex-wrap gap-3">
          <Tag variant="devnet">Devnet · test funds only</Tag>
          <Tag variant="family">Family</Tag>
          <Tag variant="regular">Regular</Tag>
          <Tag variant="guest">Guest</Tag>
          <Tag variant="paid">Paid</Tag>
          <Tag variant="grace">In grace hours</Tag>
          <Tag>Neutral</Tag>
        </div>
      </Section>

      <Section title="Objects" night>
        <div className="flex flex-wrap items-end gap-8">
          {[20, 28, 40, 72, 120].map((s) => (
            <Lantern key={s} width={s} flicker />
          ))}
          <Lantern width={40} lit={0} outline />
          <Chit>$100</Chit>
          <Chit state="stamped">$100</Chit>
          <Chit face="name">Marigold Parrot</Chit>
          <Chit state="folded" />
          <Butler size={120} />
          <Butler size={32} />
        </div>
        <div className="flex flex-wrap items-center gap-10" data-world="paper" style={{ background: "var(--bg)", padding: 24 }}>
          <Stamp label="Never stored" ink="plum" />
          <Stamp label="Early takers default ~3.5× as often" sub="2.04% vs 0.59% in one Chennai study" ink="saffron" width={220} height={80} />
          <Stamp shape="round" label="Paid" ink="teal" />
          <Stamp shape="round" label="Farewell" ink="plum" />
          <Stamp label="Ready to send" ink="ink" />
        </div>
      </Section>

      <Section title="Money layer">
        <div className="flex flex-wrap gap-10 items-start">
          <LedgerSlip
            title="Night 4 of 10"
            lines={[
              { key: "k", label: "Kitty", amount: formatMoney(x.take.kitty) },
              { key: "h", label: "Host fee", amount: formatMoney(-x.take.hostFee) },
              { key: "s", label: "Keepsafe", amount: formatMoney(-x.take.keepsafe) },
              { key: "p", label: "Paid now", amount: formatMoney(x.take.paidNow), total: true, rule: true },
            ]}
          />
          <div className="flex flex-col gap-6" style={{ width: 360 }}>
            <KeepsafeMeter total={dollars(300)} back={dollars(120)} line={<>Keepsafe <b>$300</b> · <b>$120</b> back so far</>} />
            <div className="flex items-center gap-4">
              <GraceRing hoursLeft={61} />
              <div className="flex flex-col gap-2">
                <span className="type-body">
                  <b className="type-money">61</b> grace hours left
                </span>
                <Button variant="money" size="S">
                  Chip in now
                </Button>
              </div>
            </div>
            <Money micro={dollars(1000)} size="money-xl" />
            <span className="type-display-l">
              <LedgerRoll value="1,000,000,000" />
            </span>
          </div>
        </div>
      </Section>

      <Section title="Progress, rails, cards">
        <LanternStepper
          steps={steps}
          startedAt={Date.now() - 12_000}
          onRetry={() => setSteps((s) => s.map((st) => (st.status === "error" ? { ...st, status: "working", progress: null } : st)))}
          errorText="Something interrupted the proof. Your data stayed on your device."
        />
        <div className="flex gap-3">
          <Button size="S" variant="ghost" onClick={() => setSteps((s) => s.map((st, i) => (i === 1 ? { ...st, progress: Math.min(1, (st.progress ?? 0) + 0.2) } : st)))}>
            Advance
          </Button>
          <Button size="S" variant="ghost" onClick={() => setSteps((s) => s.map((st, i) => (i === 1 ? { ...st, status: "error" } : st)))}>
            Fail step
          </Button>
          <Button size="S" variant="ghost" onClick={() => setSteps((s) => s.map((st, i) => (i === 1 ? { ...st, progress: null } : st)))}>
            Indeterminate
          </Button>
        </div>
        <div style={{ maxWidth: 520 }}>
          <TwineRail count={10} active={bead} done={Array.from({ length: bead }, (_, i) => i)} labels={Array.from({ length: 10 }, (_, i) => `N${i + 1}`)} height={44} />
          <div className="flex gap-3 mt-6">
            <Button size="S" variant="ghost" onClick={() => setBead((b) => Math.max(0, b - 1))}>
              Back a night
            </Button>
            <Button size="S" variant="ghost" onClick={() => setBead((b) => Math.min(9, b + 1))}>
              Next night
            </Button>
          </div>
        </div>
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 300px))" }}>
          <PartyCard
            href="#"
            party={{ id: "asha", title: "Asha's paluwagan", word: "paluwagan", tradition: "paluwagan", guests: 10, night: 4, kitty: dollars(1000), myTag: demoTag("me-asha"), myName: "Indigo Heron", next: "Fri, 8 pm" }}
          />
          <PartyCard
            href="#"
            party={{ id: "diwali", title: "Diwali committee", word: "committee", tradition: "kitty", guests: 8, night: 1, kitty: dollars(400), status: "forming", rsvps: 6, startsBy: "Tue" }}
          />
          <div style={{ maxWidth: 360 }}>
            <PartyCard
              href="#"
              layout="row"
              party={{ id: "asha", title: "Asha's paluwagan", word: "paluwagan", tradition: "paluwagan", guests: 10, night: 3, kitty: dollars(1000) }}
            />
          </div>
        </div>
      </Section>

      <Section title="Envelope, sheet, toast, tooltip, empty" night>
        <div className="flex flex-wrap gap-8 items-start">
          <EnvelopeDropzone
            state={drop}
            onFile={() => setDrop("sealed")}
            helper="Test QR only · devnet · nothing real"
            error={drop === "invalid" ? "We couldn't read that QR. Try a sharper image of the test QR." : null}
          />
          <div className="flex flex-col gap-3 items-start">
            <Button size="S" variant="ghost" onClick={() => setDrop("over")}>
              Dragover
            </Button>
            <Button size="S" variant="ghost" onClick={() => setDrop("sealed")}>
              Drop
            </Button>
            <Button size="S" variant="ghost" onClick={() => setDrop("invalid")}>
              Invalid
            </Button>
            <Button size="S" variant="ghost" onClick={() => setDrop("empty")}>
              Reset
            </Button>
            <Button size="S" onClick={() => setSheet(true)}>
              Open sheet
            </Button>
            <Button size="S" onClick={() => toast({ text: "Stamped. Night 4 chip-in recorded." })}>
              Toast
            </Button>
            <Tooltip content="No real money is used. Everything here is a test token on Solana devnet.">
              <Tag variant="devnet">Devnet · test funds only</Tag>
            </Tooltip>
          </div>
        </div>
        <div data-world="paper" style={{ background: "var(--bg)", padding: 24 }}>
          <EmptyState title="No parties yet." body="Start one, or open an invite card from a friend." action={{ label: "Start a party" }} />
        </div>
      </Section>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="RSVP to Asha's paluwagan">
        <p className="type-body" style={{ color: "var(--fg-soft)" }}>
          You&rsquo;ll approve exactly $101.00 per night. You can turn it off, but that counts as a missed chip-in.
        </p>
        <div style={{ marginTop: 24 }}>
          <Button variant="money" size="L" block>
            RSVP &amp; chip in $101.00
          </Button>
        </div>
      </Sheet>
    </main>
  );
}
