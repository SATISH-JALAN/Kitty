/**
 * Can this device run the lantern sky (brief 15.4)? Kept apart from LanternSky.ts so the
 * check costs nothing: the three.js chunk is only fetched when the answer is yes.
 */
export function skySupported(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; hardwareConcurrency?: number };
  if ((nav.hardwareConcurrency ?? 8) <= 4) return false;
  if (nav.connection?.saveData) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}
