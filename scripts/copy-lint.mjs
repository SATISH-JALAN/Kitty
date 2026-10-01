#!/usr/bin/env node
/**
 * Compliance copy lint (brief 0.4, product doc 13.2): no user-facing string may say
 * guaranteed, insured, insurance, interest, returns, yield, jackpot, lucky, win/winner/won,
 * chit fund, investment, deposit, APY or earn. Comments and identifiers are ignored;
 * string literals and JSX text are checked. Exits non-zero on a hit.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIRS = ["apps/web/app", "apps/web/components", "apps/web/copy", "packages/ui/src"];
const BANNED = /\b(guarantee(d|s)?|insured|insurance|interest|returns?|yield|jackpot|lucky|win|winner|winners|won|chit fund|investments?|deposits?|apy|earn(s|ed|ing)?)\b/i;

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "lab") continue;
      yield* walk(p);
    } else if (/\.(tsx?|mdx?)$/.test(e.name)) yield p;
  }
}

function strip(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`])\/\/.*$/gm, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

let hits = 0;
for (const d of DIRS) {
  for await (const file of walk(path.join(ROOT, d))) {
    const src = strip(await readFile(file, "utf8"));
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      // String literals and JSX text between tags.
      const chunks = [...line.matchAll(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`|>([^<>{}]+)</g)].map((m) => m[0]);
      for (const c of chunks) {
        if (/^["'`](\.|@|\/|#|[a-z-]+:|[a-z0-9_-]+["'`]$)/i.test(c)) continue; // paths, ids, css keywords
        const m = BANNED.exec(c);
        if (m) {
          hits++;
          console.log(`${path.relative(ROOT, file)}:${i + 1}  "${m[0]}"  in ${c.trim().slice(0, 90)}`);
        }
      }
    });
  }
}
if (hits) {
  console.error(`\n${hits} banned word(s) in user-facing copy (brief 0.4).`);
  process.exit(1);
}
console.log("Copy lint: no banned words.");
