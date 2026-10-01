"use client";
/**
 * Chit (brief 7.16): 88×56, two panels folded down the middle (right panel at 94%
 * brightness), cut edges. Content is split across both panels so it folds with them.
 * States: blank · stamped (teal ink over the corner at −8°) · folded (right panel onto
 * the left) · unfolding (animate `.chit-right` rotationY −180 → 0).
 */
import { forwardRef, type CSSProperties, type ReactNode } from "react";

export type ChitState = "blank" | "stamped" | "folded";

export interface ChitProps {
  children?: ReactNode;
  state?: ChitState;
  width?: number;
  className?: string;
  style?: CSSProperties;
  /** Content face: money (tabular) or a party name (Boska italic). */
  face?: "money" | "name";
}

export const Chit = forwardRef<HTMLDivElement, ChitProps>(function Chit(
  { children, state = "blank", width = 88, className, style, face = "money" },
  ref,
) {
  const h = (width * 56) / 88;
  const text = (
    <span
      className={face === "money" ? "type-money" : "type-word"}
      style={{
        position: "absolute",
        inset: 0,
        width,
        display: "grid",
        placeItems: "center",
        fontSize: face === "money" ? Math.round(width * 0.19) : Math.round(width * 0.17),
        color: "var(--ink)",
        lineHeight: 1.05,
        textAlign: "center",
        padding: "0 6px",
      }}
    >
      {children}
    </span>
  );
  const panel: CSSProperties = {
    position: "absolute",
    top: 0,
    width: width / 2,
    height: h,
    overflow: "hidden",
    background: "var(--paper)",
    backfaceVisibility: "hidden",
  };
  return (
    <div
      ref={ref}
      className={`chit ${className ?? ""}`}
      data-state={state}
      style={{ position: "relative", width, height: h, perspective: 400, transformStyle: "preserve-3d", ...style }}
    >
      <div className="chit-shadow" style={{ position: "absolute", inset: 0, boxShadow: "var(--d1)", borderRadius: 1 }} />
      <div className="chit-left" style={{ ...panel, left: 0, borderRadius: "1px 0 0 1px" }}>
        {text}
      </div>
      <div
        className="chit-right"
        style={{
          ...panel,
          left: width / 2,
          borderRadius: "0 1px 1px 0",
          transformOrigin: "0% 50%",
          transform: state === "folded" ? "rotateY(-180deg)" : undefined,
          filter: "brightness(.94)",
          boxShadow: "inset 1px 0 0 rgba(34,21,31,.08)",
        }}
      >
        <span data-overlap-ok="" aria-hidden="true" style={{ position: "absolute", inset: 0, left: -width / 2 }}>{text}</span>
      </div>
      {/* back of the right panel, visible once folded */}
      <div
        className="chit-back"
        aria-hidden="true"
        style={{
          ...panel,
          left: width / 2,
          transformOrigin: "0% 50%",
          transform: state === "folded" ? "rotateY(0deg)" : "rotateY(180deg)",
          background: "var(--paper-deep)",
        }}
      />
      {state === "stamped" && (
        <svg className="chit-stamp" viewBox="0 0 40 40" width={width * 0.42} height={width * 0.42} style={{ position: "absolute", right: -width * 0.08, top: -width * 0.1, transform: "rotate(-8deg)", filter: "url(#ink)" }} aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="none" stroke="var(--teal)" strokeWidth="2" />
          <circle cx="20" cy="20" r="13.5" fill="none" stroke="var(--teal)" strokeWidth="1" />
          <path d="M13 20.5l4.5 4.5 9-9.5" fill="none" stroke="var(--teal)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
});
