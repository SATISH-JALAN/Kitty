"use client";
/**
 * Tooltip (brief 7.14): a paper tag hung on a 10 px twine string from its anchor,
 * swinging in (rotate 8° → 0, damped over 500 ms, origin at the string's top).
 * Opens on hover after `delay`, on focus, or when `open` is controlled.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { gsap, swing } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";

export function Tooltip({
  content,
  children,
  delay = 500,
  open: controlled,
  placement = "bottom",
  maxWidth = 240,
}: {
  content: ReactNode;
  children: ReactNode;
  delay?: number;
  open?: boolean;
  placement?: "bottom" | "top";
  maxWidth?: number;
}) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const tag = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = controlled ?? hover;

  useEffect(() => {
    if (!open || !tag.current || prefersReducedMotion()) return;
    gsap.set(tag.current, { transformOrigin: placement === "bottom" ? "50% 0%" : "50% 100%" });
    const t = swing(tag.current, 8, 0.5, { tau: 0.14, freq: 2.2, fromAmp: true });
    return () => {
      t.kill();
    };
  }, [open, placement]);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(true), delay);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    setHover(false);
  };

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={() => setHover(true)}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          ref={tag}
          role="tooltip"
          id={id}
          style={{
            position: "absolute",
            left: "50%",
            [placement === "bottom" ? "top" : "bottom"]: "100%",
            translate: "-50% 0",
            zIndex: 30,
            display: "flex",
            flexDirection: placement === "bottom" ? "column" : "column-reverse",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          <span aria-hidden="true" style={{ width: 1.25, height: 10, background: "var(--twine)" }} />
          <span
            data-world="paper"
            className="type-small"
            style={{
              maxWidth,
              width: "max-content",
              padding: "8px 10px",
              background: "var(--paper)",
              color: "var(--ink)",
              borderRadius: "var(--radius-cut)",
              boxShadow: "var(--d2)",
              position: "relative",
            }}
          >
            <span aria-hidden="true" style={{ position: "absolute", left: "50%", [placement === "bottom" ? "top" : "bottom"]: 4, width: 5, height: 5, marginLeft: -2.5, borderRadius: "50%", background: "var(--paper-deep)", boxShadow: "inset 0 0 0 1px var(--hairline)" }} />
            <span style={{ display: "block", paddingTop: placement === "bottom" ? 6 : 0, paddingBottom: placement === "top" ? 6 : 0 }}>{content}</span>
          </span>
        </span>
      )}
    </span>
  );
}
