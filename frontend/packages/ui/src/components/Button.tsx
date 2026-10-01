"use client";
/**
 * Button (brief 7.1). A cut-paper rectangle.
 * Variants: primary · money (teal, with the stitched "ticket you can trust" border) ·
 * ghost · link. States: ink-fill hover from the entry point (13) + raise, press (17),
 * stitched focus ring (20, global), disabled with a reason, busy with the chit fold
 * loader (18). `magnetic` (19) is for landing L buttons only.
 */
import Link from "next/link";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { gsap } from "../motion/gsap";
import { withMorph } from "../motion/morph";
import { magnetic as magneticPull, pressHandlers } from "../motion/primitives/physical";
import { prefersReducedMotion } from "../motion/reduced";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "money" | "ghost";
export type ButtonSize = "S" | "M" | "L";

export interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  type?: "button" | "submit";
  icon?: IconName;
  iconEnd?: IconName;
  /** Full width (mobile main actions only). */
  block?: boolean;
  disabled?: boolean;
  /** Shown under a disabled button, and read by screen readers. */
  disabledReason?: string;
  busy?: boolean;
  /** Flash the stamped tick when a busy action succeeds. */
  done?: boolean;
  magnetic?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-label"?: string;
  "aria-describedby"?: string;
  external?: boolean;
  prefetch?: boolean;
}

const SIZES: Record<ButtonSize, { h: number; px: number; fs: number; icon: number; ls?: string }> = {
  S: { h: 36, px: 14, fs: 14, icon: 16 },
  M: { h: 44, px: 20, fs: 15, icon: 20 },
  L: { h: 56, px: 28, fs: 16, icon: 20, ls: "0.01em" },
};

/** Chit fold loader (18): a 20×14 chit folding and unfolding; a stamped tick when done. */
function ChitLoader({ done }: { done: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const right = el.querySelector(".chit-r");
    if (prefersReducedMotion()) return;
    const tl = gsap.timeline({ repeat: -1 });
    tl.to(right, { rotationY: -180, transformOrigin: "0% 50%", duration: 0.6, ease: "fold" }).to(right, {
      rotationY: 0,
      duration: 0.6,
      ease: "fold",
    });
    return () => {
      tl.kill();
    };
  }, []);
  return (
    <svg ref={ref} width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" style={{ perspective: 60, overflow: "visible" }}>
      {done ? (
        <g>
          <circle cx="11" cy="8" r="8" fill="currentColor" opacity=".9" />
          <path d="M7 8.2l2.6 2.6L15 5.6" fill="none" stroke="var(--btn-bg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : (
        <g>
          <rect x="1" y="1" width="10" height="14" rx=".6" fill="currentColor" />
          <rect className="chit-r" x="11" y="1" width="10" height="14" rx=".6" fill="currentColor" opacity=".72" style={{ transformBox: "fill-box" }} />
        </g>
      )}
    </svg>
  );
}

