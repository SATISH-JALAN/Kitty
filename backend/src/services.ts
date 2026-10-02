/** Start any of the three roles: api, indexer, butler (ROLES=api,indexer,butler). */
import { serve } from "@hono/node-server";
import { address } from "@solana/kit";
import { openDb } from "./db";
import { env } from "./env";
import { log } from "./log";
import { fetchConfig, signerFromEnv } from "./chain";
import { createApp } from "./api/app";
import { runIndexer } from "./indexer/indexer";
import { Butler } from "./butler/butler";

export async function start(roles: string[]) {
  const db = await openDb(env.DATABASE_URL);
  const relay = await signerFromEnv(env.RELAY_KEYPAIR, "RELAY_KEYPAIR");
  const faucet = await signerFromEnv(env.FAUCET_KEYPAIR, "FAUCET_KEYPAIR");
  const butlerKey = (await signerFromEnv(env.BUTLER_KEYPAIR, "BUTLER_KEYPAIR")) ?? relay;
  const cfg = await fetchConfig().catch(() => null);
  const mint = env.KITTY_MINT ? address(env.KITTY_MINT) : (cfg?.mint ?? null);

  if (roles.includes("indexer")) void runIndexer(db, env.INDEXER_POLL_MS);
  if (roles.includes("butler")) {
    if (!butlerKey || !mint) log.warn("butler: no BUTLER_KEYPAIR/RELAY_KEYPAIR or mint; not starting");
    else void new Butler(butlerKey, mint).run(env.BUTLER_TICK_MS);
  }
  if (roles.includes("api")) {
    const app = createApp({ db, relay, faucet, mint });
    serve({ fetch: app.fetch, port: env.PORT });
    log.info({ port: env.PORT, relay: relay?.address, faucet: faucet?.address, mint }, "api: listening");
  }
}
