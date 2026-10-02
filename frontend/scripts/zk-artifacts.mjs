// Copy the Kitty action circuit's proving artifacts into the app (served at /zk, cached in
// IndexedDB by the prover worker after the first download, SHA-256 checked against the
// manifest the API serves). Source: circuits/keys (run `npm run setup` there first).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "../../circuits/keys");
const out = join(here, "../apps/web/public/zk");
mkdirSync(out, { recursive: true });
for (const f of ["kitty_action.wasm", "kitty_action.zkey", "kitty_action_vk.json", "manifest.json"]) {
  if (!existsSync(join(src, f))) {
    console.error(`missing ${f} in circuits/keys: run the circuit setup first`);
    process.exit(1);
  }
  copyFileSync(join(src, f), join(out, f));
}
console.log("copied proving artifacts to apps/web/public/zk");
