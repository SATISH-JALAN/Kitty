#!/usr/bin/env node
/**
 * Fetches the display and UI faces into packages/ui/fonts (brief 5.3).
 *
 * Boska and Switzer are under the ITF Free Font License 2.0: self-hosting on our own
 * site is allowed, but redistribution, subsetting and format conversion are not. So the
 * files are downloaded unmodified from Fontshare at install time and kept out of git.
 * Fragment Mono is SIL OFL and committed.
 */
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "../packages/ui/fonts");
const WANT = [
  { family: "Boska", style: "normal", file: "Boska-Variable.woff2" },
  { family: "Boska", style: "italic", file: "Boska-VariableItalic.woff2" },
  { family: "Switzer", style: "normal", file: "Switzer-Variable.woff2" },
];

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const force = process.argv.includes("--force");
  if (!force && (await Promise.all(WANT.map((w) => exists(path.join(OUT, w.file))))).every(Boolean)) {
    console.log("fonts: already present");
    return;
  }
  const css = (
    await Promise.all(
      ["boska", "switzer"].map(async (f) => (await fetch(`https://api.fontshare.com/v2/css?f[]=${f}@1,2&display=swap`)).text()),
    )
  ).join("\n");
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  for (const want of WANT) {
    const face = faces.find(
      (f) => f.includes(`'${want.family}'`) && new RegExp(`font-style:\\s*${want.style}`).test(f),
    );
    const url = face && /url\('([^']+\.woff2)'\)/.exec(face)?.[1];
    if (!url) throw new Error(`fonts: no woff2 for ${want.family} ${want.style}`);
    const res = await fetch(url.startsWith("//") ? `https:${url}` : url);
    if (!res.ok) throw new Error(`fonts: ${res.status} for ${want.file}`);
    await writeFile(path.join(OUT, want.file), Buffer.from(await res.arrayBuffer()));
    console.log(`fonts: ${want.file}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
