"use client";
/**
 * Mask generator (brief 6.2). Deterministic from a party tag: colour, animal and the
 * party's tradition pattern. viewBox 0 0 240 150 (drawn with 4 px headroom for ears):
 *   1 back silhouette (offset 3,4, 22% darker, #cut) · 2 mid silhouette · 3 tradition
 *   pattern clipped to it (tone-on-tone block print, multiply 55%) · layered paper
 *   pieces, each casting a small shadow · 4 gold trim inset 6 px · 5 eye holes cut
 *   through everything · 6 twine ties.
 * Silhouettes were drawn against docs/ref/R-1-masks.png: the animal is the outline.
 */
import { memo, useId, useMemo, useRef, type CSSProperties } from "react";
import { identityFromIndices, MASK_ANIMALS, partyName, type MaskAnimal, type TraditionKey } from "@kitty/sdk";
import { gsap, useGSAP } from "../motion/gsap";
import { prefersReducedMotion } from "../motion/reduced";
import { luminance, shade } from "./colour";
import { PatternDef } from "./patterns";

/* ------------------------------- geometry ------------------------------- */

const mirrorX = (d: string) => d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x: string, y: string) => `${+(240 - +x).toFixed(2)},${y}`);
const both = (d: string) => `${d} ${mirrorX(d)}`;
/** Absolute circle (radii written with spaces so mirrorX leaves them alone), on both sides. */
const circ = (cx: number, cy: number, r: number) => `M${cx - r},${cy} A${r} ${r} 0 1 0 ${cx + r},${cy} A${r} ${r} 0 1 0 ${cx - r},${cy} Z`;
const circs = (cx: number, cy: number, r: number) => `${circ(cx, cy, r)} ${circ(240 - cx, cy, r)}`;
/** Upper half-disc (a fish scale), both sides. */
const scale = (cx: number, cy: number, r: number) => [cx, 240 - cx].map((x) => `M${x - r},${cy} A${r} ${r} 0 0 1 ${x + r},${cy} Z`).join(" ");

/** The shared face: brow peak, cheeks, nose bridge. Symmetric about x = 120. */
const FACE =
  "M120,50 C140,38 172,33 198,40 C214,44 226,54 226,70 C226,90 212,108 190,114 C170,120 148,114 136,104 C130,99 124,98 120,101 " +
  "C116,98 110,99 104,104 C92,114 70,120 50,114 C28,108 14,90 14,70 C14,54 26,44 42,40 C68,33 100,38 120,50 Z";

const EYES = [
  "M58,73 C66,60.5 88,59 97,70 C88,81.5 67,83.5 58,73 Z",
  "M182,73 C174,60.5 152,59 143,70 C152,81.5 173,83.5 182,73 Z",
];

/** Brow band: the second paper layer that frames the eyes. */
const BROW = both("M44,66 C52,48 84,40 108,56 C92,52 72,54 58,68 C54,72 48,72 44,66 Z");

/** Gold filigree: punched dots along the brow and a leaf at the forehead. */
const DOTS: [number, number][] = [];
for (let i = 0; i < 7; i++) {
  const t = i / 6;
  const x = 50 + t * 52;
  const y = 60 - Math.sin(t * Math.PI) * 13 + t * 2;
  DOTS.push([x, y], [240 - x, y]);
}
const LEAF = "M120,57 C125,62 125,70 120,75 C115,70 115,62 120,57 Z";

type Tone = "mask" | "light" | "dark" | "gold" | "beak" | "crimson" | "cream";

interface Feature {
  /** Silhouette additions in the mask colour (they get the back layer and pattern too). */
  body?: string;
  /** Layered paper pieces drawn in order, each with a soft shadow. */
  layers?: [string, Tone][];
  /** Open strokes: [path, width, tone]. */
  strokes?: [string, number, Tone][];
}

