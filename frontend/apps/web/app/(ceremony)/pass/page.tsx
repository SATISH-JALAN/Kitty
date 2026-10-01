"use client";
/**
 * Guest Pass (brief 13.1). Night. A paper door on the left; on the right three steps —
 * sign in, drop the test QR into the envelope, make the pass (fetch keys → build proof →
 * send) — and the slip of what's never stored, each line struck through as it enters.
 * Success: the door opens, light floods out, the Guest Pass medallion is stamped.
 */
import { useEffect, useRef, useState } from "react";
import { gsap } from "@kitty/ui/motion/gsap";
import { stamp } from "@kitty/ui/motion/primitives/physical";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { WaxSeal } from "@kitty/ui/brand/WaxSeal";
import { Button } from "@kitty/ui/components/Button";
import { EnvelopeDropzone, type DropState } from "@kitty/ui/components/EnvelopeDropzone";
import { Field } from "@kitty/ui/components/Field";
import { Icon } from "@kitty/ui/components/Icon";
import { LanternStepper, type Step } from "@kitty/ui/components/LanternStepper";
import { Stamp } from "@kitty/ui/components/Stamp";
import { Emblem } from "@kitty/ui/generators/emblem";
import { TornEdgeSvg } from "@kitty/ui/paper/TornEdgeSvg";
import { useIrisEntry } from "@/components/chrome/Transition";
import { Door } from "@/components/stage/Door";
import { copy } from "@/copy/en";
import { PRIVY_APP_ID, useSession } from "@/data/session";
import { ProofError, proveRegistration, readTestQr, type ProofEvent } from "@/lib/prover";

const NEVER = ["Your name", "Your ID number", "Your photo", "Your address", "Your date of birth"];
const STEP_LABELS = ["Fetch keys", "Build proof", "Send"];

function NeverStored() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = Array.from(el.querySelectorAll<HTMLElement>(".redact"));
    const st = el.querySelector(".never-stamp");
    if (prefersReducedMotion()) {
      gsap.set(bars, { scaleX: 1 });
      gsap.set(st, { opacity: 1 });
      return;
    }
    gsap.set(bars, { scaleX: 0, transformOrigin: "0% 50%" });
    gsap.set(st, { opacity: 0 });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const i = bars.indexOf(e.target.querySelector(".redact") as HTMLElement);
          gsap.to(e.target.querySelector(".redact"), { scaleX: 1, duration: 0.36, ease: "ink", delay: 0.15 + i * 0.14 });
          if (i === bars.length - 1 && st) stamp(st, { theta: -6, delay: 0.15 + i * 0.14 + 0.4, surface: el });
        });
      },
      { threshold: 0.5 },
    );
    el.querySelectorAll(".never-line").forEach((l) => io.observe(l));
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} data-world="paper" className="never-slip paper-fibre">
      <p className="type-label" style={{ color: "var(--ink-soft)", marginBottom: 14 }}>
        What&rsquo;s never stored
      </p>
      <ul>
        {NEVER.map((n) => (
          <li key={n} className="never-line">
            <span className="redact" aria-hidden="true" />
            <span>{n}</span>
          </li>
        ))}
      </ul>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <Stamp className="never-stamp" label="Never stored" ink="plum" rotate={-6} />
      </div>
      <p className="type-small stitch-t" style={{ marginTop: 18, paddingTop: 14, color: "var(--ink-soft)" }}>
        {copy.pass.keeps}
      </p>
    </div>
  );
}

function StepHead({ n, title, done, active }: { n: number; title: string; done?: boolean; active?: boolean }) {
  return (
    <h2 className="pass-step-head" data-active={active || undefined}>
      <span className="pass-step-n type-mono" aria-hidden="true">
        {done ? <Icon name="done" size={20} /> : n}
      </span>
      <span className="type-h3">{title}</span>
      {done && <span className="sr-only">(done)</span>}
    </h2>
  );
}

