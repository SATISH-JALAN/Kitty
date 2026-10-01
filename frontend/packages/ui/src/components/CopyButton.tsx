"use client";
/**
 * Copy → stamp (primitive 29): the copy glyph swaps to a small round teal stamp reading
 * "Copied" (the rubber stamp at 0.5 scale), then reverts after 1.2 s.
 */
import { useEffect, useRef, useState } from "react";
import { stamp } from "../motion/primitives/physical";
import { Icon } from "./Icon";

export function CopyButton({ value, label = "Copy", onCopied, className, style }: { value: string; label?: string; onCopied?: () => void; className?: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  const stampRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!copied) return;
    if (stampRef.current) stamp(stampRef.current, { theta: -8, scale: 1 });
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    onCopied?.();
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      data-focus-ring=""
      className={className}
      style={{ position: "relative", width: 44, height: 44, display: "inline-grid", placeItems: "center", color: "var(--fg)", flex: "none", ...style }}
    >
      {copied ? (
        <svg ref={stampRef} viewBox="0 0 48 48" width="40" height="40" aria-hidden="true" style={{ filter: "url(#ink)", color: "var(--money)" }}>
          <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="24" cy="24" r="17.5" fill="none" stroke="currentColor" strokeWidth="1" />
          <text x="24" y="27" textAnchor="middle" fill="currentColor" style={{ font: "600 8px var(--font-sans)", letterSpacing: ".08em" }}>
            COPIED
          </text>
        </svg>
      ) : (
        <Icon name="copy" size={20} />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied." : ""}
      </span>
    </button>
  );
}
