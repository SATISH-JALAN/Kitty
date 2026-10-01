import localFont from "next/font/local";

/**
 * Boska: display. Roman + italic are one family so italics are real, not synthesised;
 * both preload with Switzer (3 files, the 15.2 budget). The hero's *secrets* is italic.
 */
export const boska = localFont({
  src: [
    { path: "../../../packages/ui/fonts/Boska-Variable.woff2", weight: "200 900", style: "normal" },
    { path: "../../../packages/ui/fonts/Boska-VariableItalic.woff2", weight: "200 900", style: "italic" },
  ],
  variable: "--font-boska",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});

/** Switzer: UI, body and money. */
export const switzer = localFont({
  src: [{ path: "../../../packages/ui/fonts/Switzer-Variable.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-switzer",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

/** Fragment Mono: ledger lines, ids, counters. Not preloaded. */
export const fragment = localFont({
  src: [
    { path: "../../../packages/ui/fonts/FragmentMono-Latin.woff2", weight: "400", style: "normal" },
  ],
  variable: "--font-fragment",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "monospace"],
});
