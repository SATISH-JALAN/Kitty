/**
 * The Butler's schedule (architecture 7.4) as a pure function: given a party and the time,
 * which permissionless cranks are due. The program rejects anything early or duplicated, so
 * running several Butlers (or a member running one) is safe.
 */
import * as C from "@kitty/chain";

export type Crank =
  | { kind: "cancel" }
  | { kind: "collect"; member: number }
  | { kind: "requestDraw"; round: number }
  | { kind: "resolveDraw"; round: number; seed: Uint8Array }
  | { kind: "settle"; round: number; winner: number }
  | { kind: "markDefault"; member: number }
  | { kind: "farewell"; member: number };

export interface PlanConfig {
  collectWindowSecs: number;
}

const due = (p: C.Party, r: number) => Number(p.startTs) + (r - 1) * Number(p.periodSecs);

/** Who could take the kitty tonight (mirrors the program's `eligible`). */
export function eligible(p: C.Party, r: number): number[] {
  const open = (m: C.Member) =>
    m.tookNight === 0 && ((m.status === C.MEMBER_STATUS.ACTIVE && m.paidThrough >= r) || m.status === C.MEMBER_STATUS.REMOVED);
  const all = p.members.slice(0, p.joined).map((m, i) => (open(m) ? i : -1)).filter((i) => i >= 0);
  const gated = all.filter((i) => p.members[i].seat <= r);
  return gated.length ? gated : all;
}

export function plan(p: C.Party, now: number, cfg: PlanConfig): Crank[] {
  const out: Crank[] = [];
  const members = p.members.slice(0, p.joined);

  if (p.status === C.PARTY_STATUS.FORMING) {
    if (now > Number(p.formationDeadline)) out.push({ kind: "cancel" });
    return out;
  }
  if (p.status === C.PARTY_STATUS.FINISHED || p.status === C.PARTY_STATUS.CANCELLED) {
    members.forEach((m, i) => {
      if (m.farewelled === 0 && m.status !== C.MEMBER_STATUS.DEFAULTED) out.push({ kind: "farewell", member: i });
    });
    // A guest still in grace when the party ended is defaulted first.
    members.forEach((m, i) => {
      if (m.status === C.MEMBER_STATUS.GRACE && now > Number(m.graceDeadline)) out.push({ kind: "markDefault", member: i });
    });
    return out;
  }

  // Active
  members.forEach((m, i) => {
    if (m.status === C.MEMBER_STATUS.GRACE && now > Number(m.graceDeadline)) out.push({ kind: "markDefault", member: i });
  });
  const r = p.currentRound + 1;
  if (r > p.guests || now < due(p, r)) return out;

  members.forEach((m, i) => {
    if (m.status === C.MEMBER_STATUS.ACTIVE && m.paidThrough < r) out.push({ kind: "collect", member: i });
  });

  const settleAt = due(p, r) + cfg.collectWindowSecs;
  if (p.mode === C.ORDER.DRAW) {
    if (p.drawRound !== r) {
      // Draw after the collection window, so tonight's chip-ins decide who is eligible.
      if (now >= settleAt) out.push({ kind: "requestDraw", round: r });
    } else if (p.drawWinner === C.NO_WINNER) {
      out.push({ kind: "resolveDraw", round: r, seed: Uint8Array.from(p.drawSeed) });
    } else if (now >= settleAt) {
      out.push({ kind: "settle", round: r, winner: p.drawWinner });
    }
  } else if (now >= settleAt) {
    const w = members.findIndex((m) => m.seat === r);
    const m = members[w];
    // Tonight's guest hasn't chipped in: the night waits out their grace hours, then settle ends
    // their grace (and markDefault, above, hands the seat to the House Fund).
    const waiting = m && m.status === C.MEMBER_STATUS.ACTIVE && m.paidThrough < r && now < due(p, r) + Number(p.graceSecs);
    if (m && !waiting && m.status !== C.MEMBER_STATUS.GRACE) out.push({ kind: "settle", round: r, winner: w });
  }
  return out;
}