export const Button = forwardRef<HTMLElement, ButtonProps>(function Button(
  {
    children,
    variant = "primary",
    size = "M",
    href,
    onClick,
    type = "button",
    icon,
    iconEnd,
    block,
    disabled,
    disabledReason,
    busy,
    done,
    magnetic,
    className = "",
    style,
    external,
    prefetch,
    ...aria
  },
  fwd,
) {
  const ref = useRef<HTMLElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [lockedWidth, setLockedWidth] = useState<number | null>(null);
  useImperativeHandle(fwd, () => ref.current as HTMLElement);
  const s = SIZES[size];
  const inactive = disabled || busy;

  useEffect(() => {
    if (!magnetic || !ref.current) return;
    return magneticPull(ref.current, labelRef.current);
  }, [magnetic]);

  // Busy locks the current width so the label swap never reflows the row.
  useEffect(() => {
    if (busy && ref.current) setLockedWidth(ref.current.getBoundingClientRect().width);
    if (!busy && !done) setLockedWidth(null);
  }, [busy, done]);

  const point = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const enter = (e: React.PointerEvent<HTMLElement>) => {
    if (inactive || prefersReducedMotion() || e.pointerType === "touch" || !fillRef.current) return;
    const { x, y } = point(e);
    gsap.fromTo(
      fillRef.current,
      { clipPath: `circle(0% at ${x}px ${y}px)` },
      { clipPath: `circle(140% at ${x}px ${y}px)`, duration: 0.42, ease: "ink", overwrite: true },
    );
    gsap.to(e.currentTarget, { y: -2, boxShadow: "var(--d2)", duration: 0.2, ease: "paper", overwrite: "auto" });
  };
  const leave = (e: React.PointerEvent<HTMLElement>) => {
    if (!fillRef.current) return;
    const { x, y } = point(e);
    gsap.to(fillRef.current, { clipPath: `circle(0% at ${x}px ${y}px)`, duration: 0.32, ease: "ink", overwrite: true });
    gsap.to(e.currentTarget, { y: 0, boxShadow: variant === "ghost" ? "none" : "var(--d1)", duration: 0.2, ease: "paper", overwrite: "auto" });
  };
  const press = pressHandlers(2);

  const content = (
    <>
      <span className="btn-label" ref={labelRef} style={{ opacity: busy || done ? 0 : 1 }}>
        {icon && <Icon name={icon} size={s.icon} />}
        <span>{children}</span>
        {iconEnd && <Icon name={iconEnd} size={s.icon} />}
      </span>
      <span ref={fillRef} className="btn-fill" aria-hidden="true">
        <span className="btn-label">
          {icon && <Icon name={icon} size={s.icon} />}
          <span>{children}</span>
          {iconEnd && <Icon name={iconEnd} size={s.icon} />}
        </span>
      </span>
      {(busy || done) && (
        <span className="btn-busy" aria-hidden="true">
          <ChitLoader done={!!done} />
        </span>
      )}
      <span className="sr-only" aria-live="polite">
        {busy ? "Working…" : ""}
      </span>
    </>
  );

  const common = {
    ref: ref as React.Ref<HTMLAnchorElement & HTMLButtonElement>,
    className: `btn btn-${variant} ${block ? "btn-block" : ""} ${className}`,
    "data-size": size,
    "data-focus-ring": "",
    "aria-disabled": inactive || undefined,
    "aria-busy": busy || undefined,
    style: {
      height: s.h,
      paddingInline: s.px,
      fontSize: s.fs,
      letterSpacing: s.ls,
      width: lockedWidth ?? undefined,
      ...style,
    } as React.CSSProperties,
    onPointerEnter: enter,
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
      leave(e);
      press.onPointerLeave(e);
    },
    onPointerDown: inactive ? undefined : press.onPointerDown,
    onPointerUp: press.onPointerUp,
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      if (inactive) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
    ...aria,
  };

  const el =
    href && !inactive ? (
      external ? (
        <a href={href} target="_blank" rel="noreferrer" {...common}>
          {content}
        </a>
      ) : (
        <Link href={href} prefetch={prefetch} {...common}>
          {content}
        </Link>
      )
    ) : (
      <button type={type} {...common}>
        {content}
      </button>
    );

  if (disabled && disabledReason) {
    return (
      <span className="inline-flex flex-col items-start gap-2" style={{ width: block ? "100%" : undefined }}>
        {el}
        <span className="type-small" style={{ color: "var(--fg-soft)" }}>
          {disabledReason}
        </span>
      </span>
    );
  }
  return el;
});

/** Text link with the stitched underline (16: drawn from the left, exits right) and, when it navigates, the dot-to-arrow (15). */
export function TextLink({
  href,
  children,
  arrow = true,
  onClick,
  className = "",
  external,
}: {
  href: string;
  children: ReactNode;
  arrow?: boolean;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  className?: string;
  external?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const over = () => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    gsap.fromTo(el.querySelector(".tl-stitch"), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.36, ease: "ink", overwrite: true });
    const dot = el.querySelector(".tl-dot");
    if (dot) withMorph(() => gsap.to(dot, { morphSVG: el.querySelector(".tl-arrow-shape") as SVGPathElement, x: 4, duration: 0.28, ease: "paper", overwrite: true }));
  };
  const out = () => {
    const el = ref.current;
    if (!el) return;
    gsap.to(el.querySelector(".tl-stitch"), { clipPath: "inset(0 0 0 100%)", duration: 0.36, ease: "ink", overwrite: true });
    const dot = el.querySelector(".tl-dot");
    if (dot) withMorph(() => gsap.to(dot, { morphSVG: dot.getAttribute("data-d") ?? "", x: 0, duration: 0.28, ease: "paper", overwrite: true }));
  };
  const inner = (
    <>
      <span className="relative">
        {children}
        <span className="tl-base" aria-hidden="true" />
        <span className="tl-stitch" aria-hidden="true" />
      </span>
      {arrow && (
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true" style={{ overflow: "visible" }}>
          <path className="tl-arrow-shape" d="M1,5 H10 V2 L16,6 L10,10 V7 H1 Z" style={{ display: "none" }} />
          <path className="tl-dot" data-d="M3,6 A3,3 0 1 1 9,6 A3,3 0 1 1 3,6 Z" d="M3,6 A3,3 0 1 1 9,6 A3,3 0 1 1 3,6 Z" fill="currentColor" />
        </svg>
      )}
    </>
  );
  const cls = `text-link ${className}`;
  return external ? (
    <a ref={ref} href={href} target="_blank" rel="noreferrer" className={cls} onPointerEnter={over} onPointerLeave={out} onFocus={over} onBlur={out} data-focus-ring="">
      {inner}
    </a>
  ) : (
    <Link ref={ref} href={href} className={cls} onClick={onClick} onPointerEnter={over} onPointerLeave={out} onFocus={over} onBlur={out} data-focus-ring="">
      {inner}
    </Link>
  );
}
