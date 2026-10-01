/**
 * Static SVG filters shared by the whole app (brief 4.3, 4.4).
 * - #cut: hand-cut edges for small shapes (masks, chits, slips) under 400×400 px.
 * - #ink: pressed ink for stamps and redaction bars.
 * - #ink-soft: the settle frame of a stamp (used at stamp time only).
 * Rendered once in the root layout.
 */
export function PaperFilters() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        <filter id="cut" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="ink" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feMorphology operator="erode" radius="0.35" in="SourceGraphic" result="e" />
          <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="11" result="n" />
          <feDisplacementMap in="e" in2="n" scale="1.2" xChannelSelector="R" yChannelSelector="G" result="d" />
          {/* Uneven ink load: knock a little density out of the pressed shape. */}
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="5" result="blot" />
          <feColorMatrix in="blot" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.85 1.4" result="load" />
          <feComposite in="d" in2="load" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
