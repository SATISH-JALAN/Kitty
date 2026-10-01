"use client";
/**
 * The Party Diary booklet (brief 2.1, 7.23): a cloth cover (B-1) with a gold-foil title
 * and the Bow Mask, and spreads of cream pages with a perforated left edge. Turning is the
 * page turn (primitive 5): a leaf rotates 180° about the spine (perspective 2200px,
 * 720 ms fold) while a shadow sweeps the page beneath; its back face is the next page.
 * On phones it shows one page at a time and turns page by page.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { gsap } from "@kitty/ui/motion/gsap";
import { prefersReducedMotion } from "@kitty/ui/motion/reduced";
import { BowGlyph } from "@kitty/ui/brand/BowMask";
import { Art } from "@/components/Art";

export function DiaryPage({ children, n, perforated = "left", style, className }: { children?: ReactNode; n?: number; perforated?: "left" | "right" | "none"; style?: CSSProperties; className?: string }) {
  return (
    <div className={`diary-page paper-fibre ${className ?? ""}`} data-perf={perforated} data-world="paper" style={style}>
      <div className="diary-page-frame" aria-hidden="true" />
      <div className="diary-page-body">{children}</div>
      {n != null && (
        <span className="type-mono diary-page-n" aria-hidden="true">
          {n}
        </span>
      )}
    </div>
  );
}

export function BookletCover({ title = "Party Diary" }: { title?: string }) {
  return (
    <div className="booklet-cover">
      <Art id="B-1" fit="cover" sizes="400px" world="night" />
      <div className="booklet-cover-foil">
        <svg viewBox="0 0 240 140" width="96" height="56" aria-hidden="true" style={{ overflow: "visible" }}>
          <BowGlyph idBase="cover-bow" tone="mono" colour="#D9B561" />
        </svg>
        <span className="booklet-cover-title">{title}</span>
      </div>
    </div>
  );
}

export interface BookletHandle {
  turn: (to: number) => Promise<void>;
}

export const Booklet = forwardRef<BookletHandle, { pages: ReactNode[]; spread: number; single?: boolean; className?: string; style?: CSSProperties; onTurned?: (s: number) => void }>(function Booklet(
  { pages, spread, single = false, className, style, onTurned },
  ref,
) {
  const [shown, setShown] = useState(spread);
  const [leaf, setLeaf] = useState<{ from: number; to: number } | null>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const shade = useRef<HTMLDivElement>(null);
  const per = single ? 1 : 2;
  const spreads = Math.ceil(pages.length / per);
  const pageAt = (s: number, side: 0 | 1) => pages[s * per + side] ?? null;

  const turn = (to: number) =>
    new Promise<void>((resolve) => {
      if (to === shown || to < 0 || to >= spreads) return resolve();
      if (prefersReducedMotion()) {
        setShown(to);
        onTurned?.(to);
        return resolve();
      }
      setLeaf({ from: shown, to });
      requestAnimationFrame(() => {
        const el = leafRef.current;
        if (!el) return resolve();
        const forward = to > shown;
        gsap.fromTo(el, { rotationY: 0 }, { rotationY: forward ? -180 : 180, duration: 0.72, ease: "fold", transformPerspective: 2200 });
        if (shade.current) gsap.fromTo(shade.current, { opacity: 0.5, xPercent: forward ? 0 : 0 }, { opacity: 0, duration: 0.72, ease: "fold" });
        gsap.delayedCall(0.72, () => {
          setShown(to);
          setLeaf(null);
          onTurned?.(to);
          resolve();
        });
      });
    });

  useImperativeHandle(ref, () => ({ turn }));
  useEffect(() => {
    if (spread !== shown && !leaf) turn(spread);
  }, [spread]); // eslint-disable-line react-hooks/exhaustive-deps

  const forward = leaf ? leaf.to > leaf.from : true;
  // While turning forward: left stays old-left, right shows new-right beneath the leaf.
  const left = single ? null : leaf ? (forward ? pageAt(leaf.from, 0) : pageAt(leaf.to, 0)) : pageAt(shown, 0);
  const right = single ? (leaf ? pageAt(leaf.to, 0) : pageAt(shown, 0)) : leaf ? (forward ? pageAt(leaf.to, 1) : pageAt(leaf.from, 1)) : pageAt(shown, 1);

  return (
    <div className={`booklet ${single ? "is-single" : ""} ${className ?? ""}`} style={style}>
      {!single && <div className="booklet-side booklet-left">{left}</div>}
      <div className="booklet-side booklet-right">
        {right}
        <div ref={shade} className="booklet-shade" aria-hidden="true" />
      </div>
      {leaf && (
        <div
          ref={leafRef}
          className="booklet-leaf"
          aria-hidden="true"
          style={{
            left: single ? 0 : forward ? "50%" : 0,
            width: single ? "100%" : "50%",
            transformOrigin: single ? "0% 50%" : forward ? "0% 50%" : "100% 50%",
          }}
        >
          <div className="leaf-face">{single ? pageAt(leaf.from, 0) : forward ? pageAt(leaf.from, 1) : pageAt(leaf.from, 0)}</div>
          <div className="leaf-face leaf-back">{single ? null : forward ? pageAt(leaf.to, 0) : pageAt(leaf.to, 1)}</div>
        </div>
      )}
    </div>
  );
});