function fan(n: number, spread: number, len: number, width: number, cx = 120, cy = 50): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((-spread / 2 + (spread * i) / (n - 1)) * Math.PI) / 180;
    const tx = cx + Math.sin(a) * len;
    const ty = cy - Math.cos(a) * len;
    const nx = Math.cos(a) * width;
    const ny = Math.sin(a) * width;
    const mx = cx + Math.sin(a) * len * 0.62;
    const my = cy - Math.cos(a) * len * 0.62;
    out.push(
      `M${(cx + nx * 0.25).toFixed(1)},${(cy + ny * 0.25).toFixed(1)} Q${(mx + nx * 1.6).toFixed(1)},${(my + ny * 1.6).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)} Q${(mx - nx * 1.6).toFixed(1)},${(my - ny * 1.6).toFixed(1)} ${(cx - nx * 0.25).toFixed(1)},${(cy - ny * 0.25).toFixed(1)} Z`,
    );
  }
  return out;
}

const peacockFeathers = fan(7, 96, 58, 7, 120, 52);
const peacockEyes = peacockFeathers.map((_, i) => {
  const a = ((-48 + 16 * i) * Math.PI) / 180;
  const x = 120 + Math.sin(a) * 50;
  const y = 52 - Math.cos(a) * 50;
  return [x, y] as [number, number];
});

