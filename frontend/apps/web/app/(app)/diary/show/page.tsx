"use client";
/**
 * Show a page (brief 13.9): choose what to prove (only claims you can prove are enabled),
 * who it's for (each page is made for one reader), then make it (a HISTORY proof). The
 * preview page tears out along its perforation and floats forward, stamped.
 */
import { useEffect, useRef, useState } from "react";
import { dollars, formatMoney, TIER_NAMES } from "@kitty/sdk";
import { gsap } from "@kitty/ui/motion/gsap";
import { stamp } from "@kitty/ui/motion/primitives/physical";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { Button } from "@kitty/ui/components/Button";
import { CopyButton } from "@kitty/ui/components/CopyButton";
import { Field } from "@kitty/ui/components/Field";
import { LanternStepper, type Step } from "@kitty/ui/components/LanternStepper";
import { Stamp } from "@kitty/ui/components/Stamp";
import { toast } from "@kitty/ui/components/Toast";
import { PageHeader } from "@/components/chrome/PageHeader";
import { DiaryPage } from "@/components/stage/Booklet";
import { copy } from "@/copy/en";
import { useMe } from "@/data/api";

type ClaimId = "finished" | "never" | "chipped";

function Stepper({ value, min, max, step, onChange, format, label }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string; label: string }) {
  return (
    <span className="inline-stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Less, ${label}`} data-focus-ring="">
        −
      </button>
      <span className="type-money tnum" aria-live="polite">
        {format(value)}
      </span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`More, ${label}`} data-focus-ring="">
        +
      </button>
    </span>
  );
}

