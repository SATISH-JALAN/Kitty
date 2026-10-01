"use client";
/**
 * Toast (brief 7.12): a paper slip pushed under the door. Enters bottom-left sliding up
 * 16 px with rotation −1.5° → 0 (420 ms paper); dismisses after 5 s (paused on hover or
 * focus) by sliding down behind the viewport edge.
 */
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { Icon, type IconName } from "./Icon";

export interface ToastItem {
  id: number;
  text: ReactNode;
  icon?: IconName;
  action?: { label: string; onClick: () => void };
}

let items: ToastItem[] = [];
let seq = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<ToastItem, "id">) {
  items = [...items, { ...t, id: seq++ }].slice(-3);
  emit();
}
function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function Slip({ t }: { t: ToastItem }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leave = () => {
    const el = ref.current;
    if (!el) return dismiss(t.id);
    if (prefersReducedMotion()) return dismiss(t.id);
    gsap.to(el, { y: 120, rotation: 1, duration: 0.42, ease: "fold", onComplete: () => dismiss(t.id) });
  };
  const arm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(leave, 5000);
  };
  const hold = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  useEffect(() => {
    if (ref.current && !prefersReducedMotion()) {
      gsap.fromTo(ref.current, { y: 16, rotation: -1.5, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.42, ease: "paper" });
    }
    arm();
    return hold;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={ref}
      role="status"
      data-world="paper"
      className="paper-fibre"
      onPointerEnter={hold}
      onPointerLeave={arm}
      onFocus={hold}
      onBlur={arm}
      style={{
        width: "min(360px, calc(100vw - 2 * var(--margin)))",
        padding: 16,
        background: "var(--paper-deep)",
        color: "var(--ink)",
        borderRadius: "var(--radius-cut)",
        boxShadow: "var(--d2)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        pointerEvents: "auto",
        transformOrigin: "0% 100%",
      }}
    >
      <Icon name={t.icon ?? "stamp"} size={20} style={{ color: "var(--teal)" }} />
      <span className="type-small" style={{ flex: 1, fontSize: 15 }}>
        {t.text}
      </span>
      {t.action && (
        <button type="button" className="type-label" onClick={t.action.onClick} data-focus-ring="" style={{ color: "var(--ink)", minHeight: 44, paddingInline: 6 }}>
          {t.action.label}
        </button>
      )}
    </div>
  );
}

export function Toaster({ bottom = 20 }: { bottom?: number | string }) {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        left: "var(--margin)",
        bottom,
        zIndex: "var(--z-toast)" as unknown as number,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {list.map((t) => (
        <Slip key={t.id} t={t} />
      ))}
    </div>
  );
}
