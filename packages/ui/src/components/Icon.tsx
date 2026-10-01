import type { CSSProperties } from "react";

export type IconName =
  | "lantern" | "invite" | "booklet" | "net" | "chit" | "stamp" | "seal" | "bowl" | "mask" | "door" | "masks"
  | "envelope" | "grace" | "copy" | "done" | "arrow" | "close" | "spool" | "tag" | "external" | "menu" | "butler";

/**
 * Cut-paper glyph from /icons.svg (brief 6.1). Decorative by default; pass `label`
 * when the icon carries meaning on its own.
 */
export function Icon({
  name,
  size = 20,
  label,
  className,
  style,
}: {
  name: IconName;
  size?: 16 | 20 | 24 | 32 | number;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={{ flex: "none", ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href={`/icons.svg#${name}`} />
    </svg>
  );
}
