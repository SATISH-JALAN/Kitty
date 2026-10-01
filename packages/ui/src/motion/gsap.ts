"use client";
/**
 * One place that registers GSAP plugins and the six custom eases (brief 8.1, 8.2).
 * Import gsap and plugins from here, never from "gsap" directly, so registration
 * always happens first. Plugins only a few screens use live in their own modules so
 * other routes don't ship them: Flip (./flip), MotionPath (./motionPath), and
 * MorphSVG (./morph, fetched on idle).
 */
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

// Next inlines `process.env.NODE_ENV` at build time; this package has no node types.
declare const process: { env: { NODE_ENV?: string } };

let registered = false;

export function registerMotion() {
  if (registered || typeof window === "undefined") return;
  registered = true;
  gsap.registerPlugin(
    useGSAP,
    ScrollTrigger,
    SplitText,
    DrawSVGPlugin,
    CustomEase,
    Observer,
  );
  CustomEase.create("paper", "M0,0 C0.22,0.9 0.3,1 1,1");
  CustomEase.create("fold", "M0,0 C0.65,0 0.35,1 1,1");
  // Brief 8.2 lists "… 0.8,1 0.9,0.97 1,1", an incomplete cubic; the second segment gets its missing control point.
  CustomEase.create("stamp", "M0,0 C0.5,0 0.6,1.25 0.8,1 C0.86,0.97 0.93,0.985 1,1");
  CustomEase.create("ink", "M0,0 C0.4,0 0.2,1 1,1");
  CustomEase.create("lantern", "M0,0 C0.3,0 0.7,1 1,1");
  CustomEase.create("camera", "M0,0 C0.45,0 0.15,1 1,1");
  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: "paper" });
  // Dev-only handle for the review tooling.
  if (process.env.NODE_ENV !== "production") (window as unknown as { __gsap?: unknown }).__gsap = { gsap, ScrollTrigger };
}

registerMotion();

/**
 * Damped swing for hanging objects (lanterns, tags): amp·e^(−t/τ)·sin(2π·f·t).
 * Returns an ease-like function over normalised time for a tween of `duration` s.
 * The tween animates 0 → 1 and this maps progress to rotation in degrees.
 */
export function dampedSwing(amp: number, duration: number, tau = 0.35, freq = 1.6, fromAmp = false) {
  const wave = fromAmp ? Math.cos : Math.sin;
  return (p: number) => amp * Math.exp(-(p * duration) / tau) * wave(2 * Math.PI * freq * p * duration);
}

/** Tween a rotation as a damped swing (brief 8.2: never `elastic`). `fromAmp` starts at full swing (released), otherwise at rest (pushed). */
export function swing(target: gsap.TweenTarget, amp = 6, duration = 1.4, opts: { tau?: number; freq?: number; delay?: number; fromAmp?: boolean } = {}) {
  const f = dampedSwing(amp, duration, opts.tau, opts.freq, opts.fromAmp);
  const state = { p: 0 };
  return gsap.to(state, {
    p: 1,
    duration,
    delay: opts.delay ?? 0,
    ease: "none",
    onUpdate: () => {
      gsap.set(target, { rotation: f(state.p) });
    },
    onComplete: () => {
      gsap.set(target, { rotation: 0 });
    },
  });
}

export { gsap, ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase, Observer, useGSAP };