export default function PassPage() {
  const root = useRef<HTMLElement>(null);
  const door = useRef<HTMLDivElement>(null);
  const success = useRef<HTMLDivElement>(null);
  const { email, signIn, grantPass } = useSession();
  const [draft, setDraft] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropState>("empty");
  const [qrErr, setQrErr] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>(STEP_LABELS.map((label) => ({ label, status: "idle" })));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [failure, setFailure] = useState<ProofError["kind"] | null>(null);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);
  useIrisEntry(root);
  useEffect(() => setMounted(true), []);

  const signedIn = mounted && !!email;
  const qrOk = drop === "sealed";

  // The door's light comes up once.
  useEffect(() => {
    const el = door.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(el.querySelectorAll(".door-img"), { filter: "brightness(.55)" }, { filter: "brightness(1)", duration: 1.2, ease: "lantern" });
    gsap.fromTo(el.querySelectorAll(".door-glow"), { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "lantern" });
  }, []);

  const onEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft)) {
      setEmailErr("That doesn't look like an email. Try name@example.com.");
      return;
    }
    setEmailErr(null);
    signIn(draft);
  };

  const onFile = async (f: File) => {
    setQrErr(null);
    try {
      await readTestQr(f);
      setDrop("sealed");
    } catch {
      setDrop("invalid");
      setQrErr("We couldn't read that QR. Try a sharper image of the test QR.");
    }
  };

  const run = async () => {
    setFailure(null);
    setStartedAt(Date.now());
    setSteps(STEP_LABELS.map((label) => ({ label, status: "idle" })));
    const idx = { keys: 0, proof: 1, send: 2 } as const;
    try {
      await proveRegistration((e: ProofEvent) =>
        setSteps((s) =>
          s.map((st, i) =>
            i < idx[e.step]
              ? { ...st, status: "done" }
              : i === idx[e.step]
                ? { ...st, status: e.progress === 1 ? "done" : "working", progress: e.progress, detail: e.detail }
                : st,
          ),
        ),
      );
      grantPass();
      setDone(true);
    } catch (err) {
      const kind = err instanceof ProofError ? err.kind : "interrupted";
      setFailure(kind);
      setSteps((s) => s.map((st) => (st.status === "working" ? { ...st, status: "error" } : st)));
    }
  };

  // Success ceremony (1.8 s): leaves open, light floods out, the medallion is stamped.
  useEffect(() => {
    if (!done) return;
    const reduce = prefersReducedMotion();
    const d = door.current;
    const s = success.current;
    if (!d || !s) return;
    const r = d.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (reduce) {
      gsap.set(s, { autoAlpha: 1 });
      return;
    }
    const tl = gsap.timeline();
    tl.to(d.querySelector(".door-leaf-l"), { rotationY: -70, duration: 0.7, ease: "fold" }, 0)
      .to(d.querySelector(".door-leaf-r"), { rotationY: 70, duration: 0.7, ease: "fold" }, 0)
      .set(s, { autoAlpha: 1 }, 0.45)
      .fromTo(s, { clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${Math.hypot(window.innerWidth, window.innerHeight)}px at ${cx}px ${cy}px)`, duration: 0.9, ease: "ink" }, 0.45)
      .add(stamp(s.querySelector(".pass-medal")!, { theta: -4, scale: 1 }), 1.2)
      .fromTo(s.querySelectorAll(".pass-ok-line"), { yPercent: 105 }, { yPercent: 0, duration: 0.5, ease: "paper", stagger: 0.07 }, 1.35);
  }, [done]);

  return (
    <main ref={root} className="pass-page" aria-labelledby="pass-title">
      <div className="pass-door">
        <Door ref={door} priority height="min(560px, 70svh)" ornament={<Emblem partyId="act4-party" guests={10} tradition="kitty" size={120} style={{ width: "100%", height: "auto" }} />} />
      </div>

      <div className="pass-steps">
        <div className="pass-sheet-edge" aria-hidden="true">
          <TornEdgeSvg depth={18} seed={9} fill="var(--bg)" />
        </div>
        <h1 id="pass-title" className="type-h1">
          {copy.cta.pass}
        </h1>
        <p className="type-body-l" style={{ color: "var(--fg-soft)", marginTop: 12, maxWidth: "38ch" }}>
          One pass per person. {copy.pass.never}
        </p>

        <ol className="pass-list">
          <li>
            <StepHead n={1} title="Sign in with email" done={signedIn} active={!signedIn} />
            {signedIn ? (
              <p className="type-small" style={{ color: "var(--fg-soft)" }}>
                Signed in as {email}.
              </p>
            ) : (
              <form onSubmit={onEmail} className="pass-form" noValidate>
                <Field label="Email" type="email" autoComplete="email" placeholder="you@example.com" value={draft} onChange={(e) => setDraft(e.target.value)} error={emailErr} helper={PRIVY_APP_ID ? undefined : "Devnet demo sign-in: no wallet or seed phrase needed."} />
                <Button type="submit" iconEnd="arrow">
                  Continue
                </Button>
              </form>
            )}
          </li>
          <li aria-disabled={!signedIn || undefined} style={{ opacity: signedIn ? 1 : 0.5 }}>
            <StepHead n={2} title="Your test QR" done={qrOk} active={signedIn && !qrOk} />
            {signedIn && (
              <EnvelopeDropzone state={drop} onFile={onFile} helper="Test QR only · devnet · nothing real" error={qrErr} width="min(360px, 100%)" />
            )}
          </li>
          <li aria-disabled={!qrOk || undefined} style={{ opacity: qrOk ? 1 : 0.5 }}>
            <StepHead n={3} title="Make your pass" done={done} active={qrOk && !done} />
            {qrOk && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "flex-start" }}>
                {startedAt == null ? (
                  <Button onClick={run} iconEnd="arrow">
                    Make my pass
                  </Button>
                ) : (
                  <LanternStepper
                    steps={steps}
                    startedAt={startedAt}
                    onRetry={failure === "interrupted" ? run : undefined}
                    errorText={failure === "registered" ? "You already have a pass. Sign in with the same email to use it." : copy.error.proof}
                  />
                )}
                {failure === "registered" && <Stamp label="Already has a Guest Pass" ink="plum" colour="var(--marigold)" />}
              </div>
            )}
          </li>
        </ol>

        <NeverStored />
      </div>

      <div ref={success} className="pass-success" role="status" aria-live="polite" style={{ visibility: done ? undefined : "hidden" }}>
        {done && (
          <div className="pass-success-inner">
            <div className="pass-medal">
              <WaxSeal size={160} label="Your Guest Pass" />
            </div>
            <div style={{ overflow: "clip" }}>
              <h2 className="pass-ok-line type-display-l">You&rsquo;re on the guest list.</h2>
            </div>
            <div style={{ overflow: "clip", padding: 8 }}>
              <div className="pass-ok-line" style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
                <Button href="/parties" size="L">
                  {copy.cta.openInvite}
                </Button>
                <Button href="/tonight" size="L" variant="ghost">
                  {copy.cta.goTonight}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
