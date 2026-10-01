"use client";
/**
 * Footer (brief 11, Finale). Night, min-height 100svh.
 * A giant "Kitty" (31vw) cut from dark paper with the lantern sky glowing through the
 * letterforms; each letter lifts toward the cursor with its own paper shadow. Four
 * columns above it — Party · Build · Colophon · Notes — and the brand line.
 */
import Link from "next/link";
import { useId, useRef } from "react";
import { gsap, useGSAP } from "@kitty/ui/motion/gsap";
import { MQ, prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { BowGlyph } from "@kitty/ui/brand/BowMask";
import { WORDMARK } from "@kitty/ui/brand/wordmark.generated";
import { CopyButton } from "@kitty/ui/components/CopyButton";
import { truncateId } from "@kitty/sdk";
import { art, largest } from "@/art/manifest";
import { copy, footnotes } from "@/copy/en";
import { LINKS } from "@/lib/links";

const S = 360 / 227;

function LitWordmark() {
  const id = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const [, top, w, h] = WORDMARK.viewBox.split(" ").map(Number);
  const sky = largest(art("H-1"), "webp");

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || prefersReducedMotion() || !window.matchMedia(MQ.fine).matches) return;
      const letters = Array.from(el.querySelectorAll<SVGGElement>(".lw-letter"));
      const setters = letters.map((l) => gsap.quickTo(l, "y", { duration: 0.5, ease: "paper" }));
      const onMove = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        if (e.clientY < r.top - 200 || e.clientY > r.bottom + 100) {
          setters.forEach((s) => s(0));
          return;
        }
        const ux = ((e.clientX - r.left) / r.width) * w - 10;
        letters.forEach((l, i) => {
          const g = WORDMARK.glyphs[i];
          const cx = g ? (g.x0 + g.x1) / 2 : WORDMARK.dot.x;
          const d = Math.abs(ux - cx);
          setters[i](d < 500 ? -60 * (1 - d / 500) : 0);
        });
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      return () => window.removeEventListener("pointermove", onMove);
    },
    { scope: ref },
  );

  return (
    <svg ref={ref} viewBox={`-10 ${top} ${w} ${h}`} className="lit-wordmark" role="img" aria-label="Kitty">
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="70%" r="70%">
          <stop offset="0" stopColor="#FFD27A" stopOpacity=".55" />
          <stop offset=".55" stopColor="#E4572E" stopOpacity=".22" />
          <stop offset="1" stopColor="#4E2152" stopOpacity=".1" />
        </radialGradient>
        <pattern id={`${id}-sky`} patternUnits="userSpaceOnUse" x={-10} y={top} width={w} height={h}>
          <image href={sky} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
          {/* Lantern light behind the paper, so every letter glows (the sky art is dark on its left). */}
          <rect width={w} height={h} fill={`url(#${id}-glow)`} style={{ mixBlendMode: "screen" }} />
        </pattern>
      </defs>
      {WORDMARK.glyphs.map((g, i) => (
        <g key={i} className="lw-letter">
          {/* paper shadows (offset copies, no filters on large moving shapes: brief 8.5) */}
          <path d={g.d} fill="#07030C" opacity=".28" transform="translate(0 26)" />
          <path d={g.d} fill="#07030C" opacity=".45" transform="translate(0 9)" />
          {/* the cut edge catches the light, then the sky shows through */}
          <path d={g.d} fill="none" stroke="rgba(246,238,223,.22)" strokeWidth="8" />
          <path d={g.d} fill={`url(#${id}-sky)`} />
        </g>
      ))}
      <g className="lw-letter">
        <g transform={`translate(${(WORDMARK.dot.x - 120 * S).toFixed(1)} ${(WORDMARK.dot.y - 57 * S).toFixed(1)}) scale(${S.toFixed(4)})`}>
          <BowGlyph idBase={`${id}-bow`} />
        </g>
      </g>
    </svg>
  );
}

export function Footer() {
  const programId = LINKS.programId;
  return (
    <footer className="site-footer" data-section-world="night" data-world="night">
      <div className="grid-page footer-cols">
        <nav aria-label="Party" className="footer-col">
          <h2 className="type-label footer-h">{copy.footer.party}</h2>
          <a href="#act-4">{copy.nav.howItWorks}</a>
          <a href="#act-6">{copy.nav.diary}</a>
          <a href="#act-7">{copy.nav.house}</a>
          <Link href="/pass">{copy.cta.pass}</Link>
        </nav>
        <div className="footer-col">
          <h2 className="type-label footer-h">{copy.footer.build}</h2>
          {LINKS.github && (
            <a href={LINKS.github} target="_blank" rel="noreferrer">
              {copy.footer.github}
            </a>
          )}
          {LINKS.docs.startsWith("http") && (
            <a href={LINKS.docs} target="_blank" rel="noreferrer">
              {copy.footer.docs}
            </a>
          )}
          <span className="footer-program">
            <span className="type-small" style={{ color: "var(--moon-soft)" }}>
              {copy.footer.programId}
            </span>
            {programId ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                <a className="type-mono" href={LINKS.account(programId)} target="_blank" rel="noreferrer">
                  {truncateId(programId)}
                </a>
                <CopyButton value={programId} label="Copy program ID" />
              </span>
            ) : (
              <span className="type-mono" style={{ color: "var(--moon-soft)" }}>
                deploying to devnet
              </span>
            )}
          </span>
        </div>
        <div className="footer-col">
          <h2 className="type-label footer-h">{copy.footer.colophon}</h2>
          <span>{copy.footer.builtFor}</span>
          <span style={{ color: "var(--moon-soft)" }}>{copy.footer.devnetLine}</span>
        </div>
        <div className="footer-col">
          <h2 className="type-label footer-h">{copy.footer.notes}</h2>
          <ol className="footnotes">
            {footnotes.map((f) => (
              <li key={f.n} id={`fn-${f.n}`}>
                <sup>{f.n}</sup>{" "}
                <a href={f.href} target="_blank" rel="noreferrer">
                  {f.text}
                </a>
              </li>
            ))}
          </ol>
        </div>
        <p className="footer-line type-h2">
          <em className="type-word">{copy.brand.line}</em>
        </p>
      </div>
      <div className="footer-word">
        <LitWordmark />
      </div>
    </footer>
  );
}
