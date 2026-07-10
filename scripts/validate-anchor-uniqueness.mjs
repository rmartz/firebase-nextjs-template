#!/usr/bin/env node
/**
 * Edit-fragility (anchor-uniqueness) report — POC for epic #161, sub-issue #162.
 *
 * Agents edit code by exact-string match: an Edit needs a UNIQUE anchor. A file
 * full of identical lines forces edits to fail-to-anchor or drag a large
 * disambiguating window into context. This measures that per file.
 *
 * A line is "significant" if, trimmed, it is non-empty and not purely structural
 * punctuation (`}`, `});`, `],`, `/>`, …) — those repeat unavoidably and are never
 * good anchors. For the significant lines we key on the line WITH its leading
 * indentation but without trailing whitespace, because that is exactly what an
 * exact-string Edit matches: two identical lines at the same indent collide;
 * the same content at different indents does not. (Indent-shifted *block* clones
 * are the complementary jscpd metric, tracked separately in #162.)
 *
 *   fragility = (# significant lines whose exact form appears >= 2x) / (# significant)
 *
 * A line appearing once is a safe standalone anchor; one appearing >=2x needs
 * surrounding context to disambiguate. 0.0 = every line uniquely anchorable.
 *
 * REPORT-ONLY by default (exits 0): this is a measurement to calibrate a
 * threshold from the real distribution before it ever becomes a gate. Pass
 * `--max <ratio>` to fail on any file above that fragility, `--json` for machine
 * output, `--top <n>` to change how many worst offenders are listed.
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { extname, join, relative } from "path";

const ROOTS = ["src", "scripts"];
const EXTS = new Set([".ts", ".tsx", ".mjs", ".cjs", ".js", ".jsx"]);
// Vendored / generated code we do not own and would not hand-edit.
const IGNORE = [/^src\/components\/ui\//, /(^|\/)node_modules\//];
// A line that, trimmed, is only structural punctuation or a bare comment marker
// (`*`, `*/`, `/**`, `//`) — these repeat unavoidably and are never real anchors.
const STRUCTURAL = /^[{}()[\]<>;,.?:/=&|*]*$/;

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const asJson = flag("--json");
const topN = Number(value("--top", "3"));
const maxRaw = value("--max", undefined);
const maxFragility = maxRaw === undefined ? undefined : Number(maxRaw);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* walk(path);
    } else if (EXTS.has(extname(entry))) {
      yield path;
    }
  }
}

function analyze(path) {
  const counts = new Map();
  const order = [];
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const trimmed = raw.trim();
    if (trimmed === "" || STRUCTURAL.test(trimmed)) continue;
    const key = raw.replace(/\s+$/, ""); // preserve indent, drop trailing ws
    counts.set(key, (counts.get(key) ?? 0) + 1);
    order.push(key);
  }
  const significant = order.length;
  const nonUnique = order.filter((k) => counts.get(k) >= 2).length;
  const repeats = [...counts.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([line, n]) => ({ line: line.trim().slice(0, 68), count: n }));
  return {
    significant,
    fragility: significant === 0 ? 0 : nonUnique / significant,
    repeats,
  };
}

const files = ROOTS.flatMap((root) => [...walk(root)])
  .map((path) => relative(".", path))
  .filter((path) => !IGNORE.some((re) => re.test(path)))
  .map((path) => ({ path, ...analyze(path) }))
  .filter((f) => f.significant > 0)
  .sort((a, b) => b.fragility - a.fragility);

if (asJson) {
  console.log(JSON.stringify(files, null, 2));
} else {
  const pct = (n) => `${(n * 100).toFixed(0)}%`;
  console.log(`Edit-fragility (anchor-uniqueness) — ${files.length} file(s)\n`);
  console.log(`  ${"frag".padStart(5)}  ${"sig".padStart(4)}  file`);
  for (const f of files.slice(0, 20)) {
    console.log(
      `  ${pct(f.fragility).padStart(5)}  ${String(f.significant).padStart(4)}  ${f.path}`,
    );
    for (const r of f.repeats) console.log(`         x${r.count}  ${r.line}`);
  }
  const sorted = files.map((f) => f.fragility).sort((a, b) => a - b);
  const at = (q) => sorted[Math.floor((sorted.length - 1) * q)] ?? 0;
  console.log(
    `\n  distribution: p50 ${pct(at(0.5))}  p90 ${pct(at(0.9))}  max ${pct(at(1))}`,
  );
}

if (maxFragility !== undefined) {
  const over = files.filter((f) => f.fragility > maxFragility);
  if (over.length > 0) {
    console.error(
      `\n${over.length} file(s) over the ${(maxFragility * 100).toFixed(0)}% edit-fragility cap:`,
    );
    for (const f of over)
      console.error(`  ${(f.fragility * 100).toFixed(0)}%  ${f.path}`);
    process.exit(1);
  }
}
