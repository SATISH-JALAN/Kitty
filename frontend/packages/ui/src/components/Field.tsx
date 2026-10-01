"use client";
/**
 * Text field (brief 7.5): a paper slip, 52 px, label above. Focus lightens it, raises it
 * to d1 and draws a 2 px stitched underline from the left (primitive 27). Errors wobble
 * the crease and slide the kind helper line in from its slot. The amount variant uses
 * money-l, a fixed $ at 0.62em and tabular numbers.
 */
import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";
import { gsap } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { Icon } from "./Icon";

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  helper?: ReactNode;
  error?: string | null;
  amount?: boolean;
  /** Visually hide the label (it stays for screen readers). */
  hideLabel?: boolean;
  suffix?: ReactNode;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, helper, error, amount, hideLabel, suffix, className, style, ...input }, fwd) {
  const id = useId();
  const slip = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  const help = useRef<HTMLSpanElement>(null);
  const prevError = useRef<string | null | undefined>(null);

  useEffect(() => {
    if (!error || error === prevError.current) {
      prevError.current = error;
      return;
    }
    prevError.current = error;
    if (prefersReducedMotion() || !slip.current) return;
    gsap.fromTo(slip.current, { skewX: 0 }, { keyframes: { skewX: [0, 2, -1.5, 0] }, duration: 0.36, ease: "none" });
    if (help.current) gsap.fromTo(help.current, { yPercent: 105, rotate: 2 }, { yPercent: 0, rotate: 0, duration: 0.5, ease: "paper" });
  }, [error]);

  const focus = () => {
    if (!slip.current) return;
    slip.current.dataset.focused = "true";
    if (line.current) gsap.fromTo(line.current, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: prefersReducedMotion() ? 0 : 0.24, ease: "ink" });
  };
  const blur = () => {
    if (!slip.current) return;
    delete slip.current.dataset.focused;
    if (line.current) gsap.to(line.current, { clipPath: "inset(0 100% 0 0)", duration: 0.2, ease: "ink" });
  };

  const describedBy = error || helper ? `${id}-help` : undefined;
  return (
    <div className={`field ${className ?? ""}`} style={{ display: "flex", flexDirection: "column", gap: 8, ...style }}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : "type-small"} style={{ fontWeight: 500, color: "var(--fg-soft)" }}>
        {label}
      </label>
      <div ref={slip} className="field-slip" data-invalid={error ? "true" : undefined}>
        {amount && (
          <span className="type-money-l" aria-hidden="true" style={{ fontSize: "0.62em", alignSelf: "flex-start", marginTop: 13, marginRight: 2 }}>
            $
          </span>
        )}
        <input
          {...input}
          ref={fwd}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          inputMode={amount ? "decimal" : input.inputMode}
          className={amount ? "type-money-l" : "type-body"}
          onFocus={(e) => {
            focus();
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            blur();
            input.onBlur?.(e);
          }}
          style={{ fontSize: amount ? undefined : 17 }}
          data-no-ring=""
        />
        {suffix}
        <span ref={line} className="field-line" aria-hidden="true" />
      </div>
      {(error || helper) && (
        <span style={{ overflow: "clip", display: "block" }}>
          <span ref={help} id={`${id}-help`} className="type-small" style={{ display: "inline-flex", gap: 6, alignItems: "center", color: error ? "var(--error)" : "var(--fg-soft)" }}>
            {error && <Icon name="tag" size={16} />}
            {error ?? helper}
          </span>
        </span>
      )}
    </div>
  );
});

/**
 * Toggle (brief 7.4): a 44×24 track (the only pill), with a 20 px wax-seal knob that slides
 * 20 px (320 ms paper) and flattens as it lands (scaleX 1.12 → 1, 120 ms).
 */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  const knob = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (!knob.current) return;
    if (first.current || prefersReducedMotion()) {
      gsap.set(knob.current, { x: checked ? 20 : 0 });
      first.current = false;
      return;
    }
    gsap.timeline().to(knob.current, { x: checked ? 20 : 0, duration: 0.32, ease: "paper" }).fromTo(knob.current, { scaleX: 1.12 }, { scaleX: 1, duration: 0.12, ease: "paper" });
  }, [checked]);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && onChange(!checked)}
      data-focus-ring=""
      style={{
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? "var(--plum)" : "var(--paper-deep)",
        boxShadow: "inset 0 1px 2px rgba(34,21,31,.18)",
        transition: "background var(--t-m) var(--ease-paper)",
        opacity: disabled ? 0.4 : 1,
        flex: "none",
      }}
    >
      <span aria-hidden="true" style={{ position: "absolute", inset: "-10px 0" }} />
      <span
        ref={knob}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 2,
          top: 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: checked ? "radial-gradient(circle at 35% 30%, #A33A5A, #7A1F3D 55%, #4A0F24)" : "radial-gradient(circle at 35% 30%, #DCC19C, #C9A57A 55%, #A9845A)",
          boxShadow: "0 1px 2px rgba(7,3,12,.35)",
          transition: "background var(--t-m) var(--ease-paper)",
        }}
      />
    </button>
  );
}
