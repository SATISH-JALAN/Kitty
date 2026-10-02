import { start } from "./services";

await start((process.env.ROLES ?? "api,indexer,butler").split(",").map((s) => s.trim()));

// Render's free plan puts a service to sleep after 15 minutes without requests, which would stop
// the indexer and the Butler. A request to our own public URL every 10 minutes keeps it awake.
const self = process.env.RENDER_EXTERNAL_URL;
if (self) setInterval(() => void fetch(`${self}/health`).catch(() => undefined), 10 * 60_000);
