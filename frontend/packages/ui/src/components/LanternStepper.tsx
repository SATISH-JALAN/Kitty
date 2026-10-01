"use client";
/**
 * Lantern stepper (brief 7.8) for proofs and transactions. A twine string (max 560 px)
 * with 3–4 lanterns. Unlit: an outline. Working: flicker + a thin arc driven by real
 * progress. Lit: full glow. Error: dims and swings once, with a retry. Shows elapsed time;
 * never fakes progress — indeterminate steps flicker slowly and say how long it can take.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap, swing } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { Button } from "./Button";
import { Lantern, type LanternHandle } from "./Lantern";

export type StepStatus = "idle" | "working" | "done" | "error";

export interface Step {
  label: string;
  status: StepStatus;
  /** 0–1 real progress, or null when indeterminate. */
  progress?: number | null;
  /** Extra line while working, e.g. "Downloading keys · 212 / 600 MB · once only". */
  detail?: ReactNode;
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function StepLantern({ step }: { step: Step }) {
  const lantern = useRef<LanternHandle>(null);
  const arc = useRef<SVGCircleElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  const R = 25;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    const glow = lantern.current?.glow;
    if (!glow) return;
    if (step.status === "done") gsap.to(glow, { opacity: 1, scale: 1, duration: 0.3, ease: "lantern" });
    else if (step.status === "error") {
      gsap.to(glow, { opacity: 0.15, duration: 0.5, ease: "lantern" });
      if (wrap.current && !prefersReducedMotion()) {
        gsap.set(wrap.current, { transformOrigin: "50% 0%" });
        swing(wrap.current, 7, 1.2, { fromAmp: true });
      }
    } else if (step.status === "working" && step.progress == null && !prefersReducedMotion()) {
      const t = gsap.fromTo(glow, { opacity: 0.35 }, { opacity: 0.85, duration: 0.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
      return () => {
        t.kill();
      };
    } else if (step.status === "idle") gsap.set(glow, { opacity: 0 });
  }, [step.status, step.progress]);

  useEffect(() => {
    if (!arc.current) return;
    const p = step.status === "done" ? 1 : step.progress ?? 0;
    gsap.to(arc.current, { strokeDashoffset: C * (1 - p), duration: prefersReducedMotion() ? 0 : 0.3, ease: "paper" });
    const glow = lantern.current?.glow;
    if (glow && step.status === "working" && step.progress != null) gsap.to(glow, { opacity: 0.3 + p * 0.6, duration: 0.3 });
  }, [step.progress, step.status, C]);

  return (
    <span ref={wrap} style={{ position: "relative", display: "grid", placeItems: "center", width: 56, height: 60 }}>
      <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: "absolute", top: 2, transform: "rotate(-90deg)", opacity: step.status === "working" ? 1 : 0, transition: "opacity var(--t-m)" }} aria-hidden="true">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--hairline)" strokeWidth="1" />
        <circle ref={arc} cx="28" cy="28" r={R} fill="none" stroke="var(--lantern)" strokeWidth="1.5" strokeDasharray={C} strokeDashoffset={C} strokeLinecap="round" />
      </svg>
      <Lantern ref={lantern} width={28} lit={step.status === "done" ? 1 : step.status === "idle" ? 0 : 0.5} outline={step.status === "idle"} flicker={step.status === "working" && step.progress != null} />
    </span>
  );
}

export function LanternStepper({
  steps,
  startedAt,
  onRetry,
  errorText,
  indeterminateNote = "This can take up to 30 seconds.",
  label = "Progress",
}: {
  steps: Step[];
  startedAt?: number | null;
  onRetry?: () => void;
  errorText?: ReactNode;
  indeterminateNote?: string;
  label?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const running = steps.some((s) => s.status === "working");
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);
  const current = steps.find((s) => s.status === "working" || s.status === "error");
  const doneCount = steps.filter((s) => s.status === "done").length;
  const pct = Math.round(((doneCount + (current?.status === "working" ? current.progress ?? 0 : 0)) / steps.length) * 100);
  const failed = steps.some((s) => s.status === "error");
  const allDone = doneCount === steps.length;

  return (
    <div role="group" aria-label={label} style={{ maxWidth: 560, width: "100%" }}>
      <div style={{ position: "relative", paddingTop: 6 }}>
        <svg width="100%" height="14" preserveAspectRatio="none" viewBox="0 0 100 14" style={{ position: "absolute", top: 0, left: 0 }} aria-hidden="true">
          <path d="M0,2 Q50,12 100,2" fill="none" stroke="var(--twine)" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
        </svg>
        <ol style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, position: "relative", listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map((s, i) => (
            <li key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }} aria-current={s.status === "working" ? "step" : undefined}>
              <span style={{ width: 1, height: i === 0 || i === steps.length - 1 ? 6 : 10, background: "var(--twine)" }} aria-hidden="true" />
              <StepLantern step={s} />
              <span className="type-small" style={{ color: s.status === "idle" ? "var(--fg-soft)" : "var(--fg)", fontWeight: s.status === "working" ? 500 : 400 }}>
                {s.label}
                <span className="sr-only">{s.status === "done" ? " (done)" : s.status === "working" ? " (in progress)" : s.status === "error" ? " (stopped)" : ""}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 14 }} aria-live="polite">
        <span className="type-small" style={{ color: failed ? "var(--error)" : "var(--fg-soft)" }}>
          {failed ? errorText : current?.status === "working" ? current.detail ?? (current.progress == null ? indeterminateNote : null) : allDone ? "Done." : null}
        </span>
        <span className="type-mono" style={{ color: "var(--fg-soft)", whiteSpace: "nowrap" }}>
          {startedAt ? fmt((allDone || failed ? now : now) - startedAt) : "0:00"} · {pct}%
        </span>
      </div>
      {failed && onRetry && (
        <div style={{ marginTop: 16 }}>
          <Button variant="ghost" size="S" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
