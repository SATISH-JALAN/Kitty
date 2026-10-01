"use client";
/**
 * Envelope dropzone (brief 7.7): a kraft envelope with an open slot. Dragover lifts the
 * flap 14° and lights a lantern glow inside; a drop slides the card in, closes the flap
 * and stamps a wax seal. An invalid file shakes the envelope ±3° once, with kind copy.
 * Keyboard and click open the file picker.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { gsap } from "../motion/gsap";
import { stamp } from "../motion/primitives/physical";
import { prefersReducedMotion } from "../motion/reduced";
import { WaxSeal } from "../brand/WaxSeal";

export type DropState = "empty" | "over" | "sealed" | "invalid";

export function EnvelopeDropzone({
  onFile,
  state,
  accept = "image/*",
  label = "Drop your test QR here, or choose a file",
  helper,
  error,
  width = 360,
}: {
  onFile: (file: File) => void;
  state?: DropState;
  accept?: string;
  label?: string;
  helper?: ReactNode;
  error?: string | null;
  width?: number | string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(false);
  const shown: DropState = state ?? (over ? "over" : "empty");

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const flap = el.querySelector(".env-flap");
    const glow = el.querySelector(".env-glow");
    const card = el.querySelector(".env-card");
    const seal = el.querySelector(".env-seal");
    const reduce = prefersReducedMotion();
    const d = reduce ? 0 : 1;
    if (shown === "over") {
      gsap.to(flap, { rotationX: -14, duration: 0.32 * d, ease: "paper" });
      gsap.to(glow, { opacity: 1, duration: 0.3 * d, ease: "lantern" });
    } else if (shown === "sealed") {
      const tl = gsap.timeline();
      tl.fromTo(card, { yPercent: -70, opacity: 1 }, { yPercent: 0, duration: 0.5 * d, ease: "paper" })
        .to(flap, { rotationX: 0, duration: 0.36 * d, ease: "fold" }, "-=0.1")
        .to(glow, { opacity: 0, duration: 0.3 * d }, "<");
      if (seal) tl.add(stamp(seal, { theta: -4, surface: el.querySelector(".env-body") }), "-=0.05");
    } else if (shown === "invalid") {
      gsap.to(flap, { rotationX: 0, duration: 0.2 * d });
      gsap.to(glow, { opacity: 0, duration: 0.2 * d });
      if (!reduce) gsap.fromTo(el.querySelector(".env-body"), { rotation: 0 }, { keyframes: { rotation: [0, 3, -3, 1.5, 0] }, duration: 0.42, ease: "none" });
    } else {
      gsap.to(flap, { rotationX: 0, duration: 0.3 * d, ease: "paper" });
      gsap.to(glow, { opacity: 0, duration: 0.3 * d });
    }
  }, [shown]);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width }}>
      <div
        ref={root}
        onDragEnter={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!root.current?.contains(e.relatedTarget as Node)) setOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
        data-cursor="drag"
        style={{ position: "relative", width: "100%", aspectRatio: "3 / 2", perspective: 700 }}
      >
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-describedby={`${id}-help`}
          data-focus-ring=""
          className="env-body"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", transformOrigin: "50% 100%" }}
        >
          <span className="sr-only">{label}</span>
          <svg viewBox="0 0 360 240" width="100%" height="100%" aria-hidden="true" style={{ overflow: "visible" }}>
            <defs>
              <pattern id={`${id}-kraft`} patternUnits="userSpaceOnUse" width="256" height="256">
                <image href="/art/P-3-512.webp" width="256" height="256" />
              </pattern>
              <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="55%">
                <stop offset="0" stopColor="#FFD27A" stopOpacity=".95" />
                <stop offset=".6" stopColor="#FFD27A" stopOpacity=".25" />
                <stop offset="1" stopColor="#FFD27A" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* back panel */}
            <rect x="8" y="40" width="344" height="192" rx="3" fill="#A9845A" />
            {/* inside glow */}
            <rect className="env-glow" x="8" y="40" width="344" height="192" fill={`url(#${id}-glow)`} opacity="0" />
            {/* the card that goes in */}
            <g className="env-card" style={{ opacity: shown === "sealed" ? 1 : 0 }}>
              <rect x="70" y="58" width="220" height="120" rx="3" fill="#F6EEDF" />
              <g fill="#22151F" opacity=".85">
                {Array.from({ length: 36 }, (_, i) => {
                  const x = 94 + (i % 6) * 9;
                  const y = 74 + Math.floor(i / 6) * 9;
                  return (i * 7) % 3 === 0 ? null : <rect key={i} x={x} y={y} width="7" height="7" />;
                })}
              </g>
              <rect x="170" y="80" width="90" height="6" rx="1" fill="#22151F" opacity=".25" />
              <rect x="170" y="94" width="70" height="6" rx="1" fill="#22151F" opacity=".25" />
              <text x="170" y="124" style={{ font: "500 12px var(--font-sans)", letterSpacing: "0.08em" }} fill="#22151F">
                TEST QR
              </text>
            </g>
            {/* front pocket */}
            <path d="M8,96 L180,176 L352,96 L352,232 L8,232 Z" fill={`url(#${id}-kraft)`} />
            <path d="M8,96 L180,176 L352,96 L352,232 L8,232 Z" fill="#C9A57A" opacity=".55" />
            <path d="M8,232 L150,150 M352,232 L210,150" stroke="#8C6A45" strokeWidth="1" opacity=".5" />
            <path d="M8,96 L180,176 L352,96" fill="none" stroke="#8C6A45" strokeWidth="1.2" />
          </svg>
          {/* the flap, hinged at the top edge */}
          <svg
            className="env-flap"
            viewBox="0 0 360 120"
            width="100%"
            aria-hidden="true"
            style={{ position: "absolute", left: 0, top: "16.6%", transformOrigin: "50% 0%", overflow: "visible", backfaceVisibility: "visible" }}
          >
            <path d="M8,0 L352,0 L190,92 C184,96 176,96 170,92 Z" fill="#B8905F" />
            <path d="M8,0 L352,0 L190,92 C184,96 176,96 170,92 Z" fill="none" stroke="#8C6A45" strokeWidth="1" />
          </svg>
          <span className="env-seal" style={{ position: "absolute", left: "50%", top: "52%", translate: "-50% -50%", opacity: shown === "sealed" ? 1 : 0 }}>
            <WaxSeal size={48} />
          </span>
          {shown !== "sealed" && (
            <span className="type-small" style={{ position: "absolute", left: 0, right: 0, bottom: "12%", textAlign: "center", color: "var(--ink)", fontWeight: 500, padding: "0 24px" }} aria-hidden="true">
              {label}
            </span>
          )}
        </button>
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      <span id={`${id}-help`} className="type-small" style={{ color: error ? "var(--error)" : "var(--fg-soft)" }} aria-live="polite">
        {error ?? helper}
      </span>
    </div>
  );
}
