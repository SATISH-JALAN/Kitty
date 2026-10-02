/**
 * The public index (architecture 10.2). Everything here can be rebuilt by replaying the
 * program's events from slot 0; party state itself is read live from the chain.
 */
import { bigint, boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/** Every program event, in order. The projections below are derived from these. */
export const events = pgTable(
  "events",
  {
    signature: text("signature").notNull(),
    idx: integer("idx").notNull(),
    slot: bigint("slot", { mode: "number" }).notNull(),
    blockTime: bigint("block_time", { mode: "number" }),
    name: text("name").notNull(),
    party: bigint("party", { mode: "number" }),
    data: jsonb("data").notNull(),
  },
  (t) => [primaryKey({ columns: [t.signature, t.idx] }), index("events_party").on(t.party), index("events_name").on(t.name)],
);

/** The Kitty tree's leaves, served in bulk (devices never ask for a single path). */
export const leaves = pgTable("leaves", {
  index: bigint("index", { mode: "number" }).primaryKey(),
  value: text("value").notNull(),
  kind: integer("kind").notNull(),
  slot: bigint("slot", { mode: "number" }).notNull(),
  signature: text("signature").notNull(),
});

export const houseFlows = pgTable("house_flows", {
  id: text("id").primaryKey(),
  kind: integer("kind").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),
  party: bigint("party", { mode: "number" }).notNull(),
  signature: text("signature").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(),
});

/** Host-written public metadata: tradition word, title (signed by the host's party wallet). */
export const partyMeta = pgTable("party_meta", {
  partyId: bigint("party_id", { mode: "number" }).primaryKey(),
  title: text("title").notNull(),
  word: text("word").notNull(),
  tradition: text("tradition").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Encrypted Diary backups: the server holds ciphertext it can't read. */
export const backups = pgTable("backups", {
  key: text("key").primaryKey(),
  pubkey: text("pubkey").notNull(),
  ciphertext: text("ciphertext").notNull(),
  version: integer("version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Show-a-page proofs (public by design: the holder chose to share them). */
export const pages = pgTable("pages", {
  id: text("id").primaryKey(),
  claim: jsonb("claim").notNull(),
  proof: jsonb("proof").notNull(),
  publicSignals: jsonb("public_signals").notNull(),
  scopeLabel: text("scope_label").notNull(),
  onChain: text("on_chain"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const faucetDrips = pgTable(
  "faucet_drips",
  {
    wallet: text("wallet").notNull(),
    ip: text("ip").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    signature: text("signature").notNull(),
    ok: boolean("ok").notNull(),
  },
  (t) => [index("faucet_wallet").on(t.wallet), index("faucet_ip").on(t.ip)],
);

/** Indexer resume point. */
export const cursor = pgTable("cursor", {
  id: text("id").primaryKey(),
  lastSignature: text("last_signature"),
  lastSlot: bigint("last_slot", { mode: "number" }).notNull().default(0),
});
