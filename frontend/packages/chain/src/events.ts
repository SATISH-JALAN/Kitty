/**
 * Decode the program's events from transaction logs ("Program data: <base64>" lines written by
 * Anchor's `emit!`). The indexer and the tests use this.
 */
import * as G from "./generated";

type Decoded =
  | { name: "LeafAppended"; data: G.LeafAppendedEvent }
  | { name: "Registered"; data: G.RegisteredEvent }
  | { name: "PartyCreated"; data: G.PartyCreatedEvent }
  | { name: "PartyUpdated"; data: G.PartyUpdatedEvent }
  | { name: "MemberJoined"; data: G.MemberJoinedEvent }
  | { name: "ChipIn"; data: G.ChipInEvent }
  | { name: "DrawRequested"; data: G.DrawRequestedEvent }
  | { name: "DrawResolved"; data: G.DrawResolvedEvent }
  | { name: "RoundSettled"; data: G.RoundSettledEvent }
  | { name: "Defaulted"; data: G.DefaultedEvent }
  | { name: "SettledUp"; data: G.SettledUpEvent }
  | { name: "Farewell"; data: G.FarewellEvent }
  | { name: "NoteUpdated"; data: G.NoteUpdatedEvent }
  | { name: "Vouched"; data: G.VouchedEvent }
  | { name: "HistoryVerified"; data: G.HistoryVerifiedEvent }
  | { name: "HouseFlow"; data: G.HouseFlowEvent };
export type ProgramEvent = Decoded & { index: number };
export type ProgramEventName = Decoded["name"];

const TABLE: [string, ReadonlyUint8Array, (d: Uint8Array) => unknown][] = [
  ["LeafAppended", G.LEAF_APPENDED_EVENT_DISCRIMINATOR, G.parseLeafAppendedEvent],
  ["Registered", G.REGISTERED_EVENT_DISCRIMINATOR, G.parseRegisteredEvent],
  ["PartyCreated", G.PARTY_CREATED_EVENT_DISCRIMINATOR, G.parsePartyCreatedEvent],
  ["PartyUpdated", G.PARTY_UPDATED_EVENT_DISCRIMINATOR, G.parsePartyUpdatedEvent],
  ["MemberJoined", G.MEMBER_JOINED_EVENT_DISCRIMINATOR, G.parseMemberJoinedEvent],
  ["ChipIn", G.CHIP_IN_EVENT_DISCRIMINATOR, G.parseChipInEvent],
  ["DrawRequested", G.DRAW_REQUESTED_EVENT_DISCRIMINATOR, G.parseDrawRequestedEvent],
  ["DrawResolved", G.DRAW_RESOLVED_EVENT_DISCRIMINATOR, G.parseDrawResolvedEvent],
  ["RoundSettled", G.ROUND_SETTLED_EVENT_DISCRIMINATOR, G.parseRoundSettledEvent],
  ["Defaulted", G.DEFAULTED_EVENT_DISCRIMINATOR, G.parseDefaultedEvent],
  ["SettledUp", G.SETTLED_UP_EVENT_DISCRIMINATOR, G.parseSettledUpEvent],
  ["Farewell", G.FAREWELL_EVENT_DISCRIMINATOR, G.parseFarewellEvent],
  ["NoteUpdated", G.NOTE_UPDATED_EVENT_DISCRIMINATOR, G.parseNoteUpdatedEvent],
  ["Vouched", G.VOUCHED_EVENT_DISCRIMINATOR, G.parseVouchedEvent],
  ["HistoryVerified", G.HISTORY_VERIFIED_EVENT_DISCRIMINATOR, G.parseHistoryVerifiedEvent],
  ["HouseFlow", G.HOUSE_FLOW_EVENT_DISCRIMINATOR, G.parseHouseFlowEvent],
];
type ReadonlyUint8Array = Readonly<Uint8Array> | { readonly [n: number]: number; readonly length: number };

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function same(a: ReadonlyUint8Array, b: Uint8Array): boolean {
  for (let i = 0; i < 8; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Decode one event payload (discriminator + data). Returns null for anything else. */
export function decodeEvent(bytes: Uint8Array): Decoded | null {
  if (bytes.length < 8) return null;
  for (const [name, disc, parse] of TABLE) {
    if (same(disc, bytes)) return { name, data: parse(bytes) } as Decoded;
  }
  return null;
}

/**
 * Events in log order. Only "Program data:" lines emitted while the Kitty program is the
 * innermost running program are taken (a CPI'd program's data lines are skipped).
 */
export function eventsFromLogs(logs: readonly string[], programId: string = G.KITTY_PROGRAM_ADDRESS): ProgramEvent[] {
  const stack: string[] = [];
  const out: ProgramEvent[] = [];
  for (const line of logs) {
    const invoke = line.match(/^Program (\w+) invoke/);
    if (invoke) {
      stack.push(invoke[1]);
      continue;
    }
    if (/^Program \w+ (success|failed)/.test(line)) {
      stack.pop();
      continue;
    }
    if (line.startsWith("Program data: ") && stack[stack.length - 1] === programId) {
      const e = decodeEvent(base64ToBytes(line.slice("Program data: ".length)));
      if (e) out.push({ ...e, index: out.length });
    }
  }
  return out;
}