const FEATURES: Record<MaskAnimal, Feature> = {
  Parrot: {
    body:
      both("M86,44 C80,30 82,18 90,8 C94,22 100,34 106,46 Z M100,46 C98,28 104,14 114,4 C114,20 116,34 120,46 Z") +
      " M112,46 C114,28 118,14 120,2 C122,14 126,28 128,46 Z",
    layers: [
      [both("M92,40 C88,30 90,22 94,16 C97,26 100,34 104,42 Z M106,40 C106,28 110,18 115,11 C115,22 116,32 118,42 Z"), "light"],
      [both("M22,86 C34,100 50,106 68,104 C58,110 44,112 34,108 C24,102 20,94 22,86 Z M34,92 C44,100 56,102 70,100"), "light"],
      ["M102,93 C102,112 110,131 126,143 C135,128 138,110 138,93 C127,86 112,86 102,93 Z", "beak"],
      ["M110,96 C112,112 118,126 127,135 C125,120 124,106 124,95 Z", "dark"],
    ],
  },
  Heron: {
    body: "M118,48 C104,24 76,8 34,0 C62,14 88,30 106,52 Z M124,46 C114,26 94,10 64,0 C88,14 106,30 116,50 Z",
    layers: [
      ["M116,46 C102,26 80,12 48,4 C74,16 94,30 108,50 Z", "dark"],
      ["M110,96 L120,150 L130,96 C124,92 116,92 110,96 Z", "beak"],
      ["M116,98 L120,140 L122,97 Z", "dark"],
    ],
    strokes: [["M112,44 C98,26 76,12 44,4", 1, "gold"]],
  },
  Owl: {
    body: both("M26,52 C18,32 24,12 42,0 C44,18 54,32 76,40 Z"),
    layers: [
      [both("M34,46 C30,32 34,18 44,10 C46,24 54,34 70,40 Z"), "light"],
      [both("M77,46 C99,46 112,60 112,76 C112,93 97,104 77,104 C57,104 42,93 42,76 C42,60 55,46 77,46 Z"), "light"],
      ["M84,40 L120,70 L156,40 C140,46 128,54 120,62 C112,54 100,46 84,40 Z", "dark"],
      ["M112,94 L120,114 L128,94 C124,91 116,91 112,94 Z", "beak"],
    ],
  },
  Fox: {
    body: both("M20,58 L30,-2 L92,40 Z") + " M90,104 C102,118 113,130 120,138 C127,130 138,118 150,104 C136,97 104,97 90,104 Z",
    layers: [
      [both("M32,50 L36,12 L76,40 Z"), "dark"],
      [both("M18,82 C26,100 46,114 72,116 C84,118 96,112 104,104 C92,106 70,106 52,100 C36,94 24,88 18,82 Z"), "cream"],
      ["M113,128 C116,134 118,138 120,139 C122,138 124,134 127,128 C122,125 118,125 113,128 Z", "dark"],
    ],
  },
  Tiger: {
    body: both("M34,48 C30,32 40,20 56,22 C58,32 54,40 48,50 Z"),
    layers: [
      [both("M40,44 C38,34 44,28 52,28 C52,34 50,40 46,46 Z"), "cream"],
      ["M94,100 C102,118 111,126 120,126 C129,126 138,118 146,100 C132,94 108,94 94,100 Z", "cream"],
      [
        "M110,40 C113,48 117,54 120,64 C123,54 127,48 130,40 C124,44 116,44 110,40 Z " +
          both("M84,38 C88,46 90,52 88,60 C94,54 97,46 97,40 Z M16,58 C26,60 34,64 40,72 C36,62 30,56 22,52 Z M22,90 C32,90 40,94 46,100 C40,90 34,86 26,86 Z M190,110 C184,104 176,100 168,100 C176,106 180,112 182,116 Z"),
        "dark",
      ],
      ["M113,104 C116,109 118,111 120,111 C122,111 124,109 127,104 C122,101 118,101 113,104 Z", "dark"],
    ],
  },
  Peacock: {
    body: peacockFeathers.join(" "),
    layers: [
      [fan(7, 96, 44, 4, 120, 52).join(" "), "light"],
      ...peacockEyes.map(([x, y]) => [`M${x.toFixed(1)},${(y - 7).toFixed(1)} a5.5,7 0 1 0 0.01,0 Z`, "gold"] as [string, Tone]),
      ...peacockEyes.map(([x, y]) => [`M${x.toFixed(1)},${(y - 4).toFixed(1)} a3,4 0 1 0 0.01,0 Z`, "dark"] as [string, Tone]),
      ["M112,96 L120,112 L128,96 C124,93 116,93 112,96 Z", "beak"],
    ],
  },
  Hare: {
    body: both("M86,46 C70,26 68,2 82,-4 C100,-2 108,22 106,44 Z"),
    layers: [
      [both("M89,40 C78,24 77,8 85,2 C96,4 101,22 100,38 Z"), "cream"],
      [both("M22,84 C30,100 50,112 76,114 C62,106 44,98 30,82 Z"), "light"],
      ["M114,101 C117,105 119,107 120,107 C121,107 123,105 126,101 C122,98 118,98 114,101 Z", "crimson"],
    ],
    strokes: [[both("M104,108 C92,111 80,111 70,107 M104,110 C94,115 84,117 74,116"), 1, "dark"]],
  },
  Crane: {
    body: "M110,48 C108,36 112,26 120,20 C128,26 132,36 130,48 Z",
    layers: [
      ["M112,44 C112,34 116,28 120,24 C124,28 128,34 128,44 Z", "crimson"],
      ["M110,96 L120,150 L130,96 C124,92 116,92 110,96 Z", "beak"],
      [both("M22,84 C34,100 52,110 76,112 C60,104 44,96 32,82 Z"), "light"],
    ],
    strokes: [
      ["M114,22 L108,6 M120,20 L120,2 M126,22 L132,6", 1.6, "dark"],
      [both("M46,58 C60,50 80,50 98,58"), 1.2, "gold"],
    ],
  },
  Lynx: {
    body: both("M32,52 L46,6 L84,38 Z M12,86 L2,102 L20,104 L12,118 L32,114 L34,126 L52,116 C36,112 22,102 12,86 Z"),
    layers: [
      [both("M42,44 L48,18 L70,38 Z"), "cream"],
      [both("M16,92 L10,102 L24,104 L18,114 L34,111 L36,120 L50,114 C36,110 24,102 16,92 Z"), "light"],
      ["M114,101 C117,106 119,108 120,108 C121,108 123,106 126,101 C122,98 118,98 114,101 Z", "dark"],
    ],
    strokes: [[both("M46,6 L48,-6"), 2, "dark"], [both("M26,64 C34,60 42,60 50,62"), 1.2, "dark"]],
  },
  Moth: {
    body: both("M34,54 C12,42 4,22 18,8 C38,2 70,18 100,46 Z M18,98 C4,112 8,132 28,138 C48,140 72,124 90,108 Z"),
    layers: [
      [both("M36,48 C20,38 14,24 24,14 C40,12 62,24 84,42 Z"), "light"],
      [both("M22,104 C14,114 18,128 32,130 C48,130 64,120 78,108 Z"), "light"],
      [`${circs(40, 30, 6)} ${circs(36, 120, 5)}`, "gold"],
      [circs(40, 31, 3), "dark"],
    ],
    strokes: [[both("M112,46 C104,30 94,16 80,8 C72,4 66,8 70,13 C74,16 79,13 78,9"), 2.2, "dark"]],
  },
  Stag: {
    body: both("M28,58 C16,52 6,44 4,34 C18,34 32,40 42,48 Z"),
    layers: [
      [both("M26,54 C18,50 12,44 10,38 C20,38 30,42 36,48 Z"), "cream"],
      [both("M22,84 C32,100 52,110 78,112 C60,104 42,96 30,82 Z"), "cream"],
      ["M113,101 C116,106 118,108 120,108 C122,108 124,106 127,101 C122,98 118,98 113,101 Z", "dark"],
    ],
    strokes: [[both("M98,46 C92,30 84,16 70,4 M88,30 C80,26 70,26 60,30 M80,18 C80,10 84,4 92,-2 M74,10 C66,8 58,10 52,14"), 5, "dark"]],
  },
  Koi: {
    body:
      "M100,46 C104,26 116,12 134,6 C130,22 132,36 140,48 Z " +
      both("M16,58 C0,48 -4,30 4,16 C16,30 26,44 34,54 Z M16,88 C0,96 -4,114 4,128 C16,114 26,102 34,92 Z"),
    layers: [
      ["M106,44 C110,30 118,20 130,14 C128,26 130,36 136,46 Z", "light"],
      [both("M18,54 C8,46 4,34 8,24 C16,34 24,44 30,52 Z M18,90 C8,98 4,110 8,120 C16,110 24,102 30,94 Z"), "light"],
      [`${scale(92, 46, 8)} ${scale(104, 40, 8)} ${scale(78, 50, 8)}`, "gold"],
    ],
  },
};

