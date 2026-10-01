"use client";
/**
 * Text primitives (brief 9): mask-off headline (6), line in a slot (7),
 * mask scramble (10), label roll (14). SplitText runs only after fonts are ready,
 * and only on display / h1 styles (5.3).
 */
import { gsap, SplitText } from "../gsap";
import { prefersReducedMotion } from "../reduced";

export async function fontsReady() {
  if (typeof document === "undefined") return;
  try {
    await document.fonts.ready;
  } catch {
    /* no Font Loading API: carry on */
  }
}

/* ------------------------------ 7 · line in a slot ------------------------------ */

export interface SlotOptions {
  delay?: number;
  stagger?: number;
  duration?: number;
  /** Play in reverse (lines drop back into their slots). */
  out?: boolean;
  paused?: boolean;
}

/**
 * Lines rise out of an overflow-clipped slot: yPercent 105→0, rotate 2°→0, 700 ms paper,
 * 70 ms stagger. A 1 px paper-shadow line sits on each slot's top edge and fades after.
 */
export function lineInSlot(el: HTMLElement, opts: SlotOptions = {}): { tl: gsap.core.Timeline; split: SplitText } {
  // aria "none": lines read naturally; the default puts aria-label on a plain span/p, which is invalid ARIA.
  const split = SplitText.create(el, { type: "lines", mask: "lines", linesClass: "slot-line", autoSplit: false, aria: "none" });
  const tl = gsap.timeline({ paused: opts.paused, delay: opts.delay ?? 0 });
  if (prefersReducedMotion()) {
    tl.set(split.lines, { yPercent: 0, rotate: 0 });
    return { tl, split };
  }
  const masks = (split.masks ?? []) as HTMLElement[];
  masks.forEach((m) => {
    m.style.boxShadow = "inset 0 1px 0 rgba(7,3,12,.18)";
    m.style.paddingBottom = "0.08em";
    m.style.marginBottom = "-0.08em";
  });
  if (opts.out) {
    tl.to(split.lines, { yPercent: 105, rotate: 2, duration: opts.duration ?? 0.5, ease: "fold", stagger: opts.stagger ?? 0.05 });
  } else {
    tl.fromTo(
      split.lines,
      { yPercent: 105, rotate: 2, transformOrigin: "0% 100%" },
      { yPercent: 0, rotate: 0, duration: opts.duration ?? 0.7, ease: "paper", stagger: opts.stagger ?? 0.07 },
    );
    tl.to(masks, { boxShadow: "inset 0 1px 0 rgba(7,3,12,0)", duration: 0.4, ease: "ink" }, "-=0.3");
  }
  return { tl, split };
}

/* ------------------------------ 6 · mask-off headline ------------------------------ */

export interface MaskOffOptions {
  delay?: number;
  /** CSS selector (inside el) of words that keep their strip until released. */
  hold?: string;
  /** Background of the strips: a pattern (CSS background value) or colour. */
  strip?: string;
  paused?: boolean;
}

/**
 * Each word starts under a paper strip (1.05× word width, 0.9 em tall). Strips peel
 * scaleX 1→0 from the right edge with skewX −8° and y −6 px, 520 ms ink, 90 ms apart in
 * reading order. Held words keep theirs until `release()` (hover, focus or a timeout).
 */
export function maskOff(el: HTMLElement, opts: MaskOffOptions = {}) {
  const split = SplitText.create(el, { type: "words", wordsClass: "mo-word", autoSplit: false, aria: "none" });
  const strips: HTMLElement[] = [];
  const held: HTMLElement[] = [];
  const holdSet = new Set(opts.hold ? Array.from(el.querySelectorAll<HTMLElement>(opts.hold)).flatMap((h) => [h, ...Array.from(h.querySelectorAll<HTMLElement>(".mo-word"))]) : []);
  (split.words as HTMLElement[]).forEach((w) => {
    w.style.position = "relative";
    w.style.display = "inline-block";
    const s = document.createElement("span");
    s.className = "mo-strip";
    s.setAttribute("aria-hidden", "true");
    Object.assign(s.style, {
      position: "absolute",
      left: "-2.5%",
      width: "105%",
      top: "0.12em",
      height: "0.9em",
      background: opts.strip ?? "var(--night-raised)",
      transformOrigin: "100% 50%",
      pointerEvents: "none",
      borderRadius: "1px",
      boxShadow: "0 1px 0 rgba(7,3,12,.25)",
    } satisfies Partial<CSSStyleDeclaration>);
    w.appendChild(s);
    const isHeld = holdSet.has(w) || (w.parentElement ? holdSet.has(w.parentElement) : false);
    (isHeld ? held : strips).push(s);
  });
  const peel = { scaleX: 0, skewX: -8, y: -6, duration: 0.52, ease: "ink" } as const;
  const tl = gsap.timeline({ paused: opts.paused, delay: opts.delay ?? 0 });
  if (prefersReducedMotion()) {
    gsap.set([...strips, ...held], { scaleX: 0 });
    return { tl, split, release: () => {}, strips, held };
  }
  tl.to(strips, { ...peel, stagger: 0.09 });
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    gsap.to(held, { ...peel, stagger: 0.09 });
  };
  return { tl, split, release, strips, held };
}

/* ------------------------------ 10 · mask scramble ------------------------------ */

const GLYPHS = "▓▒░◆◇●○";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Cycles through ▓▒░◆◇●○ and mono letters for ~700 ms (every 40 ms per character,
 * settling left to right), then resolves to `target`. The element should start in the
 * mono face; `onResolve` is where callers swap to Boska italic (120 ms crossfade).
 */
export function scramble(el: HTMLElement, target: string, opts: { duration?: number; onResolve?: () => void } = {}) {
  const duration = opts.duration ?? 0.7;
  el.setAttribute("aria-label", target);
  if (prefersReducedMotion()) {
    el.textContent = target;
    opts.onResolve?.();
    return gsap.timeline();
  }
  const state = { p: 0 };
  let last = -1;
  return gsap.to(state, {
    p: 1,
    duration,
    ease: "none",
    onUpdate() {
      const tick = Math.floor((state.p * duration * 1000) / 40);
      if (tick === last) return;
      last = tick;
      const settled = Math.floor(state.p * target.length * 1.15);
      el.textContent = target
        .split("")
        .map((ch, i) => {
          if (ch === " ") return " ";
          if (i < settled) return ch;
          const pool = (tick + i) % 3 === 0 ? LETTERS : GLYPHS;
          return pool[(tick * 7 + i * 13) % pool.length];
        })
        .join("");
    },
    onComplete() {
      el.textContent = target;
      opts.onResolve?.();
    },
  });
}

/* ------------------------------ 14 · label roll ------------------------------ */

/**
 * For elements rendered with <RollLabel>: the label and its duplicate move
 * yPercent 0→−100 over 320 ms paper, characters staggered 12 ms from the first.
 */
export function labelRoll(root: HTMLElement, dir: 1 | -1 = 1) {
  if (prefersReducedMotion()) return gsap.timeline();
  const chars = root.querySelectorAll<HTMLElement>("[data-roll-char]");
  return gsap.to(chars, { yPercent: dir > 0 ? -100 : 0, duration: 0.32, ease: "paper", stagger: 0.012, overwrite: true });
}
