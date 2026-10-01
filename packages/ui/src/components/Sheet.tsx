"use client";
/**
 * Sheet / modal (brief 7.13).
 * Desktop: a centred paper sheet (max 560, padding 32, d4) laid flat — from 24 px below,
 * scale .98 → 1, rotateX 6° → 0, 480 ms. Mobile: a bottom sheet with a torn top edge and
 * a twine-loop handle, snapping at 50% and 92%. Focus is trapped; Esc closes; focus
 * returns to the trigger.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { TornEdgeSvg } from "../paper/TornEdgeSvg";
import { Icon } from "./Icon";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** World of the sheet surface. */
  world?: "paper" | "night";
  /** World under the sheet, for the backdrop colour. */
  backdrop?: "paper" | "night";
  maxWidth?: number;
  hideTitle?: boolean;
}

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

export function Sheet({ open, onClose, title, children, world = "paper", backdrop = "paper", maxWidth = 560, hideTitle }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(open);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const trigger = useRef<Element | null>(null);
  const mobile = useIsMobile();
  const drag = useRef<{ y0: number; h: number } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      trigger.current = document.activeElement;
      setVisible(true);
    } else if (visible) {
      const reduce = prefersReducedMotion();
      const tl = gsap.timeline({
        onComplete: () => {
          setVisible(false);
          (trigger.current as HTMLElement | null)?.focus?.();
        },
      });
      if (!reduce && panel.current) {
        tl.to(panel.current, mobile ? { yPercent: 100, duration: 0.36, ease: "fold" } : { y: 24, opacity: 0, rotationX: 6, duration: 0.3, ease: "fold" }, 0);
        tl.to(scrim.current, { opacity: 0, duration: 0.3 }, 0);
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible || !open || !panel.current) return;
    const el = panel.current;
    const reduce = prefersReducedMotion();
    if (!reduce) {
      gsap.fromTo(scrim.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "paper" });
      if (mobile) gsap.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: 0.48, ease: "paper" });
      else gsap.fromTo(el, { y: 24, scale: 0.98, rotationX: 6, opacity: 0 }, { y: 0, scale: 1, rotationX: 0, opacity: 1, duration: 0.48, ease: "paper", transformPerspective: 1200, transformOrigin: "50% 100%" });
    }
    const first = el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const a = nodes[0];
      const b = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [visible, open, mobile, onClose]);

  if (!mounted || !visible) return null;

  const onHandleDown = (e: React.PointerEvent) => {
    if (!panel.current) return;
    drag.current = { y0: e.clientY, h: panel.current.getBoundingClientRect().height };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y0);
    gsap.set(panel.current, { y: dy });
  };
  const onHandleUp = (e: React.PointerEvent) => {
    if (!drag.current || !panel.current) return;
    const dy = e.clientY - drag.current.y0;
    drag.current = null;
    if (dy > 120) onClose();
    else gsap.to(panel.current, { y: 0, duration: 0.3, ease: "paper" });
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: "var(--z-sheet)" as unknown as number }}>
      <div
        ref={scrim}
        onClick={onClose}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, background: backdrop === "night" ? "rgba(7,3,12,.6)" : "rgba(34,21,31,.4)" }}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-world={world}
        className="paper-fibre"
        style={
          mobile
            ? {
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                maxHeight: "92dvh",
                minHeight: "50dvh",
                background: "var(--bg)",
                color: "var(--fg)",
                boxShadow: "var(--d4)",
                display: "flex",
                flexDirection: "column",
                paddingBottom: "env(safe-area-inset-bottom)",
              }
            : {
                position: "absolute",
                left: "50%",
                top: "50%",
                translate: "-50% -50%",
                width: `min(${maxWidth}px, calc(100vw - 2 * var(--margin)))`,
                maxHeight: "calc(100dvh - 96px)",
                overflow: "auto",
                padding: 32,
                background: "var(--bg)",
                color: "var(--fg)",
                borderRadius: "var(--radius-cut)",
                boxShadow: "var(--d4)",
              }
        }
      >
        {mobile && (
          <>
            <div style={{ position: "absolute", left: 0, right: 0, top: -9 }}>
              <TornEdgeSvg depth={18} seed={31} fill="var(--bg)" />
            </div>
            <div
              onPointerDown={onHandleDown}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
              style={{ display: "grid", placeItems: "center", height: 32, touchAction: "none", cursor: "grab" }}
              aria-hidden="true"
            >
              <svg width="44" height="14" viewBox="0 0 44 14">
                <path d="M4,7 C12,1 16,13 22,7 C28,1 32,13 40,7" fill="none" stroke="var(--twine)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </>
        )}
        <div style={mobile ? { overflow: "auto", padding: "0 20px 24px" } : undefined}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
            <h2 className={hideTitle ? "sr-only" : "type-h2"}>{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" data-focus-ring="" style={{ width: 44, height: 44, display: "grid", placeItems: "center", marginTop: -8, marginRight: -12 }}>
              <Icon name="close" size={20} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
