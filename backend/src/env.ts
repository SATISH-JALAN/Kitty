/** Configuration from the environment (architecture 12.3). */
import { z } from "zod";

// Values are trimmed: a space or newline pasted into a host's dashboard must not break an address or origin.
const schema = z.object({
  NODE_ENV: z.string().trim().default("development"),
  PORT: z.coerce.number().default(8787),
  /** Postgres (Neon) URL; empty = embedded PGlite under ./.data (local dev and tests). */
  DATABASE_URL: z.string().trim().default(""),
  RPC_URL: z.string().trim().default("https://api.devnet.solana.com"),
  /** RPC the browser should use (no private keys in it). */
  PUBLIC_RPC_URL: z.string().trim().default("https://api.devnet.solana.com"),
  KITTY_PROGRAM_ID: z.string().trim().default("5BLmkW7GCc2R2AkpetqRPtFy51Gu5jvxLXzPNaQ6m15t"),
  KITTY_MINT: z.string().trim().default(""),
  /** JSON array secret keys (solana-keygen format). The relay pays fees and marker rent. */
  RELAY_KEYPAIR: z.string().trim().default(""),
  /** The Butler's crank wallet (can be the same as the relay on devnet). */
  BUTLER_KEYPAIR: z.string().trim().default(""),
  /** The kUSD mint authority (devnet faucet). */
  FAUCET_KEYPAIR: z.string().trim().default(""),
  FAUCET_KUSD: z.coerce.number().default(250),
  FAUCET_SOL: z.coerce.number().default(0.01),
  /** Where the app is served from (CORS). Comma-separated. */
  APP_ORIGINS: z.string().trim().default("http://localhost:3100"),
  BUTLER_TICK_MS: z.coerce.number().default(8000),
  INDEXER_POLL_MS: z.coerce.number().default(2500),
  /** Proving artifacts the app downloads (manifest with SHA-256 hashes). */
  ARTIFACTS_BASE_URL: z.string().trim().default("/zk"),
  LOG_LEVEL: z.string().trim().default("info"),
});

export const env = schema.parse(process.env);
export type Env = typeof env;
