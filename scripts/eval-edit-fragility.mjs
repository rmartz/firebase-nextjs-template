#!/usr/bin/env node
/**
 * Edit-fragility evaluation (#237, epic #161 / #162).
 *
 * Joins the per-file edit-fragility SCORE (`validate-anchor-uniqueness.mjs
 * --json`) against the GROUND TRUTH mined from transcripts (`mine-edit-outcomes
 * .mjs --json`) and asks the question the POC could never answer on its own:
 * does a higher fragility score actually predict harder-to-anchor edits?
 *
 *   - Correlation is Spearman's rho (rank-based, robust to the score's skew and
 *     to small n) between fragility and each difficulty signal — the
 *     disambiguation-window size, and the anchor-failure count.
 *   - False-positive classes (tests / stories / fixtures) are labelled per row
 *     and correlations are reported both including and excluding them, because
 *     those files are fragile-by-score (repeated `expect` / JSX / fixtures) yet
 *     trivially editable — the metric's most obvious failure mode (#237, AC5).
 *
 * It also owns PERSISTENCE (#237, AC3): `--snapshot <ledger>` appends one JSON
 * line — date, commit, per-file scores — to a committed ledger so the
 * distribution accumulates over time instead of evaporating with each CI run.
 *
 * Usage:
 *   node scripts/eval-edit-fragility.mjs                 # run full analysis
 *   node scripts/eval-edit-fragility.mjs --snapshot metrics/edit-fragility-history.jsonl
 *   node scripts/eval-edit-fragility.mjs --transcripts <dir>   # override source
 */

import { appendFileSync } from "fs";
import { execFileSync } from "child_process";
import { pathToFileURL } from "url";

const TEST = /\.spec\.[cm]?[jt]sx?$/;
const STORY = /\.stories\.[cm]?[jt]sx?$/;
const FIXTURE = /(^|\/)[^/]+-tests\/|(^|\/)fixtures?\//;

/** Bucket a file into a false-positive class (or "source"). */
export function classifyFile(path) {
  if (TEST.test(path)) return "test";
  if (STORY.test(path)) return "story";
  if (FIXTURE.test(path)) return "fixture";
  return "source";
}

/** Average-rank vector for Spearman (ties share the mean of their ranks). */
function ranks(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k += 1) out[order[k][1]] = rank;
    i = j + 1;
  }
  return out;
}

/** Spearman rank correlation of [x, y] pairs; undefined for n < 2 or no variance. */
export function spearman(pairs) {
  if (pairs.length < 2) return undefined;
  const rx = ranks(pairs.map((p) => p[0]));
  const ry = ranks(pairs.map((p) => p[1]));
  const n = pairs.length;
  const mean = (n + 1) / 2;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    const a = rx[i] - mean;
    const b = ry[i] - mean;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return undefined;
  return num / Math.sqrt(dx * dy);
}

/** Inner-join scores against mined outcomes, keyed on repo-relative path. */
export function joinScoresAndOutcomes(scores, outcomes) {
  return scores
    .filter((s) => outcomes.has(s.path))
    .map((s) => {
      const o = outcomes.get(s.path);
      return {
        path: s.path,
        klass: classifyFile(s.path),
        fragility: s.fragility,
        significant: s.significant,
        edits: o.edits,
        failures: o.failures,
        retries: o.retries,
        medianWindow: o.medianWindow,
        maxWindow: o.maxWindow,
      };
    });
}

/** Build one durable ledger line capturing the current score distribution. */
export function buildSnapshot(scores, { date, commit }) {
  return {
    date,
    commit,
    files: scores.map((s) => ({
      path: s.path,
      fragility: s.fragility,
      significant: s.significant,
    })),
  };
}

const fmt = (rho) => (rho === undefined ? "n/a" : rho.toFixed(2));

function correlations(rows) {
  const window = rows.filter((r) => r.medianWindow > 0);
  return {
    n: rows.length,
    nWindow: window.length,
    rhoWindow: spearman(window.map((r) => [r.fragility, r.medianWindow])),
    rhoFailure: spearman(rows.map((r) => [r.fragility, r.failures])),
    failures: rows.reduce((n, r) => n + r.failures, 0),
  };
}

function runJson(cmd) {
  return JSON.parse(
    execFileSync("node", cmd, {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }),
  );
}

/** Mine the transcripts (via the miner's --json CLI) into a path→stats Map. */
function minedOutcomes(transcripts) {
  const cmd = ["scripts/mine-edit-outcomes.mjs", "--json"];
  if (transcripts) cmd.push("--transcripts", transcripts);
  return new Map(runJson(cmd).map((s) => [s.path, s]));
}

function gitCommit() {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function report(rows) {
  const all = correlations(rows);
  const source = correlations(rows.filter((r) => r.klass === "source"));
  console.log(`Edit-fragility evaluation — ${rows.length} joined file(s)\n`);
  console.log(
    `  ${"frag".padStart(5)}  ${"medW".padStart(5)}  ${"fail".padStart(4)}  ${"class".padEnd(7)}  file`,
  );
  for (const r of [...rows].sort((a, b) => b.fragility - a.fragility)) {
    console.log(
      `  ${(r.fragility * 100).toFixed(0).padStart(4)}%  ${String(r.medianWindow).padStart(5)}  ${String(r.failures).padStart(4)}  ${r.klass.padEnd(7)}  ${r.path}`,
    );
  }
  console.log(
    `\n  Spearman rho (fragility vs disambiguation-window size):` +
      `\n    all files      n=${all.nWindow}/${all.n}  rho=${fmt(all.rhoWindow)}` +
      `\n    source only    n=${source.nWindow}/${source.n}  rho=${fmt(source.rhoWindow)}`,
  );
  console.log(
    `  Spearman rho (fragility vs anchor-failure count): rho=${fmt(all.rhoFailure)} over ${all.failures} total failure(s)`,
  );
  if (all.failures === 0)
    console.log(
      `  NOTE: zero anchor failures in the corpus — the failure signal cannot be\n` +
        `  correlated; the window-size signal above is the available evidence.`,
    );
}

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--transcripts");
  const transcripts = at !== -1 ? args[at + 1] : undefined;
  const scores = runJson(["scripts/validate-anchor-uniqueness.mjs", "--json"]);

  const snapAt = args.indexOf("--snapshot");
  if (snapAt !== -1 && args[snapAt + 1]) {
    const line = buildSnapshot(scores, {
      date: new Date().toISOString().slice(0, 10),
      commit: gitCommit(),
    });
    appendFileSync(args[snapAt + 1], JSON.stringify(line) + "\n");
    console.log(
      `Appended snapshot (${line.files.length} files) to ${args[snapAt + 1]}`,
    );
    return;
  }

  report(joinScoresAndOutcomes(scores, minedOutcomes(transcripts)));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
