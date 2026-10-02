/**
 * The public API (architecture 7.2). Nothing here is private: party state is public chain data,
 * backups are ciphertext, pages are proofs their holders chose to share. The API never learns
 * which guest is which person.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { ed25519 } from "@noble/curves/ed25519.js";
import { type Address, type KeyPairSigner, address, getAddressEncoder, lamports } from "@solana/kit";
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction, getMintToInstruction, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { getTransferSolInstruction } from "@solana-program/system";
import * as snarkjs from "snarkjs";
import * as C from "@kitty/chain";
import * as Z from "@kitty/zk";
import { type Db, schema } from "../db";
import { env } from "../env";
import { cached, chainClock, fetchAccountData, fetchConfig, fetchHouse, fetchParties, fetchTree, rpc, sendInstructions, tokenBalance } from "../chain";
import { PolicyError, RateLimiter, relayTransaction } from "../relay";
import { log } from "../log";

const here = dirname(fileURLToPath(import.meta.url));
function readJson(paths: string[]) {
  for (const p of paths) {
    try {
      return JSON.parse(readFileSync(p, "utf8"));
    } catch {
      /* next */
    }
  }
  return null;
}
const KEYS = [join(here, "../../keys"), join(here, "../../../circuits/keys")];
const VK = readJson(KEYS.map((k) => join(k, "kitty_action_vk.json")));
const MANIFEST = readJson(KEYS.map((k) => join(k, "manifest.json")));

const hex = (b: ArrayLike<number>) => Buffer.from(Uint8Array.from(b as ArrayLike<number>)).toString("hex");
const sha256hex = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const toJson = (v: unknown) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));

export interface ApiDeps {
  db: Db;
  relay: KeyPairSigner | null;
  faucet: KeyPairSigner | null;
  mint: Address | null;
}

