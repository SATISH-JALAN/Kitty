/**
 * The indexer (architecture 7.1): follows the program's transactions, decodes its events and
 * writes them to Postgres. Polls getSignaturesForAddress from the stored cursor (oldest first),
 * so a restart or a dropped connection just resumes; replay from scratch rebuilds everything.
 */
import { type Signature } from "@solana/kit";
import { eq } from "drizzle-orm";
import * as C from "@kitty/chain";
import { type Db, schema } from "../db";
import { programId, rpc, sleep } from "../chain";
import { log } from "../log";
import { ingest } from "./ingest";

const CURSOR = "program";

type SigInfo = { signature: Signature; slot: bigint; err: unknown };

async function newSignatures(until: string | null): Promise<SigInfo[]> {
  const out: SigInfo[] = [];
  let before: Signature | undefined;
  for (;;) {
    const page = await rpc
      .getSignaturesForAddress(programId, { limit: 1000, ...(before ? { before } : {}), ...(until ? { until: until as Signature } : {}), commitment: "confirmed" })
      .send();
    out.push(...page);
    if (page.length < 1000) break;
    before = page[page.length - 1].signature;
  }
  return out.reverse(); // oldest first
}

/** New signatures since the cursor. If the node has pruned the cursor's transaction (a local
 *  validator keeps little history), fall back to everything after the cursor's slot. */
async function sinceCursor(cur: { lastSignature: string | null; lastSlot: number | null } | undefined): Promise<SigInfo[]> {
  if (!cur?.lastSignature) return newSignatures(null);
  try {
    return await newSignatures(cur.lastSignature);
  } catch (e) {
    if (!/not found/i.test((e as Error).message)) throw e;
    log.warn({ cursor: cur.lastSignature }, "indexer: cursor transaction pruned by the node, resuming by slot");
    const all = await newSignatures(null);
    return all.filter((s) => Number(s.slot) > (cur.lastSlot ?? 0) || (Number(s.slot) === cur.lastSlot && s.signature !== cur.lastSignature));
  }
}

export async function indexOnce(db: Db): Promise<number> {
  const [cur] = await db.select().from(schema.cursor).where(eq(schema.cursor.id, CURSOR));
  const sigs = await sinceCursor(cur);
  let n = 0;
  for (const s of sigs) {
    if (!s.err) {
      const tx = await rpc.getTransaction(s.signature, { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send();
      const logs = tx?.meta?.logMessages ?? [];
      const events = C.eventsFromLogs(logs, programId);
      n += await ingest(db, { signature: s.signature, slot: Number(s.slot), blockTime: tx?.blockTime ? Number(tx.blockTime) : null, events });
    }
    await db
      .insert(schema.cursor)
      .values({ id: CURSOR, lastSignature: s.signature, lastSlot: Number(s.slot) })
      .onConflictDoUpdate({ target: schema.cursor.id, set: { lastSignature: s.signature, lastSlot: Number(s.slot) } });
  }
  return n;
}

export async function runIndexer(db: Db, pollMs: number, stop: { stopped: boolean } = { stopped: false }) {
  log.info({ program: programId }, "indexer: following the program");
  while (!stop.stopped) {
    try {
      const n = await indexOnce(db);
      if (n) log.info({ events: n }, "indexer: ingested");
    } catch (e) {
      log.warn({ err: (e as Error).message }, "indexer: poll failed, retrying");
    }
    await sleep(pollMs);
  }
}
