"use client";
/**
 * The party table (brief 7.21): diameter D, the round tablecloth (T-1), a soft centre
 * light, N seats at −90° + i·360/N on radius 0.56·D, the bowl (0.22·D) in the middle.
 * Each seat: a masked guest silhouette and a place card. Place cards sit on the rim in
 * front of each guest (0.44·D) rather than below them, so the bottom seats never collide
 * with the bead rail (STORYBOARD §2).
 *
 * Everything is positioned in px from the centre so scenes can target seats by
 * `[data-seat="i"]`, chit slots by `[data-chit-slot="i"]`, lanterns by `[data-seat-lantern="i"]`.
 */
import { forwardRef, type CSSProperties, type ReactNode } from "react";
import type { TraditionKey } from "@kitty/sdk";
import { Lantern } from "@kitty/ui/components/Lantern";
import { Art } from "@/components/Art";
import { Bowl, Guest } from "./Props";

export interface SeatGuest {
  name: string;
  colour: number;
  animal: number;
}

export function seatAngle(i: number, n: number) {
  return ((-90 + (i * 360) / n) * Math.PI) / 180;
}

export function seatPoint(i: number, n: number, D: number, r = 0.56) {
  const a = seatAngle(i, n);
  return { x: D / 2 + Math.cos(a) * r * D, y: D / 2 + Math.sin(a) * r * D };
}

export interface TableProps {
  D: number;
  guests: SeatGuest[];
  tradition: TraditionKey;
  world?: "paper" | "night";
  you?: number;
  /** Seat index with its lantern lit. */
  litSeat?: number | null;
  showLanterns?: boolean;
  showPlaceCards?: boolean;
  bowl?: ReactNode;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  onSeat?: (i: number) => void;
  seatOrder?: boolean;
}

export const Table = forwardRef<HTMLDivElement, TableProps>(function Table(
  { D, guests, tradition, world = "night", you, litSeat = null, showLanterns = true, showPlaceCards = true, bowl, children, className, style, onSeat, seatOrder },
  ref,
) {
  const n = guests.length;
  const guestW = 0.15 * D;
  return (
    <div ref={ref} className={`kitty-table ${className ?? ""}`} style={{ position: "relative", width: D, height: D, ...style }}>
      {/* spotlight */}
      <div
        className="table-spot"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: D / 2 - (1.3 * D) / 2,
          top: D / 2 - (1.3 * D) / 2,
          width: 1.3 * D,
          height: 1.3 * D,
          borderRadius: "50%",
          background: world === "night" ? "radial-gradient(circle, rgba(255,210,122,.18) 0%, rgba(255,210,122,.08) 42%, rgba(255,210,122,0) 70%)" : "radial-gradient(circle, rgba(255,251,243,.6) 0%, rgba(255,251,243,0) 70%)",
          pointerEvents: "none",
        }}
      />
      <div className="table-top" style={{ position: "absolute", inset: 0 }}>
        <div className="table-cloth" style={{ position: "absolute", inset: 0, borderRadius: "50%", filter: world === "night" ? "brightness(.82)" : undefined }}>
          <Art id="T-1" fit="contain" sizes={`${Math.round(D)}px`} world={world} />
        </div>
        <div aria-hidden="true" style={{ position: "absolute", inset: "22%", borderRadius: "50%", background: "radial-gradient(circle, rgba(255,240,210,.35), rgba(255,240,210,0) 70%)", mixBlendMode: "screen" }} />
        <div className="table-bowl" style={{ position: "absolute", left: D / 2 - 0.11 * D, top: D / 2 - 0.11 * D }}>
          {bowl ?? <Bowl size={0.22 * D} tradition={tradition} />}
        </div>
        {showPlaceCards &&
          guests.map((g, i) => {
            const p = seatPoint(i, n, D, 0.395);
            return (
              <div
                key={`pc-${i}`}
                className="place-card"
                data-place-card={i}
                style={{
                  position: "absolute",
                  left: p.x,
                  top: p.y,
                  translate: "-50% -50%",
                  width: Math.max(54, 0.13 * D),
                  padding: "3px 4px",
                  background: "#E3CFA8",
                  color: "var(--ink)",
                  borderRadius: 1,
                  boxShadow: "0 1px 0 rgba(34,21,31,.2), 0 2px 4px -1px rgba(7,3,12,.35)",
                  textAlign: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: Math.max(9, Math.min(11, D * 0.02)),
                  lineHeight: 1.15,
                  outline: you === i ? "1px dashed var(--ink)" : undefined,
                  outlineOffset: 2,
                }}
              >
                {seatOrder && <span style={{ display: "block", fontWeight: 600 }}>{i + 1}</span>}
                {g.name}
              </div>
            );
          })}
      </div>
      {guests.map((g, i) => {
        const p = seatPoint(i, n, D);
        return (
          <div
            key={`seat-${i}`}
            className="seat"
            data-seat={i}
            role={onSeat ? "button" : undefined}
            tabIndex={onSeat ? 0 : undefined}
            aria-label={onSeat ? `Seat ${i + 1}: ${g.name}` : undefined}
            onClick={onSeat ? () => onSeat(i) : undefined}
            onKeyDown={onSeat ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSeat(i)) : undefined}
            data-focus-ring={onSeat ? "" : undefined}
            style={{ position: "absolute", left: p.x - guestW / 2, top: p.y - guestW * 0.75, width: guestW, height: guestW * 1.25, cursor: onSeat ? "pointer" : undefined }}
          >
            <Guest width={guestW} colour={g.colour} animal={g.animal} tradition={tradition} />
            {showLanterns && (
              <span className="seat-lantern" data-seat-lantern={i} style={{ position: "absolute", left: "50%", top: -0.1 * D, translate: "-50% 0", opacity: litSeat === i ? 1 : 0 }}>
                <Lantern width={Math.max(18, 0.045 * D)} flicker={litSeat === i} />
              </span>
            )}
          </div>
        );
      })}
      <div className="table-overlay" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {children}
      </div>
    </div>
  );
});
