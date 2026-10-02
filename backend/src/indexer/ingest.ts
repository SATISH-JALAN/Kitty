/**
 * Turn one transaction's program events into rows. Idempotent: every row is keyed by
 * (signature, event index) or by something derived from it, so replays are harmless.
 */
import type * as C from "@kitty/chain";
import { type Db, schema } from "../db";

const toJson = (v: unknown): unknown =>
  typeof v === "bigint" ? v.toString() : v instanceof Uint8Array ? Buffer.from(v).toString("hex") : Array.isArray(v) ? (v.every((x) => typeof x === "number") && v.length === 32 ? Buffer.from(v).toString("hex") : v.map(toJson)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toJson(x)])) : v;

const hex = (b: ArrayLike<number>) => Buffer.from(Uint8Array.from(b as ArrayLike<number>)).toString("hex");

export async function ingest(db: Db, tx: { signature: string; slot: number; blockTime: number | null; events: C.ProgramEvent[] }) {
  if (tx.events.length === 0) return 0;
  const at = new Date((tx.blockTime ?? Math.floor(Date.now() / 1000)) * 1000);
  await db.transaction(async (q) => {
    for (const e of tx.events) {
      const party = "party" in e.data ? Number((e.data as { party: bigint }).party) : null;
      await q
        .insert(schema.events)
        .values({ signature: tx.signature, idx: e.index, slot: tx.slot, blockTime: tx.blockTime, name: e.name, party, data: toJson(e.data) })
        .onConflictDoNothing();
      if (e.name === "LeafAppended") {
        await q
          .insert(schema.leaves)
          .values({ index: Number(e.data.index), value: hex(e.data.leaf), kind: e.data.kind, slot: tx.slot, signature: tx.signature })
          .onConflictDoNothing();
      } else if (e.name === "HouseFlow") {
        await q
          .insert(schema.houseFlows)
          .values({
            id: `${tx.signature}:${e.index}`,
            kind: e.data.kind,
            amount: Number(e.data.amount),
            balanceAfter: Number(e.data.balance),
            party: Number(e.data.party),
            signature: tx.signature,
            at,
          })
          .onConflictDoNothing();
      }
    }
  });
  return tx.events.length;
}
