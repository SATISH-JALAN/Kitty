/**
 * Database: Postgres (Neon) when DATABASE_URL is set, otherwise embedded PGlite (local dev,
 * tests). Migrations run on start.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import { migrate as migrateLite } from "drizzle-orm/pglite/migrator";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), "../../drizzle");

export type Db = ReturnType<typeof drizzlePg<typeof schema>>;

export async function openDb(url: string, opts: { memory?: boolean } = {}): Promise<Db> {
  if (url) {
    const sql = postgres(url, { max: 5, prepare: false });
    const db = drizzlePg(sql, { schema });
    await migratePg(db, { migrationsFolder });
    return db;
  }
  let client: PGlite;
  if (opts.memory) client = new PGlite();
  else {
    const dir = join(process.cwd(), ".data/pglite");
    mkdirSync(dir, { recursive: true });
    client = new PGlite(dir);
  }
  const db = drizzleLite(client, { schema });
  await migrateLite(db, { migrationsFolder });
  // Same query surface for our purposes.
  return db as unknown as Db;
}

export { schema };
