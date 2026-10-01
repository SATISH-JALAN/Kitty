// Compile kitty_action.circom to build/ (r1cs, wasm, sym) and print the constraint count.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "build"), { recursive: true });
const out = execFileSync("circom", ["kitty_action.circom", "--r1cs", "--wasm", "--sym", "--O2", "-o", "build", "-l", "node_modules"], {
  cwd: root,
  encoding: "utf8",
});
process.stdout.write(out);
// circom's witness calculator is CommonJS; this package is ESM
writeFileSync(join(root, "build/kitty_action_js/package.json"), '{ "type": "commonjs" }\n');
const m = out.match(/non-linear constraints: (\d+)/);
if (m) {
  const nonLinear = Number(m[1]);
  console.log(`constraint guard: ${nonLinear} non-linear (limit 65,536 for the 2^16 ptau)`);
  if (nonLinear > 65536) process.exit(1);
}
