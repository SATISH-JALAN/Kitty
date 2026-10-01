"use client";
/**
 * The landing's reveal signal: fired once when the preloader hands over to the hero
 * (at once for return visits and reduced motion). Work the first screen doesn't need,
 * such as the WebGL sky and the late acts, waits for it so it never competes with the
 * preloader or the hero intro.
 */
export const REVEAL_EVENT = "kitty:reveal";

type RevealWindow = Window & { __kittyRevealed?: boolean };

export function revealed(): boolean {
  return typeof window !== "undefined" && (window as RevealWindow).__kittyRevealed === true;
}

export function announceReveal() {
  (window as RevealWindow).__kittyRevealed = true;
  window.dispatchEvent(new Event(REVEAL_EVENT));
}

/** Runs `fn` once the hero is revealed (now if it already is). Returns a cancel function. */
export function afterReveal(fn: () => void): () => void {
  if (revealed()) {
    fn();
    return () => {};
  }
  window.addEventListener(REVEAL_EVENT, fn, { once: true });
  return () => window.removeEventListener(REVEAL_EVENT, fn);
}
