"use client";
/**
 * The paper door (D-1, brief 16.1): light comes up behind the cut-work (brightness .55→1
 * plus a lantern glow in `screen`), an ornament sits on the medallion, and for the Guest
 * Pass success the image is rendered twice — left and right halves — so the leaves can
 * swing open on their outer hinges (rotateY ∓70°). Anchors are measured (STORYBOARD C8).
 */
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { DOOR } from "@/art/manifest";
import { Art } from "@/components/Art";

export interface DoorProps {
  height: number | string;
  ornament?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 0–1 light behind the cut-work. */
  light?: number;
  /** Load the painted door eagerly at high priority (when it's the first thing on screen). */
  priority?: boolean;
}

export const Door = forwardRef<HTMLDivElement, DoorProps>(function Door({ height, ornament, children, className, style, light = 1, priority }, ref) {
  return (
    <div
      ref={ref}
      className={`door ${className ?? ""}`}
      style={{ position: "relative", height, aspectRatio: "1024 / 1536", perspective: 1400, ...style }}
    >
      {/* the room beyond: warm light, revealed when the leaves open */}
      <div className="door-beyond" aria-hidden="true" style={{ position: "absolute", left: "13%", right: "13%", top: "8%", bottom: "6%", borderRadius: "50% 50% 0 0 / 22% 22% 0 0", background: "radial-gradient(ellipse at 50% 60%, #FFE7B0, #FFD27A 40%, #E9A21E 75%)" }} />
      {(["l", "r"] as const).map((side) => (
        <div
          key={side}
          className={`door-leaf door-leaf-${side}`}
          style={{
            position: "absolute",
            inset: 0,
            clipPath: side === "l" ? "inset(0 50% 0 0)" : "inset(0 0 0 50%)",
            transformOrigin: side === "l" ? "13% 50%" : "87% 50%",
            backfaceVisibility: "hidden",
          }}
        >
          <div className="door-img" style={{ position: "absolute", inset: 0, filter: `brightness(${0.55 + light * 0.45})` }}>
            <Art id="D-1" fit="contain" sizes="(min-width:1024px) 30vw, 64vw" world="night" priority={priority} />
          </div>
          <div
            className="door-glow"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: `${DOOR.glow.x}%`,
              top: `${DOOR.glow.y}%`,
              width: `${DOOR.glow.w}%`,
              height: `${DOOR.glow.h}%`,
              background: "radial-gradient(ellipse at 50% 55%, rgba(255,210,122,.55), rgba(255,210,122,.12) 55%, rgba(255,210,122,0) 75%)",
              mixBlendMode: "screen",
              opacity: light,
              pointerEvents: "none",
            }}
          />
        </div>
      ))}
      {ornament && (
        <div
          className="door-ornament"
          style={{ position: "absolute", left: `${DOOR.medallion.cx}%`, top: `${DOOR.medallion.cy}%`, width: `${DOOR.medallion.d}%`, aspectRatio: "1", translate: "-50% -50%", display: "grid", placeItems: "center" }}
        >
          {ornament}
        </div>
      )}
      <div className="door-slot" aria-hidden="true" style={{ position: "absolute", left: `${DOOR.slot.x}%`, top: `${DOOR.slot.y}%`, width: `${DOOR.slot.w}%`, height: `${DOOR.slot.h}%` }} />
      {children}
    </div>
  );
});