/* -------------------------------- render -------------------------------- */

export interface MaskProps {
  /** Party tag bytes; or pass `colour`/`animal` indices directly. */
  tag?: Uint8Array;
  colour?: number;
  animal?: number;
  tradition?: TraditionKey;
  width?: number;
  /** Hover tilt toward the cursor (brief 6.2). */
  tilt?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export const MASK_SIZES = { xs: 32, s: 48, m: 72, l: 160, xl: 320 } as const;

export const Mask = memo(function Mask({ tag, colour, animal, tradition = "kitty", width = 72, tilt = false, className, style, title }: MaskProps) {
  const uid = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);
  const id = useMemo(() => (tag ? partyName(tag) : identityFromIndices(colour ?? 0, animal ?? 0)), [tag, colour, animal]);
  const feat = FEATURES[MASK_ANIMALS[id.animal]];
  const base = id.hex;
  const isLight = luminance(base) > 0.66;
  const tones: Record<Tone, string> = {
    mask: base,
    light: isLight ? shade(base, -0.14) : shade(base, 0.3),
    dark: shade(base, isLight ? -0.55 : -0.45),
    gold: "#C8A04A",
    beak: isLight ? "#C28A2C" : "#E9A21E",
    crimson: "#A8352A",
    cream: isLight ? shade(base, -0.08) : "#EFE3C8",
  };
  const silhouette = `${FACE} ${feat.body ?? ""}`;
  const small = width < 60;
  const tiny = width < 40;

  useGSAP(
    () => {
      if (!tilt || !ref.current || prefersReducedMotion()) return;
      const el = ref.current;
      gsap.set(el, { transformPerspective: 600 });
      const ry = gsap.quickTo(el, "rotationY", { duration: 0.4, ease: "paper" });
      const rx = gsap.quickTo(el, "rotationX", { duration: 0.4, ease: "paper" });
      const move = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 16);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
      };
      const leave = () => {
        ry(0);
        rx(0);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerleave", leave);
      return () => {
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerleave", leave);
      };
    },
    { scope: ref, dependencies: [tilt] },
  );

  const eyeMask = `${uid}-eyes`;
  const clip = `${uid}-clip`;
  const pat = `${uid}-pat`;
  const trim = `${uid}-trim`;
  const shadowFill = shade(base, -0.6);

  const piece = (d: string, tone: Tone, key: string) => (
    <g key={key}>
      {!tiny && <path d={d} fill={shadowFill} opacity={0.32} transform="translate(1.1 1.6)" />}
      <path d={d} fill={tones[tone]} />
    </g>
  );

