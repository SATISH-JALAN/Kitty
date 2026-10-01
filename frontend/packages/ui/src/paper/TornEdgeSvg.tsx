import { useMemo } from "react";
import { tornEdge, type TornEdgeOptions } from "./tornEdge";

/**
 * A torn top edge as a full-width strip. Place it at the top of a paper plane,
 * overlapping by `depth / 2`, filled with the plane's colour.
 */
export function TornEdgeSvg({
  fill = "var(--bg)",
  core = "var(--core)",
  className,
  style,
  flip = false,
  ...opts
}: TornEdgeOptions & { fill?: string; core?: string; className?: string; style?: React.CSSProperties; flip?: boolean }) {
  const edge = useMemo(() => tornEdge(opts), [opts.seed, opts.width, opts.depth, opts.jitter]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      viewBox={`0 0 ${edge.width} ${edge.depth}`}
      preserveAspectRatio="none"
      style={{ display: "block", width: "100%", height: edge.depth, transform: flip ? "scaleY(-1)" : undefined, ...style }}
    >
      <path d={edge.core} fill={core} />
      <path d={edge.fill} fill={fill} />
      <g stroke={core} strokeWidth="1" fill="none" opacity="0.3" vectorEffect="non-scaling-stroke">
        {edge.fibres.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