export default function ShowPage() {
  const me = useMe();
  const finished = me.data?.partiesFinished ?? 0;
  const neverLate = me.data?.neverLate ?? 0;
  const lifetime = me.data?.lifetimeChippedIn ?? 0;
  const [picked, setPicked] = useState<Record<ClaimId, boolean>>({ finished: true, never: true, chipped: false });
  const [nFinished, setNFinished] = useState(1);
  const [nChipped, setNChipped] = useState(dollars(500));
  const [scope, setScope] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ label: "Build proof", status: "idle" }, { label: "Publish page", status: "idle" }]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const page = useRef<HTMLDivElement>(null);

  const claims: { id: ClaimId; enabled: boolean; why?: string; node: React.ReactNode; text: string }[] = [
    {
      id: "finished",
      enabled: finished > 0,
      why: "Finish a party first.",
      node: (
        <>
          Finished at least <Stepper value={nFinished} min={1} max={Math.max(1, finished)} step={1} onChange={setNFinished} format={(v) => String(v)} label="parties" /> {nFinished === 1 ? "party" : "parties"}
        </>
      ),
      text: `${nFinished} ${nFinished === 1 ? "party" : "parties"}`,
    },
    { id: "never", enabled: neverLate > 0 && neverLate === finished, why: "Only if every party you finished was paid on time.", node: <>Never late</>, text: "never late" },
    {
      id: "chipped",
      enabled: lifetime >= dollars(100),
      why: "Chip in to a finished party first.",
      node: (
        <>
          Chipped in at least <Stepper value={nChipped} min={dollars(100)} max={Math.max(dollars(100), lifetime)} step={dollars(100)} onChange={setNChipped} format={(v) => formatMoney(v)} label="total chipped in" /> in total
        </>
      ),
      text: `${formatMoney(nChipped)} chipped in`,
    },
  ];
  const statement = claims.filter((c) => picked[c.id] && c.enabled).map((c) => c.text).join(" · ");
  const ready = statement.length > 0 && scope.trim().length > 1;

  const make = async () => {
    setStartedAt(Date.now());
    setSteps((s) => s.map((st, i) => (i === 0 ? { ...st, status: "working", progress: null } : st)));
    await new Promise((r) => setTimeout(r, 4600));
    setSteps((s) => s.map((st, i) => (i === 0 ? { ...st, status: "done" } : { ...st, status: "working", progress: 0.5 })));
    await new Promise((r) => setTimeout(r, 1200));
    setSteps((s) => s.map((st) => ({ ...st, status: "done" })));
    setLink(`${window.location.origin}/verify/${Math.random().toString(36).slice(2, 10)}`);
  };

  // The tear: a curl off the perforation, then it floats forward and is stamped.
  useEffect(() => {
    if (!link || !page.current) return;
    const el = page.current;
    const st = el.querySelector(".verified-stamp");
    if (prefersReducedMotion()) {
      gsap.set(st, { opacity: 1 });
      return;
    }
    gsap.set(st, { opacity: 0 });
    gsap
      .timeline()
      .to(el, { rotationY: -14, rotation: 3, z: 200, scale: 1.12, duration: 0.6, ease: "fold", transformPerspective: 1600, transformOrigin: "100% 50%" })
      .to(el, { rotationY: 0, rotation: -1.5, z: 80, scale: 1.04, duration: 0.5, ease: "paper" })
      .add(stamp(st!, { theta: -8, surface: el }), "-=0.1");
  }, [link]);

  return (
    <>
      <PageHeader title="Show a page" context="Prove one thing about your Diary. Nothing else leaves it." />
      <div className="show-layout">
        <ol className="show-steps">
          <li className="card" data-enter>
            <h2 className="type-label" style={{ color: "var(--ink-soft)", marginBottom: 14 }}>
              1 · What to show
            </h2>
            <ul className="claims">
              {claims.map((c) => (
                <li key={c.id}>
                  <label className="claim" data-disabled={!c.enabled || undefined}>
                    <input type="checkbox" checked={picked[c.id] && c.enabled} disabled={!c.enabled} onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.checked }))} />
                    <span className="claim-box" aria-hidden="true" />
                    <span className="type-body">{c.node}</span>
                  </label>
                  {!c.enabled && (
                    <span className="type-small" style={{ color: "var(--ink-soft)", marginLeft: 38 }}>
                      {c.why}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
          <li className="card" data-enter>
            <h2 className="type-label" style={{ color: "var(--ink-soft)", marginBottom: 14 }}>
              2 · Who it&rsquo;s for
            </h2>
            <Field label="Name of the lender or circle" placeholder="e.g. Kasama Lending" value={scope} onChange={(e) => setScope(e.target.value)} helper="Each page is made for one reader. It can't be linked to your other pages." />
          </li>
          <li className="card" data-enter>
            <h2 className="type-label" style={{ color: "var(--ink-soft)", marginBottom: 14 }}>
              3 · Make the page
            </h2>
            {startedAt == null ? (
              <Button variant="money" onClick={make} disabled={!ready} disabledReason={!ready ? "Pick at least one claim and name the reader." : undefined}>
                {copy.cta.showPage}
              </Button>
            ) : (
              <LanternStepper steps={steps} startedAt={startedAt} label="Page proof" />
            )}
          </li>
        </ol>

        <aside className="show-preview" aria-label="Page preview">
          <div ref={page} className="show-page" style={{ transformStyle: "preserve-3d" }}>
            <DiaryPage perforated="left" style={{ height: 500 }}>
              <p className="type-label" style={{ color: "var(--ink-soft)" }}>
                Party Diary · one page
              </p>
              <p className="type-word" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 24 }}>
                {statement ? `${statement[0].toUpperCase()}${statement.slice(1)}.` : "Pick what to show."}
              </p>
              <p className="type-small" style={{ color: "var(--ink-soft)", marginTop: "auto" }}>
                For {scope || "…"} · {TIER_NAMES[me.data?.tier ?? 0]} tier
              </p>
              <Stamp className="verified-stamp" label="Verified by proof" ink="teal" style={{ position: "absolute", right: 20, bottom: 70, opacity: 0 }} />
            </DiaryPage>
          </div>
          {link && (
            <div className="share-row" style={{ width: 360 }}>
              <div className="share-link">
                <span className="type-mono">{link.replace(/^https?:\/\//, "")}</span>
                <CopyButton value={link} label="Copy verification link" onCopied={() => toast({ text: copy.toast.copied, icon: "copy" })} />
              </div>
              <Button variant="ghost" size="S">
                Verify on-chain (optional)
              </Button>
              <p className="type-small" style={{ color: "var(--ink-soft)" }}>
                This page shows only what you picked.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