  return (
    <svg
      ref={ref}
      viewBox="-4 -8 248 162"
      width={width}
      height={(width * 162) / 248}
      className={className}
      style={{ overflow: "visible", ...style }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-mask={id.name}
    >
      <defs>
        <mask id={eyeMask} maskUnits="userSpaceOnUse" x="-20" y="-20" width="280" height="190">
          <rect x="-20" y="-20" width="280" height="190" fill="#fff" />
          {EYES.map((d) => (
            <path key={d} d={d} fill="#000" />
          ))}
        </mask>
        <clipPath id={clip}>
          <path d={silhouette} />
        </clipPath>
        {!small && <PatternDef id={pat} kind={tradition} colour={shade(base, -0.42)} colour2={shade(base, -0.25)} scale={0.8} />}
        {!small && (
          <mask id={trim} maskUnits="userSpaceOnUse" x="-20" y="-20" width="280" height="190">
            <path d={FACE} fill="none" stroke="#fff" strokeWidth="13.5" />
            <path d={FACE} fill="none" stroke="#000" strokeWidth="10.5" />
          </mask>
        )}
      </defs>

      <g mask={`url(#${eyeMask})`}>
        {/* 1 · back layer */}
        <g transform="translate(3 4)" filter={small ? undefined : "url(#cut)"}>
          <path d={silhouette} fill={shade(base, -0.22)} />
          {feat.strokes?.map(([d, w, tone], i) =>
            tone === "gold" ? null : <path key={i} d={d} fill="none" stroke={shade(base, -0.22)} strokeWidth={w} strokeLinecap="round" />,
          )}
        </g>
        {/* 2 · mid layer */}
        <path d={silhouette} fill={base} filter={small ? undefined : "url(#cut)"} />
        {/* 3 · tradition pattern, printed tone-on-tone */}
        {!small && (
          <g clipPath={`url(#${clip})`} style={{ mixBlendMode: "multiply" }} opacity={0.55}>
            <rect x="-4" y="-8" width="248" height="162" fill={`url(#${pat})`} />
          </g>
        )}
        {/* paper fibre */}
        {!small && (
          <image
            href="/art/P-1-512.webp"
            x="-4"
            y="-8"
            width="248"
            height="162"
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clip})`}
            style={{ mixBlendMode: "multiply" }}
            opacity={0.5}
          />
        )}
        {/* layered pieces: brow band, then the animal */}
        {!tiny && piece(BROW, "light", "brow")}
        {feat.layers?.map(([d, tone], i) => piece(d, tone, `l${i}`))}
        {feat.strokes?.map(([d, w, tone], i) => (
          <path key={`s${i}`} d={d} fill="none" stroke={tones[tone]} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* 4 · gold trim, 6 px inside the face */}
        {!small && (
          <g clipPath={`url(#${clip})`}>
            <rect x="-4" y="-8" width="248" height="162" fill="#C8A04A" mask={`url(#${trim})`} opacity="0.95" />
          </g>
        )}
        {/* gold filigree */}
        {!small && (
          <g fill="#C8A04A">
            {DOTS.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={1.3} />
            ))}
            <path d={LEAF} />
          </g>
        )}
        {/* eye rims */}
        {EYES.map((d) => (
          <path key={`r${d}`} d={d} fill="none" stroke={small ? shade(base, -0.5) : "#C8A04A"} strokeWidth={small ? 3.5 : 2.2} />
        ))}
      </g>

      {/* 6 · twine ties */}
      <g fill="none" stroke="#B8542A" strokeWidth={small ? 4.5 : 2.6} strokeLinecap="round">
        <path d="M16,72 C10,73 6,75 6,76 C3,82 3,90 6,98" />
        <path d="M224,72 C230,73 234,75 234,76 C237,82 237,90 234,98" />
      </g>
      <circle cx="15" cy="72" r={small ? 4.5 : 3} fill="#8A3A1C" />
      <circle cx="225" cy="72" r={small ? 4.5 : 3} fill="#8A3A1C" />
    </svg>
  );
});

export { partyName };