export function createApp(deps: ApiDeps) {
  const { db } = deps;
  const app = new Hono();
  const origins = env.APP_ORIGINS.split(",").map((s) => s.trim());
  app.use("/v1/*", cors({ origin: (o) => (origins.includes("*") || origins.includes(o) ? o : origins[0]), allowMethods: ["GET", "POST", "PUT"] }));

  const ip = (c: { req: { header(n: string): string | undefined } }) => c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const relayLimit = new RateLimiter(40, 60_000);
  const writeLimit = new RateLimiter(20, 60_000);
  const faucetIpLimit = new RateLimiter(10, 3_600_000);
  const faucetWalletLimit = new RateLimiter(2, 600_000);

  const parties = cached(2500, fetchParties);
  const clock = cached(2500, () => chainClock().catch(() => Math.floor(Date.now() / 1000)));
  const metaAll = cached(5000, async () => {
    const rows = await db.select().from(schema.partyMeta);
    return new Map(rows.map((r) => [String(r.partyId), r]));
  });

  async function views() {
    const [list, meta, now] = await Promise.all([parties(), metaAll(), clock()]);
    return list
      .map(({ address: a, data }) => {
        const m = meta.get(data.id.toString());
        return C.toPartyView(a, data, m ? { title: m.title, word: m.word, tradition: m.tradition as never } : {}, {}, now);
      })
      .sort((x, y) => Number(y.id) - Number(x.id));
  }

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/v1/config", async (c) => {
    const cfg = await fetchConfig();
    return c.json(
      toJson({
        programId: C.KITTY_PROGRAM_ADDRESS,
        cluster: "devnet",
        rpc: env.PUBLIC_RPC_URL,
        mint: cfg?.mint ?? deps.mint,
        relay: deps.relay?.address ?? null,
        fees: cfg && { protocolBps: cfg.protocolBps, coverBps: cfg.coverBps, lateBps: cfg.lateBps, maxHostBps: cfg.maxHostBps },
        minGraceSecs: cfg?.minGraceSecs,
        collectWindowSecs: cfg?.collectWindowSecs,
        nowToleranceSecs: cfg?.nowToleranceSecs,
        allowance: cfg?.allowance,
        nextPartyId: cfg?.nextPartyId,
        devRegister: cfg?.devRegister,
        artifacts: MANIFEST && {
          base: env.ARTIFACTS_BASE_URL,
          wasm: MANIFEST.wasm,
          zkey: MANIFEST.zkey,
        },
      }),
    );
  });

  app.get("/v1/blockhash", async (c) => {
    const { value } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    return c.json(toJson(value));
  });

  /** The chain's clock (the Clock sysvar the program checks proofs against), so a device
   *  with a wrong clock still proves with an accepted `now`. */
  app.get("/v1/clock", async (c) => {
    const unixTimestamp = await chainClock().catch(() => null);
    return unixTimestamp === null ? c.json({ error: "clock unavailable" }, 503) : c.json({ unixTimestamp });
  });

  // ---------------------------------------------------------------- tree

  /** All leaves in index order (devices download everything; no endpoint returns one path). */
  app.get("/v1/tree/leaves", async (c) => {
    const from = Math.max(0, Number(c.req.query("from") ?? 0));
    const limit = Math.min(20_000, Math.max(1, Number(c.req.query("limit") ?? 5000)));
    const rows = await db
      .select({ index: schema.leaves.index, value: schema.leaves.value, kind: schema.leaves.kind })
      .from(schema.leaves)
      .where(and(gte(schema.leaves.index, from), sql`${schema.leaves.index} < ${from + limit}`))
      .orderBy(asc(schema.leaves.index));
    // Only a gap-free run is useful to a device rebuilding the tree.
    let n = 0;
    while (n < rows.length && rows[n].index === from + n) n++;
    const tree = await fetchTree();
    return c.json({ from, leaves: rows.slice(0, n).map((r) => r.value), kinds: rows.slice(0, n).map((r) => r.kind), total: Number(tree?.nextIndex ?? 0) });
  });

  app.get("/v1/tree/roots", async (c) => {
    const t = await fetchTree();
    if (!t) return c.json({ error: "not initialised" }, 503);
    return c.json({ size: Number(t.nextIndex), current: hex(t.roots[Number(t.rootIndex)]), ring: t.roots.map(hex) });
  });

  // ---------------------------------------------------------------- parties

  /** Every party (while the list is small the app fetches all of them: architecture 11.3). */
  app.get("/v1/parties", async (c) => c.json(await views()));

  app.get("/v1/parties/:id", async (c) => {
    const v = (await views()).find((p) => p.id === c.req.param("id"));
    return v ? c.json(v) : c.json({ error: "not found" }, 404);
  });

  app.get("/v1/parties/:id/draws/:night", async (c) => {
    const id = c.req.param("id");
    const night = Number(c.req.param("night"));
    const found = (await parties()).find((p) => p.data.id.toString() === id);
    if (!found) return c.json({ error: "not found" }, 404);
    const p = found.data;
    const took = p.members.slice(0, p.joined).findIndex((m) => m.tookNight === night);
    const resolved = took >= 0 ? took : p.drawRound === night && p.drawWinner !== C.NO_WINNER ? p.drawWinner : undefined;
    const eligible = p.members
      .slice(0, p.joined)
      .map((m, i) => (m.tookNight === 0 || m.tookNight === night ? i : -1))
      .filter((i) => i >= 0);
    return c.json({ partyId: id, night, status: resolved === undefined ? "waiting" : "resolved", takerIdx: resolved, eligible, requested: p.drawRound === night });
  });

  /** Host-written public metadata, signed by the host's party wallet. */
  app.post("/v1/parties/:id/meta", async (c) => {
    if (!writeLimit.take(ip(c))) return c.json({ error: "slow down" }, 429);
    const id = c.req.param("id");
    const body = await c.req.json<{ title: string; word: string; tradition: string; signature: string }>();
    const title = String(body.title ?? "").slice(0, 60).trim();
    const word = String(body.word ?? "").slice(0, 40).trim();
    const tradition = String(body.tradition ?? "kitty").slice(0, 20);
    if (!title || !word) return c.json({ error: "title and word are required" }, 400);
    const found = (await fetchParties()).find((p) => p.data.id.toString() === id);
    if (!found) return c.json({ error: "not found" }, 404);
    const msg = metaMessage(id, { title, word, tradition });
    const host = getAddressEncoder().encode(found.data.hostWallet);
    if (!ed25519.verify(Buffer.from(body.signature, "base64"), msg, new Uint8Array(host))) return c.json({ error: "bad signature" }, 401);
    await db
      .insert(schema.partyMeta)
      .values({ partyId: Number(id), title, word, tradition })
      .onConflictDoUpdate({ target: schema.partyMeta.partyId, set: { title, word, tradition, updatedAt: new Date() } });
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------------- House Fund

  app.get("/v1/house", async (c) => {
    const house = await fetchHouse();
    const balance = await tokenBalance(await C.houseVaultPda());
    const flows = await db.select().from(schema.houseFlows).orderBy(desc(schema.houseFlows.at)).limit(200);
    const since = new Date(Date.now() - 90 * 86_400_000);
    const [{ defaults }] = await db
      .select({ defaults: sql<number>`count(*)` })
      .from(schema.events)
      .where(and(eq(schema.events.name, "Defaulted"), gte(sql`to_timestamp(${schema.events.blockTime})`, since)));
    const [{ joined }] = await db
      .select({ joined: sql<number>`count(*)` })
      .from(schema.events)
      .where(and(eq(schema.events.name, "MemberJoined"), gte(sql`to_timestamp(${schema.events.blockTime})`, since)));
    const kind = (k: number) => (k === 1 || k === 5 ? "cover-out" : k === 2 ? "settle-in" : "fee-in");
    const exposure = Number(house?.exposure ?? 0n);
    const series = [...flows].reverse().map((f) => ({ at: f.at.toISOString(), balance: f.balanceAfter }));
    return c.json({
      balance: Number(balance),
      feesIn: Number(house?.feesIn ?? 0n),
      paidOut: Number(house?.paidOut ?? 0n),
      exposure,
      defaultRateBps: Number(joined) ? Math.round((Number(defaults) * 10_000) / Number(joined)) : 0,
      reserveOk: Number(balance) * 10 >= exposure,
      series: series.length ? series : [{ at: new Date().toISOString(), balance: Number(balance) }],
      flows: flows.map((f) => ({ id: f.id, at: f.at.toISOString(), kind: kind(f.kind), rawKind: f.kind, amount: f.amount, balanceAfter: f.balanceAfter, sig: f.signature, party: f.party })),
    });
  });

  // ---------------------------------------------------------------- Diary backup

  /** Encrypted Diary blob under an opaque key; writes are signed by a key derived from s. */
  app.put("/v1/backup/:key", async (c) => {
    if (!writeLimit.take(ip(c))) return c.json({ error: "slow down" }, 429);
    const key = c.req.param("key");
    if (!/^[0-9a-f]{64}$/.test(key)) return c.json({ error: "bad key" }, 400);
    const body = await c.req.json<{ pubkey: string; ciphertext: string; version: number; signature: string }>();
    if (!body.ciphertext || body.ciphertext.length > 90_000) return c.json({ error: "backup too large" }, 413);
    const pubkey = Buffer.from(body.pubkey, "hex");
    const msg = backupMessage(key, body.version, body.ciphertext);
    if (pubkey.length !== 32 || !ed25519.verify(Buffer.from(body.signature, "base64"), msg, pubkey)) return c.json({ error: "bad signature" }, 401);
    const [existing] = await db.select().from(schema.backups).where(eq(schema.backups.key, key));
    if (existing && existing.pubkey !== body.pubkey) return c.json({ error: "key belongs to another device secret" }, 403);
    if (existing && body.version < existing.version) return c.json({ error: "stale version" }, 409);
    await db
      .insert(schema.backups)
      .values({ key, pubkey: body.pubkey, ciphertext: body.ciphertext, version: body.version })
      .onConflictDoUpdate({ target: schema.backups.key, set: { ciphertext: body.ciphertext, version: body.version, updatedAt: new Date() } });
    return c.json({ ok: true, version: body.version });
  });

  app.get("/v1/backup/:key", async (c) => {
    const [row] = await db.select().from(schema.backups).where(eq(schema.backups.key, c.req.param("key")));
    return row ? c.json({ ciphertext: row.ciphertext, version: row.version, updatedAt: row.updatedAt.toISOString() }) : c.body(null, 204); // none yet (204, so browsers don't log an error)
  });

  // ---------------------------------------------------------------- faucet (devnet)

  app.post("/v1/faucet", async (c) => {
    if (!deps.faucet || !deps.mint) return c.json({ error: "faucet is off" }, 503);
    const body = await c.req.json<{ wallet: string }>();
    let wallet: Address;
    try {
      wallet = address(body.wallet);
    } catch {
      return c.json({ error: "bad wallet" }, 400);
    }
    if (!faucetIpLimit.take(ip(c)) || !faucetWalletLimit.take(wallet)) return c.json({ error: "Test funds are limited: try again in a few minutes" }, 429);
    const [ata] = await findAssociatedTokenPda({ owner: wallet, mint: deps.mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const amount = BigInt(env.FAUCET_KUSD) * 1_000_000n;
    const ixs = [
      getCreateAssociatedTokenIdempotentInstruction({ payer: deps.faucet, ata, owner: wallet, mint: deps.mint }),
      getMintToInstruction({ mint: deps.mint, token: ata, mintAuthority: deps.faucet, amount }),
    ];
    const { value: sol } = await rpc.getBalance(wallet).send();
    if (sol < 5_000_000n) ixs.push(getTransferSolInstruction({ source: deps.faucet, destination: wallet, amount: lamports(BigInt(Math.round(env.FAUCET_SOL * 1e9))) }) as never);
    try {
      const sig = await sendInstructions(deps.faucet, ixs, 100_000);
      await db.insert(schema.faucetDrips).values({ wallet, ip: ip(c), signature: sig, ok: true });
      return c.json({ ok: true, signature: sig, amount: Number(amount), tokenAccount: ata });
    } catch (e) {
      log.warn({ err: (e as Error).message }, "faucet failed");
      return c.json({ error: "The faucet couldn't send test funds just now" }, 502);
    }
  });

  // ---------------------------------------------------------------- fee relay

  app.post("/v1/relay", async (c) => {
    if (!deps.relay) return c.json({ error: "relay is off" }, 503);
    if (!relayLimit.take(ip(c))) return c.json({ error: "slow down" }, 429);
    const body = await c.req.json<{ transaction: string }>();
    try {
      const r = await relayTransaction(body.transaction, deps.relay, async (wire) => {
        await rpc.sendTransaction(wire as never, { encoding: "base64", preflightCommitment: "confirmed" }).send();
      });
      return c.json(r);
    } catch (e) {
      const msg = (e as Error).message;
      if (e instanceof PolicyError) return c.json({ error: msg }, 403);
      // Simulation failures carry the program's logs: hand them back so the app can explain.
      const logs = (e as { context?: { logs?: string[] } }).context?.logs;
      return c.json({ error: msg.slice(0, 400), logs }, 400);
    }
  });

  // ---------------------------------------------------------------- Show a page

  app.post("/v1/pages", async (c) => {
    if (!writeLimit.take(ip(c))) return c.json({ error: "slow down" }, 429);
    const body = await c.req.json<{
      claim: { minCompleted: string; minPaid: string; maxLate: string; scope: string; challenge: string };
      scopeLabel: string;
      proof: snarkjs.Groth16Proof;
      publicSignals: string[];
    }>();
    const r = await checkPage(body.claim, body.proof, body.publicSignals);
    if (!r.ok) return c.json({ error: r.reason }, 400);
    const id = randomBytes(6).toString("base64url");
    await db.insert(schema.pages).values({ id, claim: body.claim, proof: body.proof, publicSignals: body.publicSignals, scopeLabel: String(body.scopeLabel ?? "").slice(0, 80) });
    return c.json({ id });
  });

  app.get("/v1/pages/:id", async (c) => {
    const [row] = await db.select().from(schema.pages).where(eq(schema.pages.id, c.req.param("id")));
    if (!row) return c.json({ error: "not found" }, 404);
    const r = await checkPage(row.claim as never, row.proof as never, row.publicSignals as string[]);
    return c.json({ id: row.id, claim: row.claim, scopeLabel: row.scopeLabel, createdAt: row.createdAt.toISOString(), proof: row.proof, publicSignals: row.publicSignals, check: r });
  });

  app.onError((e, c) => {
    log.error({ err: e.message, path: c.req.path }, "api error");
    return c.json({ error: "Something went wrong on our side" }, 500);
  });

  return app;
}

export function metaMessage(id: string, m: { title: string; word: string; tradition: string }): Uint8Array {
  return new TextEncoder().encode(`kitty-meta:${id}:${sha256hex(JSON.stringify([m.title, m.word, m.tradition]))}`);
}
export function backupMessage(key: string, version: number, ciphertext: string): Uint8Array {
  return new TextEncoder().encode(`kitty-backup:${key}:${version}:${sha256hex(ciphertext)}`);
}

/**
 * A Show-a-page proof is good when: it's a HISTORY proof, its params hash is the claim, it
 * verifies, its root was a real Kitty root, and its note is still unspent (it's about now).
 */
async function checkPage(claim: { minCompleted: string; minPaid: string; maxLate: string; scope: string; challenge: string }, proof: snarkjs.Groth16Proof, publicSignals: string[]) {
  try {
    await Z.initPoseidon();
    const s = Z.actionSignals(publicSignals);
    if (s.mode !== 2 || s.outClaim !== 1n) return { ok: false, reason: "not a history proof" };
    const params = Z.paramsHistory({
      minCompleted: BigInt(claim.minCompleted), minPaid: BigInt(claim.minPaid), maxLate: BigInt(claim.maxLate),
      scope: BigInt(claim.scope), challenge: BigInt(claim.challenge),
    });
    if (Z.bytesToBig(s.paramsHash) !== params) return { ok: false, reason: "the proof is for a different claim" };
    if (!VK || !(await snarkjs.groth16.verify(VK, publicSignals, proof))) return { ok: false, reason: "the proof does not verify" };
    const unspent = !(await fetchAccountData(await C.nullifierPda(s.nullifier)));
    const tree = await fetchTree();
    const known = !!tree?.roots.some((r) => hex(r) === hex(s.root));
    return { ok: true, unspent, rootKnown: known, provenAt: new Date(Number(s.now) * 1000).toISOString(), pseudonym: hex(s.outTag) };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
