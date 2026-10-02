// Generate the typed client from the program's IDL (contracts/idl/kitty.json) into src/generated.
// Codama's JS renderer writes a whole package, so render into a temp folder and keep src/generated.
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createFromRoot } from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor } from "@codama/renderers-js";

const here = dirname(fileURLToPath(import.meta.url));
const idl = JSON.parse(readFileSync(join(here, "../../../../contracts/idl/kitty.json"), "utf8"));
const codama = createFromRoot(rootNodeFromAnchor(idl));
const tmp = mkdtempSync(join(tmpdir(), "kitty-codama-"));
await codama.accept(renderVisitor(tmp, { formatCode: false }));
const out = join(here, "../src/generated");
rmSync(out, { recursive: true, force: true });
cpSync(join(tmp, "src/generated"), out, { recursive: true });
rmSync(tmp, { recursive: true, force: true });
console.log("generated src/generated from contracts/idl/kitty.json");
